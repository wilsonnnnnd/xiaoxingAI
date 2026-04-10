# Xiaoxing AI (小星 AI)

> Multi-user Gmail automation + Telegram AI chatbot platform

[中文文档](README.zh.md)

---

## Features

| Feature | Description |
|---------|-------------|
| 📥 [Gmail Pipeline](feature/gmail.md) | Per-user Gmail polling worker; 4-stage AI pipeline (classify → summarise → push); priority filter and deduplication |
| 📱 [Telegram Push](feature/telegram-push.md) | Each user binds their own bot; AI-written HTML notifications delivered after email processing |
| 💬 [Telegram Chat](feature/telegram-chat.md) | Multi-bot concurrent chat; per-bot history, persona, and tool access; thread-safe |
| 🧠 [Memory System](feature/memory.md) | Structured long-term memory (`[Facts]` `[Preferences]` `[Events]` `[Personality]`); relevance-filtered injection |
| 🛠️ [Tool System](feature/tool-system.md) | `get_time`, `get_emails`, `fetch_email`; Router LLM dispatch with keyword fallback |
| 🎭 [Persona Generator](feature/persona.md) | 4-stage AI persona pipeline; identity attributes (zodiac, gender, age) embedded in prompt content |
| 🔐 [Auth & Users](feature/auth.md) | JWT + bcrypt; admin/user roles; per-user resource isolation; instant token revocation |
| ✏️ [Prompt Editor](feature/prompts.md) | Built-in + per-user prompts; hot-reloaded on every LLM call; per-bot custom chat prompt |
| 🖥️ [Web UI](feature/ui.md) | Dark SPA (React + Vite + Tailwind); Dashboard, Skills, Settings, Debug, User Management; EN/ZH i18n |

---

## Requirements

- Python 3.11+
- Node.js 18+ (for the React frontend)
- Google Cloud OAuth2 credentials (credentials.json)
- PostgreSQL 16+ (Docker recommended)
- Redis 7+ (Docker recommended, optional — app degrades gracefully)
- **LLM backend** — either:
  - Local: llama.cpp llama-server (listening on 127.0.0.2:8001)
  - Cloud: OpenAI API key
- **Router LLM (optional)** — second llama-server on port 8002 (Qwen2.5-1.5B recommended) for AI-driven tool dispatch; falls back to keyword matching if unavailable

---

## Quick Start

### 1. Clone

```bash
git clone <repository-url>
cd xiaoxing
```

### 2. Start PostgreSQL & Redis (Docker)

```bash
docker run -d --name pg16 \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16

docker run -d --name redis7 \
  -p 6380:6379 \
  redis:7
```

### 3. Install Python Dependencies

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

### 4. Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### 5. Configure Environment

```bash
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux
```

Edit `.env`:

