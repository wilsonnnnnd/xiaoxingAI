# Xiaoxing AI (小星 AI)

> 多用户 Gmail 自动化 + Telegram AI 聊天机器人平台

[English](README.md)

[![GitHub stars](https://img.shields.io/github/stars/wilsonnnnnd/xiaoxingAI?style=social)](https://github.com/wilsonnnnnd/xiaoxingAI)

如果你觉得本项目对你有帮助，欢迎在 GitHub 上给我们一个 ⭐ 支持，这能帮助更多人发现并维持项目发展。谢谢！

---

## 功能特性

| 功能 | 简介 |
|------|------|
|[Gmail 流水线](feature/zh/gmail.md) | 每用户独立 Worker，4 阶段 AI 流水线（分类→摘要→推送），支持优先级过滤和去重 |
|[Telegram 推送](feature/zh/telegram-push.md) | 每用户绑定自己的 Bot，AI 自动撰写 HTML 通知，邮件处理后即时推送 |
|[Telegram 聊天](feature/zh/telegram-chat.md) | 多 Bot 并发对话，各自维护对话历史、人格提示词和工具访问权限，线程安全 |
|[记忆系统](feature/zh/memory.md) | 结构化长期记忆（`[事实]` `[偏好]` `[近期事件]` `[性格观察]`），按相关性筛选注入 |
|[工具系统](feature/zh/tool-system.md) | `get_time`、`get_emails`、`fetch_email`；Router LLM 调度，关键词降级兜底 |
|[人格生成器](feature/zh/persona.md) | 4 阶段 AI 人格生成流水线，身份属性（星座/性别/年龄感）内嵌到 Prompt 内容 |
|[认证与用户管理](feature/zh/auth.md) | JWT + bcrypt；管理员/普通用户角色；资源按用户隔离；Token 即时吊销 |
|[Prompt 管理](feature/zh/prompts.md) | 内置 + 每用户自定义 Prompt，每次 LLM 调用热重载；每个 Bot 可绑定聊天 Prompt |
|[Web 界面](feature/zh/ui.md) | 深色主题 SPA（React + Vite + Tailwind）；仪表盘、技能中心、设置、调试、用户管理；中英双语 |

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
- **Router LLM（可选）** — 第二个 llama-server，端口 8002（推荐 Qwen2.5-1.5B），用于 AI 工具调度；不可该地址时自动降级为关键词匹配

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
| `ROUTER_API_URL` | Router LLM 地址（默认 http://127.0.0.1:8002/v1/chat/completions） |
| `ROUTER_MODEL` | Router 模型名称（默认 local-router） |
| `FRONTEND_URL` | 前端来源地址，用于 OAuth 回调和 CORS（默认 http://localhost:5173） |
| `UI_LANG` | 默认 UI 语言，`en` 或 `zh`（默认 en） |

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

Telegram Bot Token、Chat ID 和 Google OAuth2 凭据的获取方式见 [support/help.zh.md](support/help.zh.md)。

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
│   │   ├── ws.py               # WebSocket 推送（Worker / Bot 状态）
│   │   └── tools/              # 工具注册表 + Router LLM 调度器
│   │       ├── __init__.py     # 工具注册表、route_and_execute()
│   │       ├── time_tool.py    # get_time — 当前服务器时间
│   │       ├── emails_tool.py  # get_emails — 数据库邮件记录查询
│   │       └── fetch_email_tool.py  # fetch_email — 实时拉取 Gmail + AI 摘要
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
│       ├── router.txt          # 工具调度 Prompt（内部使用，不在 UI 中显示）
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
│           ├── Home.tsx        # 主页：服务健康状态、快速入口
│           ├── Skill.tsx       # 技能中心首页（Gmail / Chat）
│           ├── Settings.tsx    # 配置编辑器 + 连接测试
│           ├── Prompts.tsx     # Prompt 文件编辑器
│           ├── Debug.tsx       # 手动 AI/Gmail 调试工具
│           ├── Users.tsx       # 用户与 Bot 管理（管理员）
│           ├── Login.tsx       # JWT 登录页
│           └── skills/
│               ├── Gmail.tsx   # Gmail Worker 控制面板 + 实时日志
│               └── Chat.tsx    # Telegram Bot 控制面板 + 实时日志
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

完整接口文档见 [support/api.zh.md](support/api.zh.md)。

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

### 方案 C — Router LLM（可选，用于工具调度）

第二个轻量级模型专门处理工具意图检测，主模型专注于对话回复。

1. 在 127.0.0.1:8002 启动第二个 llama-server，加载轻量级模型（推荐 Qwen2.5-1.5B）
2. 在 `.env` 中配置：

```ini
ROUTER_API_URL=http://127.0.0.1:8002/v1/chat/completions
ROUTER_MODEL=local-router
```

如果未配置 `ROUTER_API_URL` 或端点不可达，工具调度将自动降级为关键词匹配。

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
