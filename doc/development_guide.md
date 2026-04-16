# Xiaoxing Project Development and Extension Guide

This document summarizes the current project structure and the recommended extension patterns (backend + frontend).

---

## 1. Architecture Overview

The project uses a separated frontend and backend structure:

- Backend: Python FastAPI + PostgreSQL (psycopg2) + optional Redis
- Frontend: React + TypeScript + Vite + Tailwind; TanStack Query for server state; Zustand for i18n/client state

Request flow (backend):

```
HTTP → Route (FastAPI) → Service/Skill → Repository (SQL) → PostgreSQL
                       → Core (Auth / LLM / Redis / Telegram / WebSocket / Tools)
```

Data flow (frontend):

```
Page component → useQuery/useMutation → features/xxx/api → axios client → Backend API
```

---

## 2. Backend Extension Flow

### 2.1 Backend Structure

```
app/
├── main.py              # app entry, middleware, route registration, lifespan
├── api/routes/          # HTTP API layer (one file per resource group)
├── core/                # core tools (JWT, LLM, Redis, Telegram, WebSocket, Tools)
├── db/
│   ├── base.py          # DDL + init_db() (psycopg2)
│   ├── session.py       # psycopg2 connection pool
│   └── repositories/    # data access layer (all SQL)
├── schemas/             # Pydantic request/response models
├── services/            # business logic layer
├── skills/              # complex async modules (e.g. Gmail polling)
└── utils/               # helper functions (prompt_loader, json_parser, ...)
```

### 2.2 Config and Environment Variables (`app/core/config.py`)

All settings come from environment variables (loaded from `.env`). When you add a new config field, add it to `app/core/config.py` and (if needed) to the `/config` API allowlist.

Notes:

- Main LLM key uses `LLM_API_KEY` (falls back to `OPENAI_API_KEY`)
- Default Gmail query fallback is `is:unread in:inbox category:primary`
- `AUTO_START_GMAIL_WORKER` defaults to `false` to avoid blocking startup

### 2.3 Adding a New API Endpoint

1. Create a new router under `app/api/routes/` and define `router = APIRouter()`.
2. Use auth dependencies when needed:
   - `Depends(current_user)` for authenticated routes
   - `Depends(require_admin)` for admin-only routes
3. Register the router in `app/main.py` via `include_router`.

### 2.4 Adding a New Table / Repository

1. Add DDL to `app/db/base.py:init_db()` (`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE IF EXISTS`).
2. Add a repository module in `app/db/repositories/` and implement SQL functions.
3. Re-export repository functions via `app/db/__init__.py` so the rest of the code can call `from app import db`.

### 2.5 Prompts

Prompts are file-based under `app/prompts/` and loaded from disk at runtime via `app/utils/prompt_loader.py`.

Recommended structure:

- `app/prompts/gmail/*` — Gmail pipeline prompts
- `app/prompts/outgoing/*` — outgoing draft prompts
- `app/prompts/tools/*` — internal prompts (e.g. router prompt)

---

## 3. Frontend Extension Flow

Frontend uses a feature-based structure under `frontend/src/features/*`:

- `api/` — typed API clients that call the backend via `frontend/src/api/client.ts`
- `components/` — page-level components
- `types.ts` — feature-local types and zod schemas (when needed)

Global layout/navigation live under `frontend/src/components/`.

---

## 4. Verification

Backend:

```bash
python -m unittest discover -s tests -p "test_*.py"
python -m compileall -q app
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```
