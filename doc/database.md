# 数据库与缓存技术文档

本文档介绍 Xiaoxing AI 所使用的两个数据存储组件：**PostgreSQL**（主数据库）和 **Redis**（缓存 / 队列）。两者均通过 Docker 容器运行，可与代码一起在本地或服务器上启动。

---

## 目录

1. [PostgreSQL](#postgresql)
   - [快速启动](#快速启动)
   - [连接配置](#连接配置)
   - [表结构](#表结构)
   - [连接池原理](#连接池原理)
   - [常用维护命令](#常用维护命令)
2. [Redis](#redis)
   - [快速启动](#快速启动-1)
   - [连接配置](#连接配置-1)
   - [键设计与 TTL](#键设计与-ttl)
   - [四项功能说明](#四项功能说明)
   - [降级策略](#降级策略)
   - [常用维护命令](#常用维护命令-1)
3. [Docker Compose 一键启动](#docker-compose-一键启动)

---

## PostgreSQL

### 快速启动

使用 Docker 运行 PostgreSQL 16：

```bash
docker run -d \
  --name xiaoxin-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=xiaoxing \
  -p 5432:5432 \
  --restart unless-stopped \
  postgres:16-alpine
```

容器启动后，数据库 `xiaoxing` 会自动创建。应用启动时，`app/db.py` 中的 `init_db()` 会幂等地建立所有表。

验证连接是否正常：

```bash
docker exec xiaoxin-postgres pg_isready -U postgres
```

### 连接配置

在 `.env` 中设置：

```ini
POSTGRES_DSN=postgresql://postgres:postgres@localhost:5432/xiaoxing
```

DSN 格式：`postgresql://<user>:<password>@<host>:<port>/<database>`

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `user` | `postgres` | 数据库用户 |
| `password` | `postgres` | 数据库密码（生产环境请修改） |
| `host` | `localhost` | 数据库地址 |
| `port` | `5432` | 端口 |
| `database` | `xiaoxing` | 数据库名 |

> ⚠️ 生产环境请使用强密码，并将 `.env` 加入 `.gitignore`。

### 表结构

#### `sender`
记录已推送 Telegram 通知的邮件 ID，防止重复推送。

| 列 | 类型 | 说明 |
|----|------|------|
| `email_id` | TEXT PK | Gmail 邮件唯一 ID |
| `created_at` | TEXT | 记录时间（ISO 8601） |

#### `oauth_tokens`
存储 Google OAuth2 Token（只有一行，id=1）。

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | INTEGER PK CHECK(id=1) | 固定值 1，单行约束 |
| `token_json` | TEXT | 完整的 JSON token 内容 |
| `updated_at` | TEXT | 上次更新时间 |

#### `worker_logs`
Worker 步骤日志，最多保留 10,000 条。

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | BIGSERIAL PK | 自增 ID |
| `ts` | TEXT | 日志时间戳 |
| `level` | TEXT | `info` / `warn` / `error` |
| `log_type` | TEXT | `email`（邮件 Worker）/ `chat`（Bot Worker）|
| `tokens` | INTEGER | 该步骤消耗的 LLM token 数 |
| `msg` | TEXT | 日志内容 |
| `created_at` | TEXT | 写入时间 |

#### `user_profile`
Telegram Bot 用户画像，每个 chat_id 一行，每日凌晨更新。

| 列 | 类型 | 说明 |
|----|------|------|
| `chat_id` | TEXT PK | Telegram Chat ID |
| `profile` | TEXT | AI 生成的用户画像文本 |
| `updated_at` | TEXT | 上次更新时间 |

#### `email_records`
完整的邮件处理记录，包含原始正文、AI 分析结果、摘要和 Telegram 通知内容。

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | BIGSERIAL PK | 自增 ID |
| `email_id` | TEXT UNIQUE | Gmail 邮件 ID（去重键）|
| `subject` | TEXT | 邮件主题 |
| `sender` | TEXT | 发件人 |
| `date` | TEXT | 邮件日期 |
| `body` | TEXT | 邮件正文（可能被截断至 4000 字符）|
| `analysis_json` | TEXT | AI 分析结果（JSON 字符串）|
| `summary_json` | TEXT | AI 摘要结果（JSON 字符串）|
| `telegram_msg` | TEXT | 生成的 Telegram HTML 通知文案 |
| `tokens` | INTEGER | 该邮件处理消耗的总 token 数 |
| `priority` | TEXT | 优先级：`high` / `medium` / `low` |
| `sent_telegram` | BOOLEAN | 是否已发送 Telegram 通知 |
| `created_at` | TEXT | 处理时间 |

#### `worker_stats`
每次 Worker 停止时写入一行运行统计。

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | BIGSERIAL PK | 自增 ID |
| `started_at` | TEXT | Worker 本次启动时间 |
| `stopped_at` | TEXT | Worker 本次停止时间 |
| `total_sent` | INTEGER | 本次发送 Telegram 消息数 |
| `total_fetched` | INTEGER | 本次拉取邮件数 |
| `total_errors` | INTEGER | 本次错误数 |
| `total_tokens` | INTEGER | 本次消耗 token 数 |
| `runtime_secs` | INTEGER | 本次运行时长（秒）|
| `last_poll` | TEXT | 最后一次轮询时间 |

### 连接池原理

`app/db.py` 使用 `psycopg2.pool.ThreadedConnectionPool`，配置如下：

```python
_pool = psycopg2.pool.ThreadedConnectionPool(
    minconn=1,   # 最少保持 1 个连接
    maxconn=10,  # 最多 10 个并发连接
    dsn=config.POSTGRES_DSN,
)
```

每次数据库操作通过 `_cur()` 上下文管理器从池中取连接，操作完成后自动归还：

```python
with _cur() as cur:
    cur.execute("SELECT ...")
    rows = cur.fetchall()
# 离开 with 块：成功则 commit，异常则 rollback，连接归还池
```

FastAPI 主线程、邮件 Worker 和 Bot Worker 三者并发访问数据库时，连接池会自动管理并发安全。

### 常用维护命令

```bash
# 进入 psql 交互式命令行
docker exec -it xiaoxin-postgres psql -U postgres -d xiaoxing

# 查看所有表
\dt

# 查看邮件记录数
SELECT COUNT(*) FROM email_records;

# 查看最近 10 条日志
SELECT ts, level, log_type, msg FROM worker_logs ORDER BY id DESC LIMIT 10;

# 清空日志（保留表结构）
DELETE FROM worker_logs;

# 备份数据库
docker exec xiaoxin-postgres pg_dump -U postgres xiaoxing > backup.sql

# 停止/启动容器
docker stop xiaoxin-postgres
docker start xiaoxin-postgres
```

---

## Redis

### 快速启动

使用 Docker 运行 Redis 7（端口 6380 避免与本地 Redis 冲突）：

```bash
docker run -d \
  --name xiaoxin-redis \
  -p 6380:6379 \
  --restart unless-stopped \
  redis:7
```

### 连接配置

在 `.env` 中设置：

```ini
REDIS_URL=redis://localhost:6380
```

`app/core/redis_client.py` 在首次调用时懒初始化连接池，同步和异步各有独立池：

- **同步池**（`redis.ConnectionPool`）：用于 LLM 缓存、会话读写、防重复标记、任务入队  
- **异步池**（`redis.asyncio.ConnectionPool`）：用于任务队列消费（`BRPOP`）

### 键设计与 TTL

| 功能 | Key 格式 | TTL | 说明 |
|------|---------|-----|------|
| LLM 结果缓存 | `llm:cache:<sha256[:24]>` | 3600 s（1 小时） | prompt + max_tokens 的 SHA256 前 24 位 |
| 会话窗口历史 | `chat:history:<chat_id>` | 604800 s（7 天）| Bot 对话滚动窗口（最近 20 轮） |
| 今日对话历史 | `chat:history_today:<chat_id>` | 90000 s（25 小时）| 用于每日画像生成，画像更新后批量删除 |
| 防重复处理 | `dedup:tg:<update_id>` | 600 s（10 分钟） | SET NX；存在则跳过该 update |
| 任务队列 | `queue:chat` | 无（列表）| LPUSH 入队，BRPOP 消费 |

### 四项功能说明

#### 1. LLM 结果缓存

**问题**：相同问题重复调用 LLM 浪费 token 和时间。  
**方案**：对 `prompt + max_tokens` 计算 SHA256，命中则直接返回，不调用 LLM。

```
用户发消息 → chat_reply() → call_llm(prompt)
                                    ↓
                           get_llm_cache(prompt)  命中? → 返回缓存
                                    ↓ 未命中
                           调用 LLM API → set_llm_cache() → 返回结果
```

适合缓存的场景：用户重复发同样的问题、邮件分析 prompt 模板固定时。

#### 2. 会话状态持久化

**问题**：应用重启后 Bot 对话历史丢失，用户需重复背景。  
**方案**：对话历史双写到内存和 Redis，内存命中直接返回，重启后从 Redis 恢复。

```
_get_history(chat_id)
  ├── 内存命中 → 直接返回
  └── 内存未命中 → 从 Redis 加载 → 写入内存缓存 → 返回

_save_history(chat_id, history)
  ├── 更新内存
  └── 写入 Redis（TTL 7 天）
```

今日对话历史（`history_today`）用于每天凌晨生成用户画像，画像写入 PostgreSQL 后批量删除 Redis 键。

#### 3. 防重复处理

**问题**：Telegram `getUpdates` 长轮询在网络抖动时可能重复返回同一条消息。  
**方案**：收到 update 后用 `SET NX EX 600` 原子操作标记 update_id，已存在则跳过。

```python
# 返回 True = 首次处理（可继续）
# 返回 False = 重复（跳过）
if not rc.mark_update(update_id):
    continue
```

Redis 不可达时，`mark_update()` 返回 `True`（不阻断处理），保证可用性。

#### 4. 任务队列

**问题**：消息处理是阻塞操作（LLM 调用可能耗时数秒），`getUpdates` 循环不应被阻塞。  
**方案**：`_loop()` 收到消息后 LPUSH 入队，独立的 `_consumer_loop()` 通过 BRPOP 消费。

```
_loop()                           _consumer_loop()
getUpdates ←── 长轮询 ───→ Telegram
    ↓
mark_update()  (防重复)
    ↓
enqueue(update_id, chat_id, text)  ──→  queue:chat (Redis List)
                                               ↓
                                        BRPOP (timeout=2s)
                                               ↓
                                       _handle_message()
                                               ↓
                                        AI 回复 + 发送
```

若 Redis 不可达（`enqueue()` 返回 `False`），`_loop()` 降级为直接调用 `_handle_message()`，功能不受影响。

### 降级策略

`redis_client.py` 中所有函数遵循同一原则：**Redis 不可达时静默降级，不抛出异常**。

| 函数 | Redis 不可达时的行为 |
|------|---------------------|
| `get_llm_cache()` | 返回 `None`（跳过缓存，直接调 LLM）|
| `set_llm_cache()` | 静默忽略（结果不被缓存）|
| `load_history()` | 返回 `[]`（使用内存缓存）|
| `save_history()` | 静默忽略（内存仍有，仅不持久化）|
| `mark_update()` | 返回 `True`（不阻断处理）|
| `enqueue()` | 返回 `False`（触发降级直接处理）|
| `dequeue()` | 返回 `None`（消费者空转等待）|

### 常用维护命令

```bash
# 进入 Redis CLI
docker exec -it xiaoxin-redis redis-cli -p 6379

# 查看所有键（生产环境谨慎使用）
KEYS *

# 查看 LLM 缓存命中情况
KEYS llm:cache:*

# 查看某个 chat 的对话历史（JSON 格式）
GET chat:history:<chat_id>

# 查看任务队列长度
LLEN queue:chat

# 查看队列中的待处理任务
LRANGE queue:chat 0 -1

# 手动清空某个键
DEL chat:history:<chat_id>

# 清空所有 LLM 缓存
redis-cli -p 6379 KEYS "llm:cache:*" | xargs redis-cli -p 6379 DEL

# 查看内存占用
INFO memory

# 停止/启动容器
docker stop xiaoxin-redis
docker start xiaoxin-redis
```

---

## Docker Compose 一键启动

将以下内容保存为项目根目录的 `docker-compose.yml`，即可一键启动 PostgreSQL 和 Redis：

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    container_name: xiaoxin-postgres
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: xiaoxing
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7
    container_name: xiaoxin-redis
    ports:
      - "6380:6379"
    restart: unless-stopped

volumes:
  postgres_data:
```

启动命令：

```bash
docker compose up -d
```

停止命令：

```bash
docker compose down
```

> PostgreSQL 数据通过 `postgres_data` 卷持久化，删除容器不会丢失数据。Redis 数据重启后清空（无持久化配置），符合缓存定位。

---

## 相关代码文件

| 文件 | 职责 |
|------|------|
| `app/db.py` | PostgreSQL 持久层（连接池、所有 CRUD 函数）|
| `app/core/redis_client.py` | Redis 工具层（四项功能，降级保证）|
| `app/core/llm.py` | LLM 调用层（集成 Redis LLM 缓存）|
| `app/core/bot_worker.py` | Bot Worker（集成会话持久化、防重复、任务队列）|
| `app/config.py` | 配置读取（`POSTGRES_DSN`、`REDIS_URL`）|
