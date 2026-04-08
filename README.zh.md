# Xiaoxing AI (小星 AI)

> 多用户 Gmail 自动化 + Telegram AI 聊天机器人平台


[English](README.md)

---

## 功能特性

- 📥 **Gmail 多账号轮询** — 每个注册用户独立运行一个轮询 Worker，通过 Google OAuth2 授权拉取未读邮件；轮询间隔、最大处理数、优先级过滤均可按用户单独配置
- 🤖 **AI 分析** — 调用本地 llama.cpp 或 OpenAI 模型对邮件进行分类、优先级判断和摘要；结果在 Redis 中缓存（1 小时 TTL）
- 📱 **Telegram 多 Bot 推送** — 每个用户绑定自己的 Telegram Bot，AI 自动撰写 HTML 格式通知并发送到各自的对话
- 💬 **多 Bot 实时对话** — 多个 Telegram Bot 同时运行，每个 Bot 维护独立的对话历史、用户画像，并可绑定自定义系统 Prompt
- 👤 **Bot 用户画像** — AI 从每个 Bot 的聊天记录中构建用户画像，每日凌晨自动更新并融入后续对话
- 🔐 **JWT 身份认证** — 管理员使用 bcrypt 加密密码登录；JWT (HS256) 结合 Redis 版本号控制，支持即时吊销
- 👥 **用户管理** — 管理员可创建和管理普通用户；每个用户自主管理自己的 Gmail Worker、Bot 和 Prompt
- 🗃️ **邮件记录持久化** — 每封处理过的邮件（原始正文、AI 分析、摘要、Telegram 消息、token 数量）均写入 PostgreSQL，按用户隔离
- 🔄 **去重保障** — 已处理邮件 ID 按 (user_id, email_id) 组合存储；Redis SET NX 防止重启后重复处理
- ⚙️ **优先级过滤** — 每用户可配置最低优先级阈值，仅推送达到阈值的邮件
- 🗄️ **PostgreSQL 数据库** — 8 张表：user、bot、prompts、oauth_tokens、email_records、worker_stats、user_profile、log
- ⚡ **Redis 缓存与队列** — LLM 结果缓存、聊天会话持久化（7 天 TTL）、消息去重、异步任务队列；Redis 不可达时自动降级
- 📋 **分类日志与 Token 计量** — 日志按来源（email / chat）分类，每条记录 token 用量，主页带颜色徽章显示
- 🖥️ **React Web 界面** — 深色主题 SPA（React + TypeScript + Vite + Tailwind CSS）：主页仪表盘、配置设置、Prompt 编辑器、调试工具、用户管理
- ✏️ **Prompt 管理** — 系统内置 Prompt + 每用户自定义 Prompt，均可在 UI 中编辑；每个 Bot 可绑定独立的对话 Prompt
- 🔧 **配置热重载** — 所有设置通过 Web UI 实时生效，无需重启服务
- 🌐 **双语界面** — 支持中文 / 英文切换，语言偏好通过 Zustand 持久化

---

## 系统要求

- Python 3.11+
- Node.js 18+（用于 React 前端）
- Google Cloud OAuth2 凭据（credentials.json）
- PostgreSQL 16+（推荐使用 Docker）
- Redis 7+（推荐使用 Docker，可选 — 不可达时自动降级）
- **LLM 后端**，二选一：
  - 本地：llama.cpp llama-server（监听 127.0.0.2:8001）
  - 云端：OpenAI API Key

---

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd xiaoxing
```

### 2. 启动 PostgreSQL & Redis（Docker）

```bash
docker run -d --name pg16 \
  -e POSTGRES_PASSWORD=postgres \
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
| `GMAIL_POLL_QUERY` | Gmail 搜索语法（默认 is:unread in:inbox） |
| `GMAIL_POLL_MAX` | 每次最多处理邮件数（默认 20） |
| `GMAIL_MARK_READ` | 处理后是否标记已读（true/false） |
| `NOTIFY_MIN_PRIORITY` | 推送优先级过滤，逗号分隔；留空则推送全部 |
| `LLM_BACKEND` | local 或 openai（默认 local） |
| `LLM_API_URL` | LLM API 地址 |
| `LLM_MODEL` | 模型名称 |
| `OPENAI_API_KEY` | OpenAI API Key（LLM_BACKEND=openai 时必填） |
| `POSTGRES_DSN` | PostgreSQL 连接字符串（默认 postgresql://postgres:postgres@localhost:5432/xiaoxing） |
| `REDIS_URL` | Redis 连接地址（默认 redis://localhost:6380） |

### 6. 放置 Google OAuth 凭据

将从 Google Cloud Console 下载的 credentials.json 放到项目根目录。

### 7. 启动后端

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

