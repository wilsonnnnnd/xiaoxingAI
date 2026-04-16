# Xiaoxing AI (小星 AI)

> Multi-user Gmail automation + Telegram AI chatbot platform

[中文文档](README.zh.md)

[![GitHub stars](https://img.shields.io/github/stars/wilsonnnnnd/xiaoxingAI?style=social)](https://github.com/wilsonnnnnd/xiaoxingAI)

If you find this project useful, please give it a star on GitHub — it helps others discover the project and supports continued development. Thank you!

---

## Screenshot

![Xiaoxing AI Home](app/image/Home-en.png)

---

## Features

| Feature | Description |
|---------|-------------|
|[Gmail Pipeline](feature/gmail.md) | Per-user Gmail polling worker; 3-stage AI pipeline (classify → summarise → push); priority filter and deduplication |
|[Telegram](feature/telegram.md) | Multi-bot chat + email push notifications; per-bot history, persona, tools; thread-safe |
|[Memory System](feature/memory.md) | Structured long-term memory (`[Facts]` `[Preferences]` `[Events]` `[Personality]`); relevance-filtered injection |
|[Tool System](feature/tool-system.md) | `get_time`, `get_emails`, `fetch_email`; Router LLM dispatch with keyword fallback |
|[Persona Generator](feature/persona.md) | 4-stage AI persona pipeline; identity attributes (zodiac, gender, age) embedded in prompt content |
|[Auth & Users](feature/auth.md) | JWT + bcrypt; admin/user roles; per-user resource isolation; instant token revocation |
|[Prompt Editor](feature/prompts.md) | Built-in + per-user prompts; hot-reloaded on every LLM call; per-bot custom chat prompt |
|[Web UI](feature/ui.md) | Dark SPA (React + Vite + Tailwind); Dashboard, Skills, Settings, Debug, User Management; EN/ZH i18n |

---

## Requirements

- Python 3.11+
- Node.js 18+ (for the React frontend)
- Google Cloud OAuth2 credentials (credentials.json)
- PostgreSQL 16+ (Docker recommended)
- Redis 7+ (Docker recommended, optional — app degrades gracefully)
- **LLM backend** — either:
  - Local: llama.cpp llama-server (listening on 127.0.0.1:8001)
  - Cloud: OpenAI API key
- **Router LLM (optional)** — second llama-server on port 8002 (Qwen2.5-1.5B recommended) for AI-driven tool dispatch; falls back to keyword matching if unavailable

---

## Quick Start

### 1. Clone

```bash
git clone https://github.com/wilsonnnnnd/xiaoxingAI.git
cd xiaoxingAI
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
| `TELEGRAM_CALLBACK_SECRET` | Secret for signing Telegram callback_data (required for inline confirm/cancel buttons) |
| `OUTGOING_EMAIL_ENCRYPTION_KEY` | Base64(32 bytes) key to encrypt outgoing draft bodies |
| `OUTGOING_DRAFT_TTL_MINUTES` | Outgoing draft TTL minutes (default: 30) |

### 6. Place Google Credentials

Download credentials.json from Google Cloud Console and place it in the project root.

### 7. Start the Backend

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Quick checks:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/health
```

You should see:

```json
{"status":"ok"}
```

On first startup the server automatically:
- Creates the PostgreSQL schema (tables for users, bots, prompts, emails, outgoing drafts, reply format, logs, and more)
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
│   ├── main.py                 # FastAPI entry point, middleware, lifespan
│   ├── api/
│   │   └── routes/             # One file per resource group (auth, users, bots, …)
│   ├── core/
│   │   ├── auth.py             # JWT sign/verify, bcrypt, FastAPI deps
│   │   ├── bot_worker.py       # Multi-bot Telegram long-poll workers
│   │   ├── chat.py             # LLM chat reply + user profiling
│   │   ├── llm.py              # LLM client (local / OpenAI); 3-retry + Redis cache
│   │   ├── redis_client.py     # Redis helpers (history, queue, dedup, LLM cache)
│   │   ├── telegram/           # Telegram client (send/edit message, getUpdates helper)
│   │   ├── debug/              # In-memory debug event buffers
│   │   ├── realtime/           # WebSocket pub/sub (Gmail & bot status)
│   │   ├── constants.py        # Business constants
│   │   └── tools/              # Tool registry + Router LLM dispatcher
│   │       ├── __init__.py     # @register decorator, route_and_execute()
│   │       ├── time_tool.py    # get_time — server timestamp
│   │       ├── emails_tool.py  # get_emails — local DB records per user
│   │       └── fetch_email_tool.py  # fetch_email — live Gmail pull + AI summary
│   ├── db/
│   │   ├── base.py             # DDL + init_db() (psycopg2)
│   │   ├── session.py          # psycopg2 connection pool
│   │   └── repositories/       # All SQL — one file per table group
│   │       ├── user_repo.py
│   │       ├── bot_repo.py
│   │       ├── prompt_repo.py
│   │       ├── email_repo.py
│   │       ├── log_repo.py
│   │       ├── stats_repo.py
│   │       ├── oauth_repo.py
│   │       ├── profile_repo.py
│   │       └── persona_repo.py
│   ├── schemas/                # Pydantic request / response models
│   ├── services/               # Business logic (GmailService, TelegramService, …)
│   ├── skills/
│   │   └── gmail/
│   │       ├── auth.py         # Google OAuth2 flow (per-user token storage)
│   │       ├── client.py       # Gmail fetch / parse / mark-as-read (per-user)
│   │       ├── pipeline.py     # analyze → summarise → Telegram message
│   │       ├── schemas.py      # Skill-specific Pydantic models
│   │       └── worker.py       # Multi-user Gmail poll worker
│   ├── utils/
│   │   ├── json_parser.py      # Extract JSON from LLM output
│   │   └── prompt_loader.py    # Load prompt files from app/prompts/
│   └── prompts/
│       ├── chat.txt
│       ├── user_profile.txt
│       ├── gmail/
│       │   ├── email_analysis.txt
│       │   ├── email_summary.txt
│       │   └── telegram_notify.txt
│       └── tools/              # Persona generation prompts
├── frontend/
│   └── src/
│       ├── api/
│       │   └── client.ts       # Axios instance with auth + error interceptors
│       ├── components/common/  # Button, Card, Modal, InputField, Select, Switch, Badge
│       │   └── form/           # FormInput, FormSelect, FormSwitch (react-hook-form)
│       ├── features/           # Feature-based modules (each has api/, components/, index.ts)
│       │   ├── auth/           # Login, getMe
│       │   ├── gmail/          # GmailPage, worker controls, log viewer
│       │   ├── chat/           # ChatPage, bot controls
│       │   ├── settings/       # SettingsPage, LLM/Gmail/Bot sub-forms
│       │   ├── prompts/        # PromptsPage, prompt editor
│       │   ├── users/          # UsersPage, user & bot CRUD
│       │   ├── persona/        # PersonaConfigPage (admin)
│       │   ├── debug/          # DebugPage (admin)
│       │   └── system/         # Health check, DB stats
│       ├── hooks/              # useHealthCheck, useWorkerStatus, useConfirmDiscard
│       ├── i18n/               # EN/ZH catalogs, Zustand language store
│       ├── types/
│       │   └── index.ts        # Shared TypeScript types
│       └── utils/
│           └── formatLog.ts    # Log message i18n interpolation
├── credentials.json            # Google OAuth2 credentials (not in git)
├── .env                        # Runtime config (not in git)
├── .env.example
└── requirements.txt
```

---

## Database Schema

| Table | Description |
|-------|-------------|
| `user` | Registered users; stores per-user worker settings (`min_priority`, `poll_interval`, …) and role |
| `bot` | Telegram Bots; each belongs to one user; supports `bot_mode`: `all` / `notify` / `chat` |
| `system_prompts` | Built-in prompt templates (immutable, seeded from `app/prompts/` on startup) |
| `user_prompts` | Per-user custom prompt overrides; can be bound to a specific bot |
| `oauth_tokens` | Google OAuth tokens, one row per user |
| `email_records` | Processed emails with full AI output (analysis, summary, Telegram message) |
| `outgoing_email_drafts` | Outgoing email drafts (encrypted body) + status machine + Telegram preview binding |
| `outgoing_email_actions` | Outgoing audit/actions log; also used for idempotency (unique telegram_update_id) |
| `reply_templates` | Per-user reply format templates |
| `reply_format_settings` | Per-user reply format settings (default template + signature) |
| `worker_stats` | Gmail worker session stats, per user |
| `user_profile` | AI-generated chat user profile, one row per bot |
| `log` | Worker and chat logs with level, log_type, and token count |

---

## API Reference

See [support/api.md](support/api.md) for the full endpoint reference.

---

## Deployment

For a production setup with Nginx, systemd, PostgreSQL, Redis, and HTTPS, see [Deployment Guide](doc/deploy.md).

---

## More Documentation

- [Development Guide](doc/development_guide.md)
- [Persona Config Guide](doc/persona_config.md)
- [API Reference](doc/api.md)
- [Support Help](support/help.md)

---

## LLM Configuration

See [LLM Configuration →](feature/llm-configuration.md).

---

## Notes

- credentials.json contains sensitive OAuth client secrets — already in .gitignore, never commit it.
- Per-user OAuth tokens are stored in the oauth_tokens database table, not on disk.
- On first startup, if no admin user exists, one is created automatically from ADMIN_USER / ADMIN_PASSWORD.
- JWT_SECRET defaults to change-me-in-production — **always set a strong secret before deploying**.
- Redis is optional; all features degrade gracefully if unavailable (no caching, no async queue).
- Each email triggers 3 LLM calls: analysis → summary → Telegram message. All three prompts are independently configurable from the UI.
