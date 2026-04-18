# Worker 运行逻辑（Gmail Polling Worker）

本文档介绍 Xiaoxing 的 Gmail 轮询 Worker 如何启动、如何调度、如何避免阻塞 Web 请求，以及常用的调试方式。

相关源码入口：

- Worker 主实现：[worker.py](../app/skills/gmail/worker.py)
- 邮件处理流水线（分析/摘要/通知渲染）：[pipeline.py](../app/skills/gmail/pipeline.py)
- Telegram 通知渲染（确定性模板）：[telegram_format.py](../app/skills/gmail/telegram_format.py)
- Worker 自动启动（lifespan）：[main.py](../app/main.py)
- 用户更新触发启停 Worker：[users.py](../app/api/routes/users.py)
- Worker 日志查询接口：[stats_logs.py](../app/api/routes/stats_logs.py)

---

## 1. 核心目标

- **每用户独立**：每个 `worker_enabled=true` 的用户各自有一个轮询 Task，互相隔离。
- **不阻塞 API**：启动 worker 时 API 立刻返回；worker 运行不应拖慢其它 HTTP 请求。
- **可控的资源占用**：首轮拉取错峰、并发受控、DB 查询批量化，避免瞬间打满线程池/数据库连接。
- **可观测**：所有关键步骤写入 step log，可从 UI 查看。

---

## 2. 启动与停止

### 2.1 服务启动时自动恢复（可选）

在 FastAPI 的 lifespan 中，如果配置了 `AUTO_START_GMAIL_WORKER=true`，会异步启动恢复逻辑：

- 不阻塞启动流程（使用 `asyncio.create_task`）
- `allow_empty=true` 时即使没有 enabled 用户也不会报错

入口：[main.py](../app/main.py)

### 2.2 用户维度启停

用户设置 `worker_enabled` 的变化会触发 worker 启停：

- `PUT /api/users/{id}` 更新 `worker_enabled=true` → `ensure_user_running(user_id)`
- `worker_enabled=false` → `stop_user(user_id)`

入口：[users.py](../app/api/routes/users.py)

---

## 3. 运行时调度模型

### 3.1 每用户一个循环（_user_loop）

每个用户一个 `_user_loop(state)`：

- 读取用户 `poll_interval`（支持热更新）
- 循环执行 `_poll_once(state)`，然后按 `poll_interval` sleep
- `state.running=false` 时退出并清理

### 3.2 首轮错峰（随机 + 分桶）

为避免“启动后一秒内所有用户同时拉取”，worker 在每个用户 loop 的开始会做一次首轮延迟：

- `delay_window = min(poll_interval, GMAIL_WORKER_START_JITTER_MAX)`
- 将 `delay_window` 划分为 `GMAIL_WORKER_START_BUCKETS` 个桶
- 用户按 `user_id % bucket_count` 分桶，桶内再做稳定随机偏移（按日期 + user_id）

效果：

- **启动接口立刻响应**
- **首轮拉取分布更均匀**，减少瞬时峰值

---

## 4. 不阻塞请求：专用线程池 + 并发上限

Worker 会执行大量同步 IO/CPU：

- DB 查询（psycopg2）
- Gmail API 拉取/标记已读
- Telegram 发送消息
- 邮件处理流水线（包含 LLM 调用）

如果全部使用 `asyncio.to_thread` 的默认线程池，可能把整个进程的线程池占满，导致其它 HTTP 请求排队。

因此 worker 使用 **独立 ThreadPoolExecutor** + **Semaphore 并发控制**：

- 专用线程池：`GMAIL_WORKER_IO_MAX_WORKERS`
- 同时在跑的 IO 任务上限：`GMAIL_WORKER_IO_CONCURRENCY`

实现：`_run_io(...)` 包装所有“可能阻塞”的调用。

---

## 5. 去重与批量化（减少 DB 压力）

### 5.1 为什么要批量化

拉取到 N 封邮件后，需要过滤已处理邮件。如果逐封调用 `is_email_processed` 会导致 N 次 SQL 查询，放大 DB 压力与线程池占用。

### 5.2 现在的做法

worker 会把本轮邮件 id 列表一次性查询：

- `get_processed_email_ids(email_ids, user_id)` → 返回已处理的 email_id 集合
- worker 用集合过滤新邮件

实现：

- DB 层：[email_repo.py](../app/db/repositories/email_repo.py)
- worker 使用处：[worker.py](../app/skills/gmail/worker.py)

---

## 6. 一次轮询的完整流程（_poll_once）

概览：

1) 读取用户配置（poll_interval/max_emails/min_priority/gmail_poll_query 等）
2) 拉取邮件（Gmail query + max_results）
3) 去重过滤（批量查询已处理 id）
4) 对新邮件执行处理流水线：
   - AI 分析（LLM）
   - AI 摘要（LLM）
   - Telegram 文案渲染（确定性模板，不调用 LLM）
5) 根据优先级策略决定是否推送
6) 记录 email_records、写 step log、必要时标记已读
7) 清理旧日志（cleanup_old_logs）

---

## 7. 观测与调试

### 7.1 Worker 日志接口

- `GET /api/worker/logs`
- `GET /api/worker/logs/window`
- `DELETE /api/worker/logs`

入口：[stats_logs.py](../app/api/routes/stats_logs.py)

### 7.2 常见排障思路

- 启动卡顿：调低 `GMAIL_WORKER_IO_CONCURRENCY`，增大首轮错峰窗口 `GMAIL_WORKER_START_JITTER_MAX`
- DB 压力大：确认去重走批量查询；必要时降低 `GMAIL_POLL_MAX`
- Telegram 推送慢：确认 Bot 数量与网络状况；可降低每轮推送量或增大间隔

---

## 8. 相关配置（.env）

| 变量 | 说明 |
|------|------|
| `AUTO_START_GMAIL_WORKER` | 服务启动时自动启动轮询 |
| `GMAIL_POLL_INTERVAL` | 默认轮询间隔（秒） |
| `GMAIL_POLL_MAX` | 每轮最多处理邮件数 |
| `GMAIL_POLL_QUERY` | Gmail 搜索语法兜底值 |
| `GMAIL_MARK_READ` | 处理后是否标记已读 |
| `GMAIL_WORKER_IO_CONCURRENCY` | worker 同时跑的 IO 任务上限 |
| `GMAIL_WORKER_IO_MAX_WORKERS` | worker 专用线程池大小 |
| `GMAIL_WORKER_START_JITTER_MAX` | 首轮错峰最大秒数 |
| `GMAIL_WORKER_START_BUCKETS` | 首轮错峰分桶数量 |