首次启动会自动执行：
- 创建 PostgreSQL 数据库结构（8 张表）
- 将 app/prompts/ 下的文件导入为系统内置 Prompt
- 根据 ADMIN_USER / ADMIN_PASSWORD 创建管理员账号

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

### Telegram Bot Token

1. 在 Telegram 搜索 **@BotFather**
2. 发送 /newbot
3. 按提示输入 Bot 名称和用户名（必须以 bot 结尾）
4. BotFather 返回的 HTTP API Token 即为所需 Token

```
示例：1234567890:ABCdefGhIJKlmNoPQRstuVWXyz
```

### Telegram Chat ID

**方法一（最简单）：** 在 Telegram 搜索 **@userinfobot**，发送任意消息，它会直接回复你的 Chat ID。

**方法二：** 向你的 Bot 发送一条消息，然后访问：
```
https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
```
在返回 JSON 中找到 message.chat.id 字段。设置页的 **Get Chat ID** 按钮也可自动获取。

### Google OAuth2 凭据（credentials.json）

1. 打开 [Google Cloud Console](https://console.cloud.google.com/)
2. 新建或选择一个项目
3. 启用 **Gmail API**：API 和服务 → 库 → 搜索 Gmail API → 启用
4. 创建凭据：API 和服务 → 凭据 → 创建凭据 → OAuth 客户端 ID
   - 应用类型选 **桌面应用（Desktop app）**
5. 下载 JSON 文件，重命名为 credentials.json，放到项目根目录

> credentials.json 包含敏感的 OAuth 客户端密钥，已加入 .gitignore，请勿提交到版本库。

---

## 项目结构

```
xiaoxing/
├── app/
│   ├── main.py                 # FastAPI 入口，所有 API 路由
│   ├── config.py               # 环境变量读取（支持热重载）
│   ├── db.py                   # PostgreSQL 持久层（8 表多用户架构）
│   ├── core/
│   │   ├── auth.py             # JWT 认证、bcrypt 密码、FastAPI 依赖注入
│   │   ├── bot_worker.py       # 多 Bot Telegram 长轮询 Worker
│   │   ├── chat.py             # LLM 对话回复逻辑
│   │   ├── llm.py              # LLM 客户端（本地 / OpenAI）
│   │   ├── redis_client.py     # Redis 工具（历史、队列、去重）
│   │   ├── telegram.py         # Telegram 消息发送 + HTML 清洗
│   │   └── ws.py               # WebSocket 推送（Worker / Bot 状态）
│   ├── skills/
│   │   └── gmail/
│   │       ├── auth.py         # Google OAuth2 授权流程（按用户存储 token）
│   │       ├── client.py       # Gmail 拉取/解析/标记已读（按用户）
│   │       ├── pipeline.py     # 邮件分析 → 摘要 → Telegram 文案
│   │       ├── schemas.py      # Pydantic 请求模型
│   │       └── worker.py       # 多用户 Gmail 轮询 Worker
│   ├── utils/
│   │   ├── json_parser.py      # 从 LLM 输出提取 JSON
│   │   └── prompt_loader.py    # 加载 app/prompts/ 下的文件
│   └── prompts/
│       ├── chat.txt
│       ├── user_profile.txt
│       └── gmail/
│           ├── email_analysis.txt
│           ├── email_summary.txt
│           └── telegram_notify.txt
├── frontend/
│   └── src/
│       ├── api/                # Axios 客户端 + 类型定义
│       ├── components/         # Layout、Sidebar
│       ├── i18n/               # 中英文翻译，Zustand 语言状态
│       └── pages/
│           ├── Home.tsx        # 主页：Worker 控制、步骤日志
│           ├── Settings.tsx    # 配置编辑器 + 连接测试
│           ├── Prompts.tsx     # Prompt 文件编辑器
│           ├── Debug.tsx       # 手动 AI/Gmail 调试工具
│           ├── Users.tsx       # 用户与 Bot 管理（管理员）
│           ├── Login.tsx       # JWT 登录页
│           └── skills/
│               ├── Chat.tsx
│               └── Gmail.tsx
├── credentials.json            # Google OAuth2 凭据（不入 git）
├── .env                        # 运行时配置（不入 git）
├── .env.example
└── requirements.txt
```

---

## 数据库结构

| 表名 | 说明 |
|------|------|
| `user` | 注册用户（管理员 + 普通用户）；存储每用户的 Worker 配置和角色 |
| `bot` | Telegram Bot；每个 Bot 归属一个用户，可绑定自定义对话 Prompt |
| `prompts` | Prompt 模板；user_id IS NULL = 系统内置，否则为用户私有 |
| `oauth_tokens` | Google OAuth token，每用户一行 |
| `email_records` | 邮件处理记录，按 user_id 隔离 |
| `worker_stats` | Gmail Worker 会话统计，按用户记录 |
| `user_profile` | AI 生成的对话用户画像，每 bot_id 一行 |
| `log` | Worker 和对话日志，按用户记录 |

---

## API 接口

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/login` | 管理员登录 → JWT |
| GET | `/auth/me` | 当前用户信息 |

### 用户管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/users` | 列出所有用户（仅管理员） |
| POST | `/users` | 创建普通用户（仅管理员） |
| GET | `/users/{id}` | 获取用户（本人或管理员） |
| PUT | `/users/{id}` | 更新用户设置（本人或管理员） |

### Bot 管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/users/{id}/bots` | 列出用户的所有 Bot |
| POST | `/users/{id}/bots` | 创建 Bot |
| PUT | `/users/{id}/bots/{bot_id}` | 更新 Bot |
| DELETE | `/users/{id}/bots/{bot_id}` | 删除 Bot |
| POST | `/users/{id}/bots/{bot_id}/set-default` | 设为默认 Bot |

### Prompt 管理（数据库版）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/db/prompts` | 列出 Prompt（系统内置 + 本人创建） |
| POST | `/db/prompts` | 创建自定义 Prompt |
| PUT | `/db/prompts/{id}` | 更新 Prompt |
| DELETE | `/db/prompts/{id}` | 删除 Prompt |

### Gmail Worker
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/worker/start` | 启动所有已启用用户的 Worker |
| POST | `/worker/stop` | 停止所有 Worker |
| GET | `/worker/status` | 聚合状态 |
| POST | `/worker/poll` | 立即触发一次轮询 |
| GET | `/worker/logs` | 获取日志 |
| DELETE | `/worker/logs` | 清空日志 |
| GET | `/gmail/auth` | 跳转 Google OAuth 授权页 |
| GET | `/gmail/callback` | OAuth 回调，保存 token |

### Telegram Bot
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/telegram/bot/start` | 启动所有已注册 Bot |
| POST | `/telegram/bot/stop` | 停止所有 Bot |
| GET | `/telegram/bot/status` | Bot 运行状态 |
| POST | `/telegram/bot/clear_history` | 清空所有对话历史 |
| GET | `/telegram/bot/profile` | 获取用户画像 |
| DELETE | `/telegram/bot/profile` | 删除用户画像 |
| POST | `/telegram/bot/generate_profile` | 手动触发画像生成 |

### 邮件记录 & 配置
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/email/records` | 列出邮件记录 |
| GET | `/email/records/{email_id}` | 获取单条邮件记录 |
| GET | `/config` | 读取当前运行时配置 |
| POST | `/config` | 更新 .env 并热重载 |
| GET | `/db/stats` | 数据库统计信息 |
| GET | `/health` | 健康检查 |
| GET | `/ai/ping` | 测试 LLM 连接 |

交互式文档：http://127.0.0.1:8000/docs

---

## LLM 配置

| | 本地 llama-server | OpenAI API |
|---|---|---|
| `LLM_BACKEND` | local | openai |
| `LLM_API_URL` | http://127.0.0.2:8001/v1/chat/completions | https://api.openai.com/v1/chat/completions |
| `LLM_MODEL` | local-model | gpt-4o-mini、gpt-4o 等 |
| `OPENAI_API_KEY` | 不需要 | sk-... |
| 需要 GPU | 是 | 否 |
| 费用 | 免费 | 按 token 计费 |

### 方案 A — 本地 llama-server（默认）

1. 安装 [llama.cpp](https://github.com/ggerganov/llama.cpp) 并下载 GGUF 模型
   （推荐：Qwen2.5-14B-Instruct-Q4_K_M.gguf）
2. 在 127.0.0.2:8001 启动 llama-server

```ini
LLM_BACKEND=local
LLM_API_URL=http://127.0.0.2:8001/v1/chat/completions
LLM_MODEL=local-model
```

### 方案 B — OpenAI API

```ini
LLM_BACKEND=openai
LLM_API_URL=https://api.openai.com/v1/chat/completions
LLM_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-...
```

> 其他兼容 OpenAI 接口的服务（如 Azure OpenAI、Ollama openai shim）也可正常使用，只需调整 LLM_API_URL 和对应 Key。

---

## 注意事项

- credentials.json 包含敏感的 OAuth 客户端密钥，已加入 .gitignore，请勿提交到版本库。
- 每用户的 OAuth token 存储在数据库 oauth_tokens 表中，不写入磁盘文件。
- 首次启动时，若数据库中不存在管理员账号，服务会自动根据 ADMIN_USER / ADMIN_PASSWORD 创建。
- JWT_SECRET 默认值为 change-me-in-production — **生产环境部署前必须修改为强密钥**。
- Redis 为可选依赖；不可达时所有功能自动降级（无缓存、无异步队列）。
- 每封邮件触发 3 次 LLM 调用：分析 → 摘要 → Telegram 文案，三个阶段的 Prompt 均可通过 UI 独立配置。