| Variable | Description |
|----------|-------------|
| `ADMIN_USER` | Admin login email (e.g. admin@local.com) |
| `ADMIN_PASSWORD` | Admin password |
| `JWT_SECRET` | Secret key for signing JWTs — **change this in production** |
| `JWT_EXPIRE_MINUTES` | JWT lifetime in minutes (default: 60) |
| `GMAIL_POLL_INTERVAL` | Default poll interval in seconds (default: 300) |
| `GMAIL_POLL_QUERY` | Gmail search query (default: is:unread in:inbox) |
| `GMAIL_POLL_MAX` | Max emails per poll (default: 20) |
| `GMAIL_MARK_READ` | Mark as read after processing (true/false) |
| `NOTIFY_MIN_PRIORITY` | Comma-separated priorities to notify; leave empty for all |
| `LLM_BACKEND` | local or openai (default: local) |
| `LLM_API_URL` | LLM endpoint URL |
| `LLM_MODEL` | Model name |
| `OPENAI_API_KEY` | OpenAI API key (required when LLM_BACKEND=openai) |
| `POSTGRES_DSN` | PostgreSQL DSN (default: postgresql://postgres:postgres@localhost:5432/xiaoxing) |
| `REDIS_URL` | Redis URL (default: redis://localhost:6380) |
| `ROUTER_API_URL` | Router LLM endpoint (default: http://127.0.0.1:8002/v1/chat/completions) |
| `ROUTER_MODEL` | Router model name (default: local-router) |
| `FRONTEND_URL` | Frontend origin for OAuth callback and CORS (default: http://localhost:5173) |
| `UI_LANG` | Default UI language — `en` or `zh` (default: en) |

### 6. Place Google Credentials

Download credentials.json from Google Cloud Console and place it in the project root.

### 7. Start the Backend

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

On first startup the server automatically:
- Creates the PostgreSQL schema (8 tables)
- Imports built-in prompts from app/prompts/
- Creates the admin account from ADMIN_USER / ADMIN_PASSWORD

### 8. Start the Frontend

**Development mode** (hot reload):
```bash
cd frontend
npm run dev
```
Open: http://localhost:5173

**Production mode:**
```bash
cd frontend
npm run build
```
Then open: http://127.0.0.1:8000

### 9. Log In

Navigate to /login and sign in with your admin credentials. The sidebar shows **Users** for user management.

### 10. Authorize Gmail per User

On the Settings page, click **Authorize via Google** while logged in — the OAuth token is stored scoped to your account.

---

## How to Get Tokens

See [support/help.md](support/help.md) for Telegram Bot Token, Chat ID, and Google OAuth2 credentials setup.

---

## Project Structure

```
xiaoxing/
├── app/
│   ├── main.py                 # FastAPI entry point, all API routes
│   ├── config.py               # Environment variable loader (hot-reloadable)
│   ├── db.py                   # PostgreSQL layer — 8-table multi-user schema
│   ├── core/
│   │   ├── auth.py             # JWT auth, bcrypt hashing, FastAPI deps
│   │   ├── bot_worker.py       # Multi-bot Telegram long-poll workers
│   │   ├── chat.py             # LLM chat reply logic
│   │   ├── llm.py              # LLM client (local / OpenAI)
│   │   ├── redis_client.py     # Redis helpers (history, queue, dedup)
│   │   ├── telegram.py         # Telegram sender + HTML sanitiser
│   │   ├── ws.py               # WebSocket publisher (status push)
│   │   └── tools/              # Tool registry + Router LLM dispatcher
│   │       ├── __init__.py     # Registry, route_and_execute()
│   │       ├── time_tool.py    # get_time — server timestamp
│   │       ├── emails_tool.py  # get_emails — DB records per user
│   │       └── fetch_email_tool.py  # fetch_email — live Gmail pull + AI summary
│   ├── skills/
│   │   └── gmail/
│   │       ├── auth.py         # Google OAuth2 flow (per-user token storage)
│   │       ├── client.py       # Gmail fetch / parse / mark-as-read (per-user)
│   │       ├── pipeline.py     # Email analysis → summary → Telegram message
│   │       ├── schemas.py      # Pydantic request models
│   │       └── worker.py       # Multi-user Gmail poll worker
│   ├── utils/
│   │   ├── json_parser.py      # Extract JSON from LLM output
│   │   └── prompt_loader.py    # Load prompt files from app/prompts/
│   └── prompts/
│       ├── chat.txt
│       ├── router.txt          # Tool dispatch prompt (internal, not shown in UI)
│       ├── user_profile.txt
│       └── gmail/
│           ├── email_analysis.txt
│           ├── email_summary.txt
│           └── telegram_notify.txt
├── frontend/
│   └── src/
│       ├── api/                # Axios client + typed interfaces
│       ├── components/         # Layout, Sidebar
│       ├── i18n/               # EN/ZH translations, Zustand language store
│       └── pages/
│           ├── Home.tsx        # Dashboard: health status, quick links
│           ├── Skill.tsx       # Skills hub index (Gmail / Chat)
│           ├── Settings.tsx    # Config editor + connection tests
│           ├── Prompts.tsx     # Prompt file editor
│           ├── Debug.tsx       # Manual AI/Gmail debug tools
│           ├── Users.tsx       # User & bot management (admin)
│           ├── Login.tsx       # JWT login page
│           └── skills/
│               ├── Gmail.tsx   # Gmail worker controls + live log
│               └── Chat.tsx    # Telegram bot controls + live log
├── credentials.json            # Google OAuth2 credentials (not in git)
├── .env                        # Runtime config (not in git)
├── .env.example
└── requirements.txt
```

---

## Database Schema

| Table | Description |
|-------|-------------|
| `user` | Registered users; stores per-user worker settings and role |
| `bot` | Telegram Bots; each belongs to one user, optional custom chat prompt |
| `prompts` | Prompt templates; user_id IS NULL = system built-in, otherwise per-user |
| `oauth_tokens` | Google OAuth tokens, one row per user |
| `email_records` | Processed emails, isolated per user_id |
| `worker_stats` | Gmail worker session stats, per user |
| `user_profile` | AI-generated chat profile, one row per bot_id |
| `log` | Worker and chat logs, per user |

---

## API Reference

See [support/api.md](support/api.md) for the full endpoint reference.

---

## LLM Configuration

| | Local llama-server | OpenAI API |
|---|---|---|
| `LLM_BACKEND` | local | openai |
| `LLM_API_URL` | http://127.0.0.2:8001/v1/chat/completions | https://api.openai.com/v1/chat/completions |
| `LLM_MODEL` | local-model | gpt-4o-mini, gpt-4o, etc. |
| `OPENAI_API_KEY` | not needed | sk-... |
| Requires GPU | Yes | No |
| Cost | Free | Per-token billing |

### Option A — Local llama-server (default)

1. Install [llama.cpp](https://github.com/ggerganov/llama.cpp) and download a GGUF model
   (recommended: Qwen2.5-14B-Instruct-Q4_K_M.gguf)
2. Start llama-server on 127.0.0.2:8001

```ini
LLM_BACKEND=local
LLM_API_URL=http://127.0.0.2:8001/v1/chat/completions
LLM_MODEL=local-model
```

### Option C — Router LLM (optional, for tool dispatch)

A second, lightweight model handles tool intent detection; the main LLM handles chat replies.

1. Start a second llama-server on 127.0.0.1:8002 with a small model (Qwen2.5-1.5B recommended)
2. Set in `.env`:

```ini
ROUTER_API_URL=http://127.0.0.1:8002/v1/chat/completions
ROUTER_MODEL=local-router
```

If `ROUTER_API_URL` is not set or the endpoint is unreachable, tool dispatch falls back to keyword matching automatically.

### Option B — OpenAI API

```ini
LLM_BACKEND=openai
LLM_API_URL=https://api.openai.com/v1/chat/completions
LLM_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-...
```

> Any OpenAI-compatible API (e.g. Azure OpenAI, Ollama with openai shim) works by adjusting LLM_API_URL and OPENAI_API_KEY.

---

## Notes

- credentials.json contains sensitive OAuth client secrets — already in .gitignore, never commit it.
- Per-user OAuth tokens are stored in the oauth_tokens database table, not on disk.
- On first startup, if no admin user exists, one is created automatically from ADMIN_USER / ADMIN_PASSWORD.
- JWT_SECRET defaults to change-me-in-production — **always set a strong secret before deploying**.
- Redis is optional; all features degrade gracefully if unavailable (no caching, no async queue).
- Each email triggers 3 LLM calls: analysis → summary → Telegram message. All three prompts are independently configurable from the UI.
