# Xiaoxing AI (小星 AI)

> 自动拉取 Gmail 未读邮件 → AI 分析摘要 → Telegram 推送通知


[English](README.md)

---

## 功能特性

- 📥 **Gmail 拉取** — 通过 Google OAuth2 授权，自动轮询主收件箱未读邮件
- 🤖 **AI 分析** — 调用本地 llama.cpp 或 OpenAI 模型对邮件进行分类、优先级判断和摘要
- 📱 **Telegram 推送** — AI 自动撰写 HTML 格式通知消息，发送到指定 Telegram 对话；消息风格可通过 Prompt 完全自定义
- 💬 **Telegram Bot 对话** — 内置'小星 AI'人格 Bot，基于对话历史实时回复 Telegram 消息
- 👤 **用户画像** — AI 自动从聊天记录中构建用户画像，每日凌晨更新并回输入后续对话
- 🗃️ **邮件记录持久化** — 每封处理过的邮件（原始正文、AI 分析、摘要、Telegram 消息、token 数量）均会永久写入 PostgreSQL
- 🔄 **去重保障** — 已处理邮件 ID 持久化到 PostgreSQL；Redis SET NX 驼层防止重复处理（重启后同样生效）
- ⚙️ **优先级过滤** — 可配置只推送 high/medium 优先级邮件
- 🗄️ **PostgreSQL 数据库** — 所有状态（已处理 ID、OAuth token、Worker 日志、邮件记录、用户画像）均存入 PostgreSQL（Docker）
- ⚡ **Redis 缓存与队列** — LLM 结果缓存（1 小时 TTL）、聊天会话持久化（7 天 TTL）、Telegram 消息去重、异步任务队列；Redis 不可达时所有功能自动降级
- 📋 **分类日志与 Token 计量** — Worker 日志按来源（`email` / `chat`）分类，每条记录 Token 用量，主页带颜色徽章显示
- 🔌 **连接测试** — 设置页一键检测 AI / 数据库 / Telegram / Gmail OAuth 连接状态
- 🖥️ **React Web 界面** — 4 页深色主题 SPA（React + TypeScript + Vite + Tailwind CSS）：主页仪表盘、配置设置、Prompt 编辑器、调试工具
- ✏️ **Prompt 编辑器** — 直接在 UI 中编辑、新建、指定各处理阶段的 Prompt 文件
- 🔧 **配置热重载** — 所有设置通过 Web UI 实时生效，无需重启服务
- 🌐 **双语界面** — 支持中文 / 英文切换，语言偏好通过 Zustand 持久化

---

## 截图展示

### 控制面板
![Dashboard](app/image/Home-zh.png)

---

## 系统要求

- Python 3.11+
- Node.js 18+（用于 React 前端）
- Telegram Bot Token + Chat ID
- Google Cloud OAuth2 凭据（`credentials.json`）
- **LLM 后端**，二选一：
  - 本地：llama.cpp `llama-server`（监听 `127.0.0.2:8001`）
  - 云端：OpenAI API Key

---

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd gmailManager
```

### 2. 创建虚拟环境并安装 Python 依赖

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

### 3. 安装前端依赖

```bash
cd frontend
npm install
cd ..
```

### 4. 配置环境变量

```bash
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux
```

编辑 `.env`，填入以下内容（详细获取方式见下方）：

| 变量 | 说明 |
|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot 的 Token |
| `TELEGRAM_CHAT_ID` | 接收通知的 Chat ID |
| `GMAIL_POLL_INTERVAL` | 轮询间隔秒数（默认 300） |
| `GMAIL_POLL_QUERY` | Gmail 搜索语法（默认只拉主收件箱未读） |
| `GMAIL_POLL_MAX` | 每次最多处理邮件数（默认 20） |
| `GMAIL_MARK_READ` | 处理后是否标记已读（true/false） |
| `NOTIFY_MIN_PRIORITY` | 优先级过滤，逗号分隔（high,medium,low 或留空推全部） |
| `LLM_BACKEND` | `local` 或 `openai`（默认 `local`） |
| `LLM_API_URL` | LLM API 地址 |
| `LLM_MODEL` | 模型名称 |
| `OPENAI_API_KEY` | OpenAI API Key（`LLM_BACKEND=openai` 时必填） |
| `PROMPT_ANALYZE` | 邮件分析使用的 Prompt 文件（默认 `email_analysis.txt`） |
| `PROMPT_SUMMARY` | 邮件摘要使用的 Prompt 文件（默认 `email_summary.txt`） |
| `PROMPT_TELEGRAM` | Telegram 消息文案使用的 Prompt 文件（默认 `telegram_notify.txt`） |
| `PROMPT_CHAT` | Telegram Bot 对话回复使用的 Prompt 文件（默认 `chat.txt`） |
| `PROMPT_PROFILE` | 用户画像生成使用的 Prompt 文件（默认 `user_profile.txt`） |
| `POSTGRES_DSN` | PostgreSQL 连接字符串（默认 `postgresql://postgres:postgres@localhost:5432/xiaoxing`） |
| `REDIS_URL` | Redis 连接地址（默认 `redis://localhost:6380`） |

