# Xiaoxing AI (小星 AI)

> 多用户 Gmail 自动化 + Telegram 通知平台

[English](README.md)

[![GitHub stars](https://img.shields.io/github/stars/wilsonnnnnd/xiaoxingAI?style=social)](https://github.com/wilsonnnnnd/xiaoxingAI)

如果你觉得本项目对你有帮助，欢迎在 GitHub 上给我们一个 ⭐ 支持，这能帮助更多人发现并维持项目发展。谢谢！

---

## 工作流程

![Xiaoxing AI WorkFlow](app/image/workflow.png)

---

## 截图

![Xiaoxing AI 首页](app/image/Home-zh.png)

---

## 功能特性

| 功能 | 简介 |
|------|------|
|[Gmail 流水线](feature/zh/gmail.md) | 每用户独立 Worker，严格结构化分析 + 摘要 + 确定性 Telegram 渲染，包含统一的邮件处理工作流、优先级过滤和去重 |
|[Telegram 集成](feature/zh/telegram.md) | 邮件推送通知、发信草稿的确认/取消回调按钮、用户绑定 Bot |
|[工具系统](feature/zh/tool-system.md) | 工具注册表 + Router LLM 调度（不可用时关键词降级）；包含发信草稿相关工具 |
|AI Inbox 与规则| 已处理邮件 Inbox（详情弹窗与 URL 同步）、轻量搜索、概览统计、可选 AI 回复草稿，以及持久化自动化规则（创建/编辑/启用/停用/删除） |
|[认证与用户管理](feature/zh/auth.md) | JWT + bcrypt；管理员/普通用户角色；资源按用户隔离；Token 即时吊销 |
|[Prompt 管理](feature/zh/prompts.md) | 内置 Prompt + 每用户覆盖；管理员可在网页端管理所有 Prompt 文件 |
|[Web 界面](feature/zh/ui.md) | 浅色极简 SPA（React + Vite + Tailwind）；仪表盘、技能中心、设置、调试、用户管理；中英双语；移动端友好 |

文档索引：

- UI 设计规范（浅色极简）：[doc/ui-design.md](doc/ui-design.md)
- API 参考： [doc/api.md](doc/api.md)
- 开发指南： [doc/development_guide.md](doc/development_guide.md)
- 部署指南： [doc/deploy.md](doc/deploy.md)
- Worker 运行逻辑： [doc/worker-runtime.md](doc/worker-runtime.md)
- 结构化邮件处理说明： [doc/email-analysis-structured-output.md](doc/email-analysis-structured-output.md)

---

## 系统要求

- Python 3.11+
- Node.js 18+（用于 React 前端）
- Google Cloud OAuth2 凭据（credentials.json）
- PostgreSQL 16+（推荐使用 Docker）
- Redis 7+（推荐使用 Docker，可选 — 不可达时自动降级）
- **LLM 后端**，二选一：
  - 本地：llama.cpp llama-server（监听 127.0.0.1:8001）
  - 云端：OpenAI API Key
- **Router LLM（可选）** — 第二个 llama-server，端口 8002（推荐 Qwen2.5-1.5B），用于 AI 工具调度；不可达时自动降级为关键词匹配

---

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/wilsonnnnnd/xiaoxingAI.git
cd xiaoxingAI
```

### 2. 启动 PostgreSQL & Redis（Docker）

```bash
docker run -d --name pg16 \
  -e POSTGRES_PASSWORD=<change-me> \
  -p 5432:5432 \
  postgres:16

docker run -d --name redis7 \
  -p 6380:6379 \
  redis:7
```

### 3. 安装 Python 依赖

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

### 4. 安装前端依赖

```bash
cd frontend
npm install
cd ..
```

### 5. 配置环境变量

```bash
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux
```

编辑 .env，填入以下内容：

| 变量 | 说明 |
|------|------|
| `ADMIN_USER` | 管理员登录邮箱（例如 admin@local.com） |
| `ADMIN_PASSWORD` | 管理员密码 |
| `JWT_SECRET` | JWT 签名密钥 — **生产环境必须修改** |
| `JWT_EXPIRE_MINUTES` | JWT 有效期（分钟，默认 60） |
| `GMAIL_POLL_INTERVAL` | 默认轮询间隔秒数（默认 300） |
| `GMAIL_POLL_QUERY` | Gmail 默认搜索语法（兜底值，默认 `is:unread in:inbox category:primary`） |
| `GMAIL_POLL_MAX` | 每次最多处理邮件数（默认 5） |
| `GMAIL_MARK_READ` | 处理后是否标记已读（true/false） |
| `AUTO_START_GMAIL_WORKER` | 启动服务时自动启动轮询（默认 false） |
| `GMAIL_WORKER_IO_CONCURRENCY` | Worker IO 并发上限（默认 8） |
| `GMAIL_WORKER_IO_MAX_WORKERS` | Worker 专用线程池大小（默认 12） |
| `GMAIL_WORKER_START_JITTER_MAX` | 首轮错峰最大秒数（默认 15） |
| `GMAIL_WORKER_START_BUCKETS` | 首轮错峰分桶数量（默认 12） |
| `NOTIFY_MIN_PRIORITY` | 推送优先级过滤，逗号分隔；留空则推送全部 |
| `ALLOW_PUBLIC_REGISTER` | 是否允许公开注册（默认 false） |
| `REGISTER_INVITE_CODE` | 可选：在 .env 中配置的“主邀请码”。若设置，该邀请码可直接注册且不会消耗数据库邀请码（推荐留空，使用每码可追踪的邀请码） |
| `REGISTER_EMAIL_ALLOWLIST` | 可选：允许注册的邮箱域名白名单（逗号分隔），如 `gmail.com,company.com` |
| `LLM_BACKEND` | local 或 openai（默认 local） |
| `LLM_API_URL` | LLM API 地址 |
| `LLM_MODEL` | 模型名称 |
| `LLM_API_KEY` | LLM API Key（LLM_BACKEND=openai 时使用；会回退到 OPENAI_API_KEY） |
| `OPENAI_API_KEY` | OpenAI API Key（兼容旧配置） |
| `POSTGRES_DSN` | PostgreSQL 连接字符串（默认 postgresql://postgres:postgres@localhost:5432/xiaoxing） |
| `REDIS_URL` | Redis 连接地址（默认 redis://localhost:6380） |
| `REQUIRE_REDIS` | Redis 不可用时是否直接报错退出（默认 false） |
| `ROUTER_API_URL` | Router LLM 地址（默认 http://127.0.0.1:8002/v1/chat/completions） |
| `ROUTER_MODEL` | Router 模型名称（默认 local-router） |
| `FRONTEND_URL` | 前端来源地址，用于 OAuth 回调和 CORS（默认 http://localhost:5173） |
| `UI_LANG` | 默认 UI 语言，`en` 或 `zh`（默认 en） |
| `TELEGRAM_CALLBACK_SECRET` | Telegram callback_data 签名密钥（按钮确认/取消等操作防伪造） |
| `TELEGRAM_WEBHOOK_BASE_URL` | 可选：后端公网 HTTPS 地址；设置后 Telegram updates 优先使用 webhook，留空或 setWebhook 失败时回退 polling |
| `TELEGRAM_WEBHOOK_SECRET` | 可选：Telegram webhook header 密钥（X-Telegram-Bot-Api-Secret-Token） |
| `OUTGOING_EMAIL_ENCRYPTION_KEY` | 发信草稿正文加密密钥：base64(32 bytes) |
| `OUTGOING_DRAFT_TTL_MINUTES` | 发信草稿有效期（分钟，默认 30） |

### 6. 放置 Google OAuth 凭据

将从 Google Cloud Console 下载的 credentials.json 放到项目根目录。

### 7. 启动后端

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

快速检查：

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/health
```

正常情况下应返回：

```json
{"status":"ok"}
```

首次启动会自动执行：
- 创建 PostgreSQL 数据库结构（用户、机器人、Prompt、邮件、发信草稿、回复格式、日志等表）
- 将 app/prompts/ 下的文件导入为系统内置 Prompt
- 根据 ADMIN_USER / ADMIN_PASSWORD 创建管理员账号

近期后端增强：
- 严格 `EmailAnalysis` 结构化输出校验与安全 fallback 日志
- 统一 `email_processing_flow`，编排分析、规则匹配、动作执行、回复草稿生成与持久化
- 持久化 `email_automation_rules`
- Inbox 接口：`GET /api/emails/processed`、`GET /api/emails/processed/stats`、`GET /api/emails/processed/{id}`（支持 `q` 按主题/发件人搜索）

### 8. 启动前端

**开发模式**（热重载）：
```bash
cd frontend
npm run dev
```
访问：http://localhost:5173

**生产模式**：
```bash
cd frontend
npm run build
```
访问：http://127.0.0.1:8000

### 9. 登录

访问 /login，使用管理员账号密码登录。侧边栏中可见 **用户管理** 入口。

### 10. 完成 Gmail 授权

在设置页面点击 **Authorize via Google**，授权后 token 将自动存入数据库并与当前用户绑定。

---

## Token 获取方式

Telegram Bot Token、Chat ID 和 Google OAuth2 凭据的获取方式见 [support/help.zh.md](support/help.zh.md)。

---

## 项目结构

```
xiaoxing/
├── app/
│   ├── main.py                 # FastAPI 入口、中间件、lifespan
│   ├── api/
│   │   └── routes/             # 每类资源独立文件（auth、users、bots…）
│   ├── core/
│   │   ├── auth.py             # JWT 签发/验证、bcrypt、FastAPI 依赖项
│   │   ├── llm.py              # LLM 客户端（本地 / OpenAI）；3 次退避重试 + Redis 缓存
│   │   ├── redis_client.py     # Redis 工具（LLM 缓存、去重、jwt 版本号等）
│   │   ├── telegram/           # Telegram 客户端（发/改消息、getUpdates 辅助）
│   │   ├── debug/              # 内存调试事件缓冲
│   │   ├── realtime/           # WebSocket 订阅/发布（Gmail & Bot 状态）
│   │   ├── constants.py        # 业务常量
│   │   └── tools/              # 工具注册表 + Router LLM 调度器
│   │       ├── __init__.py     # @register 装饰器，route_and_execute()
│   │       ├── time_tool.py    # get_time — 当前服务器时间
│   │       ├── emails_tool.py  # get_emails — 数据库邮件记录查询
│   │       └── fetch_email_tool.py  # fetch_email — 实时拉取 Gmail + AI 摘要
│   ├── db/
│   │   ├── base.py             # DDL + init_db()（psycopg2）
│   │   ├── session.py          # psycopg2 连接池
│   │   └── repositories/       # 所有 SQL — 每类资源独立文件
│   │       ├── user_repo.py
│   │       ├── bot_repo.py
│   │       ├── prompt_repo.py
│   │       ├── email_repo.py
│   │       ├── log_repo.py
│   │       ├── stats_repo.py
│   │       ├── oauth_repo.py
│   │       ├── outgoing_email_repo.py
│   │       └── reply_format_repo.py
│   ├── schemas/                # Pydantic 请求/响应模型
│   ├── services/               # 业务逻辑层（GmailService、发信草稿相关 service 等）
│   ├── skills/
│   │   └── gmail/
│   │       ├── auth.py         # Google OAuth2 授权流程（按用户存储 token）
│   │       ├── client.py       # Gmail 拉取/解析/标记已读（按用户）
│   │       ├── pipeline.py     # 分析 → 摘要 → Telegram 文案
│   │       ├── schemas.py      # Skill 专用 Pydantic 模型
│   │       └── worker.py       # 多用户 Gmail 轮询 Worker
│   ├── utils/
│   │   ├── json_parser.py      # 从 LLM 输出提取 JSON
│   │   └── prompt_loader.py    # 加载 app/prompts/ 下的文件
│   └── prompts/
│       ├── gmail/
│       │   ├── email_analysis.txt
│       │   ├── email_summary.txt
│       │   └── telegram_notify.txt
│       └── outgoing/           # 发信/回复/改写相关 Prompt
├── frontend/
│   └── src/
│       ├── api/
│       │   └── client.ts       # Axios 实例，含鉴权 + 错误拦截器
│       ├── components/common/  # Button、Card、Modal、InputField、Select、Switch、Badge
│       │   └── form/           # FormInput、FormSelect、FormSwitch（react-hook-form 集成）
│       ├── features/           # 基于功能模块的组织结构（各含 api/、components/、index.ts）
│       │   ├── auth/           # 登录、getMe
│       │   ├── gmail/          # GmailPage、Worker 控制、日志查看
│       │   ├── settings/       # SettingsPage、LLM/Gmail/Bot 子表单
│       │   ├── prompts/        # PromptsPage、Prompt 编辑器
│       │   ├── users/          # UsersPage、用户 & Bot CRUD
│       │   ├── debug/          # DebugPage（管理员）
│       │   └── system/         # 健康检查、DB 统计
│       ├── hooks/              # useHealthCheck、useWorkerStatus、useConfirmDiscard
│       ├── i18n/               # 中英文翻译、Zustand 语言状态
│       ├── types/
│       │   └── index.ts        # 全局共享 TypeScript 类型
│       └── utils/
│           └── formatLog.ts    # 日志消息 i18n 插值格式化
├── credentials.json            # Google OAuth2 凭据（不入 git）
├── .env                        # 运行时配置（不入 git）
├── .env.example
└── requirements.txt
```

---

## 数据库结构

| 表名 | 说明 |
|------|------|
| `user` | 注册用户（管理员 + 普通用户）；角色与鉴权字段 |
| `user_settings` | 每用户设置（轮询间隔、轮询 query、优先级、worker_enabled 等） |
| `bot` | Telegram Bot；每个 Bot 归属一个用户；用于邮件通知（`bot_mode`: `all` / `notify`） |
| `system_prompts` | 系统内置 Prompt 模板（启动时从 `app/prompts/` 自动导入） |
| `user_prompts` | 用户 Prompt 覆盖 |
| `oauth_tokens` | Google OAuth token，每用户一行 |
| `email_records` | 邮件处理记录，包含结构化分析、摘要、回复草稿、处理状态和处理结果快照 |
| `outgoing_email_drafts` | 发信草稿（正文加密）+ 状态机 + Telegram 预览关联 |
| `outgoing_email_actions` | 发信动作审计/流水；也用于幂等（telegram_update_id 唯一） |
| `reply_templates` | 每用户回复格式模板 |
| `reply_format_settings` | 每用户回复格式设置（默认模板 + 署名） |
| `email_automation_rules` | 持久化邮件自动化规则（当前支持 `notify` / `mark_read`） |
| `worker_stats` | Gmail Worker 会话统计，按用户记录 |
| `log` | Worker 日志，含级别、类型和 token 数 |

---

## API 接口

完整接口文档见 [support/api.zh.md](support/api.zh.md)。

---

## 部署说明

如果你需要使用 Nginx、systemd、PostgreSQL、Redis 和 HTTPS 进行正式部署，请参考 [Deployment Guide](doc/deploy.md)。

---

## 更多文档

- [开发扩展指南](doc/development_guide.md)
- [API 文档](doc/api.md)
- [后端设计指南](doc/backend-guide.md)
- [结构化邮件处理说明](doc/email-analysis-structured-output.md)
- [前端 UI 指南](doc/ui-guide.md)
- [帮助文档](support/help.zh.md)

---

## LLM 配置

详见 [LLM 配置 →](feature/zh/llm-configuration.md)。

---

## 注意事项

- credentials.json 包含敏感的 OAuth 客户端密钥，已加入 .gitignore，请勿提交到版本库。
- 每用户的 OAuth token 存储在数据库 oauth_tokens 表中，不写入磁盘文件。
- 首次启动时，若数据库中不存在管理员账号，服务会自动根据 ADMIN_USER / ADMIN_PASSWORD 创建。
- JWT_SECRET 默认值为 change-me-in-production — **生产环境部署前必须修改为强密钥**。
- Redis 为可选依赖；不可达时所有功能自动降级（无缓存、无异步队列）。
- 标准通知流程仍然是：分析 → 摘要 → Telegram 文案。
- 当分析结果建议 `reply` 时，工作流还可以额外生成结构化回复草稿选项（`formal`、`friendly`、`concise`），但不会自动发送。