### 5. 放置 Google OAuth 凭据

将从 Google Cloud Console 下载的 `credentials.json` 放到项目根目录。

### 6. 启动后端

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

或使用 BAT 脚本（Windows）：
```bash
启动.bat
```

### 7. 启动前端

**开发模式**（热重载）：
```bash
cd frontend
npm run dev
```
访问：`http://localhost:5173`

**生产模式**（构建后由后端托管）：
```bash
cd frontend
npm run build
```
访问：`http://127.0.0.1:8000`

### 8. 完成 Gmail 授权

点击主页的 **🔑 Authorize via Google** 按钮，或直接访问：
```
http://127.0.0.1:8000/gmail/auth
```

按照 Google 授权页面操作，授权成功后自动生成 `token.json`。

---

## Token 获取方式

### Telegram Bot Token

1. 在 Telegram 搜索 **@BotFather**
2. 发送 `/newbot`
3. 按提示输入 Bot 名称和用户名（必须以 `bot` 结尾）
4. BotFather 返回的 HTTP API Token 即为 `TELEGRAM_BOT_TOKEN`

```
示例：1234567890:ABCdefGhIJKlmNoPQRstuVWXyz
```

### Telegram Chat ID

**方法一（最简单）：** 在 Telegram 搜索 **@userinfobot**，发送任意消息，它会直接回复你的 Chat ID。

**方法二：** 向你的 Bot 发送一条消息，然后访问：
```
https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
```
在返回 JSON 中找到 `message.chat.id` 字段。设置页的 **🔍 Get Chat ID** 按钮也可自动获取。

### Google OAuth2 凭据（credentials.json）

1. 打开 [Google Cloud Console](https://console.cloud.google.com/)
2. 新建或选择一个项目
3. 启用 **Gmail API**：API 和服务 → 库 → 搜索 `Gmail API` → 启用
4. 创建凭据：API 和服务 → 凭据 → 创建凭据 → OAuth 客户端 ID
   - 应用类型选 **桌面应用（Desktop app）**
5. 下载 JSON 文件，重命名为 `credentials.json`，放到项目根目录
6. 点击主页 **Authorize via Google** 完成授权

> ⚠️ `credentials.json` 和 `token.json` 包含敏感信息，已加入 `.gitignore`，请勿提交到版本库。

---

## 项目结构

```
gmailManager/
├── app/
│   ├── main.py                 # FastAPI 入口，所有 API 路由
│   ├── config.py               # 环境变量读取（支持热重载）
│   ├── db.py                   # PostgreSQL 持久层（线程安全连接池，psycopg2）
│   ├── mail/
│   │   ├── auth.py             # Google OAuth2 授权流程（token 存入 DB）
│   │   └── client.py           # Gmail API 拉取/解析/标记已读
│   ├── service/
│   │   ├── ai_service.py       # LLM 调用：邮件分析、摘要、Telegram 文案、Bot 对话、用户画像
│   │   ├── telegram_sender.py  # Telegram 消息发送
│   │   ├── worker.py           # 后台轮询 Worker（步骤日志、邮件记录持久化）
│   │   └── tg_bot_worker.py    # Telegram Bot 长轮询 Worker（对话、用户画像生成）
│   ├── utils/
│   │   ├── json_parser.py      # 从 LLM 输出提取 JSON
│   │   ├── prompt_loader.py    # 加载 app/prompts/ 下的 prompt 文件
│   │   └── telegram.py         # Telegram HTML 消息清洗工具
│   ├── prompts/
│   │   ├── email_analysis.txt  # 邮件分析 prompt
│   │   ├── email_summary.txt   # 邮件摘要 prompt
│   │   └── telegram_notify.txt # Telegram 格式化 prompt
│   └── schemas/
│       └── email.py            # Pydantic 请求模型
├── frontend/                   # React + TypeScript + Vite SPA
│   ├── src/
│   │   ├── api/                # Axios API 客户端 + 类型定义
│   │   ├── components/         # 共享组件（Layout、Sidebar）
│   │   ├── i18n/               # 中英文翻译，Zustand 语言状态管理
│   │   ├── pages/
│   │   │   ├── Home.tsx        # 主页：Worker 控制、Bot 对话日志、步骤日志
│   │   │   ├── Settings.tsx    # 配置编辑器 + 连接测试
│   │   │   ├── Prompts.tsx     # Prompt 文件编辑器 & 阶段分配
│   │   │   └── Debug.tsx       # 手动 AI/Gmail 调试工具
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts          # /api/* 代理到 FastAPI :8000
│   └── package.json
├── credentials.json            # Google OAuth2 凭据（不入 git）
├── .env                        # 运行时配置（不入 git）
├── .env.example
├── requirements.txt
├── 启动.bat                     # Windows：启动 uvicorn
├── README.md
└── README.zh.md
```

---

## Prompt 可定制化

Prompt 文件位于 `app/prompts/*.txt`，项目自带三个内置文件：

- `email_analysis.txt` — 对邮件进行分类、优先级判断和操作建议提取
- `email_summary.txt` — 接收分析结果为输入，输出结构化 JSON（分类、要点、时间地点人物等）
- `telegram_notify.txt` — 定义带占位符的固定 HTML 消息模板，AI 填入字段值，每封邮件通知格式统一

在 **Prompt 编辑器**页面可直接编辑/新建/分配文件，保存后立即生效，无需重启。

---

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 服务健康检查 |
| GET | `/ai/ping` | 测试 AI/LLM 连接 |
| POST | `/ai/analyze` | 单独分析邮件 |
| POST | `/ai/summary` | 单独摘要邮件 |
| POST | `/ai/process` | 完整处理流程：分析 → 摘要 → Telegram 文案 |
| GET | `/gmail/auth` | 跳转 Google OAuth 授权页 |
| GET | `/gmail/callback` | OAuth 回调，换取并保存 token |
| POST | `/gmail/fetch` | 手动拉取邮件 |
| POST | `/gmail/process` | 拉取、处理并将邮件记录写入数据库 |
| POST | `/worker/start` | 启动自动轮询 Worker |
| POST | `/worker/stop` | 停止 Worker |
| GET | `/worker/status` | 查看 Worker 状态 |
| POST | `/worker/poll` | 立即触发一次轮询 |
| GET | `/worker/logs` | 获取步骤日志（`?limit&log_type=email\|chat`） |
| DELETE | `/worker/logs` | 清空 Worker 日志 |
| GET | `/email/records` | 列出持久化的邮件记录（`?limit&priority`） |
| GET | `/email/records/{email_id}` | 获取单条邮件记录 |
| POST | `/telegram/test` | 发送 Telegram 测试消息 |
| GET | `/telegram/chat_id` | 通过 getUpdates 获取最新 chat_id |
| POST | `/telegram/bot/start` | 启动 Telegram Bot 对话 Worker |
| POST | `/telegram/bot/stop` | 停止 Telegram Bot 对话 Worker |
| GET | `/telegram/bot/status` | Bot Worker 运行状态 |
| POST | `/telegram/bot/clear_history` | 清空所有内存对话历史 |
| GET | `/telegram/bot/profile` | 获取 AI 用户画像 |
| DELETE | `/telegram/bot/profile` | 删除用户画像 |
| GET | `/prompts` | 列出所有 prompt 文件 |
| GET | `/prompts/{filename}` | 读取指定 prompt 文件 |
| POST | `/prompts/{filename}` | 新建或覆盖 prompt 文件 |
| DELETE | `/prompts/{filename}` | 删除自定义 prompt（内置文件不可删） |
| GET | `/config` | 读取当前运行时配置 |
| POST | `/config` | 更新 `.env` 并热重载 |
| GET | `/db/stats` | PostgreSQL 数据库统计信息（记录数、token 消耗等） |

交互式文档：`http://127.0.0.1:8000/docs`

---

## 实时状态与前端缓存键

- 后端提供两个独立、前端友好的状态接口：
   - `GET /gmail/workstatus` — 返回 Gmail worker 状态（与 `/worker/status` 结构一致）。
   - `GET /chat/workstatus` — 返回 Chat（Telegram bot）运行状态，格式为 `{ "running": boolean }`。

- 前端使用的 WebSocket 推送接口（通过前端代理为 `/api` 路径）：
   - `/api/ws/worker/status` — 推送 Gmail worker 状态更新。
   - `/api/ws/bot/status` — 推送 Chat（bot）状态更新。

- 前端 API helper（见 `frontend/src/api/index.ts`）：
   - `getGmailWorkStatus()` → 调用 `/gmail/workstatus`
   - `getChatWorkStatus()` → 调用 `/chat/workstatus`

- React Query 缓存键：
   - `['gmailworkstatus']` — Gmail worker 状态缓存
   - `['chatworkstatus']` — Chat（bot）状态缓存

- 说明：状态更新由主页集中管理；前端不再使用旧的 `getBotStatus()` helper。


---

## LLM 配置

| | 本地 llama-server | OpenAI API |
|---|---|---|
| `LLM_BACKEND` | `local` | `openai` |
| `LLM_API_URL` | `http://127.0.0.2:8001/v1/chat/completions` | `https://api.openai.com/v1/chat/completions` |
| `LLM_MODEL` | `local-model` | `gpt-4o-mini`、`gpt-4o` 等 |
| `OPENAI_API_KEY` | 不需要 | `sk-...` |
| 需要 GPU | 是 | 否 |
| 费用 | 免费 | 按 token 计费 |

### 方案 A — 本地 llama-server（默认）

1. 安装 [llama.cpp](https://github.com/ggerganov/llama.cpp) 并下载 GGUF 模型  
   （推荐：`Qwen2.5-14B-Instruct-Q4_K_M.gguf`）
2. 在 `127.0.0.2:8001` 启动 llama-server

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

> 其他兼容 OpenAI 接口的服务（如 Azure OpenAI、Ollama openai shim）也可正常使用，只需调整 `LLM_API_URL` 和对应 Key。

---

## 注意事项

- `credentials.json` 包含敏感的 OAuth 客户端密钥，已加入 `.gitignore`，请勿提交到版本库。
- 所有持久化状态（OAuth token、已处理邮件 ID、邮件记录、用户画像）均存储在 **PostgreSQL** 中。通过 Docker 启动：`docker run -d --name xiaoxin-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=xiaoxing -p 5432:5432 --restart unless-stopped postgres:16-alpine`。
- **Redis**（端口 6380）用于 LLM 结果缓存、聊天会话持久化、Telegram 消息去重和异步任务队列。启动命令：`docker run -d --name xiaoxin-redis -p 6380:6379 --restart unless-stopped redis:7`。Redis 不可达时所有功能自动降级，不影响主流程。
- 每封邮件共进行 **3 次 LLM 调用**：分析 → 结构化摘要 → 模板填充生成 Telegram 消息。三个 Prompt 均可在 UI 中独立配置。
- LLM 调用失败时会自动重试最多 3 次（指数退避）；邮件正文超过 4000 字符时自动截断。相同的 LLM 请求在 Redis 中缓存 1 小时，避免重复调用浪费 token。
- PostgreSQL 层使用**线程安全连接池**（`psycopg2.pool.ThreadedConnectionPool`，min=1、max=10），FastAPI 线程池、邮件 Worker、Bot Worker 并发访问安全
- Worker 日志使用 ISO 时间戳（`YYYY-MM-DDTHH:MM:SS`），按来源（`email` / `chat`）分类，每条记录 Token 用量，在主页以颜色徽章展示。
- Telegram Bot 对话 Worker 与邮件 Worker 独立运行，为每个对话在 Redis 中维护历史记录（7 天 TTL，重启后自动恢复），每天凌晨自动生成 AI 用户画像。
- Telegram 消息以 **HTML 格式**发送。LLM 输出在发送前会自动清洗：Markdown 加粗转为 `<b>`，不支持的标签规范化为换行，未知标签安全转义。
- 详细的数据库表结构、Redis 键设计和基础设施配置说明，请参阅 [doc/database.md](doc/database.md)。

---

## License

MIT
