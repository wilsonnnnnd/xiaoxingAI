# Environment Variables

## Purpose

This document groups the main environment variables by responsibility.
Use `.env.example` as the canonical variable list.

## Auth and registration

- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `JWT_SECRET`
- `JWT_EXPIRE_MINUTES`
- `ALLOW_PUBLIC_REGISTER`
- `REGISTER_INVITE_CODE`
- `REGISTER_EMAIL_ALLOWLIST`

## Database and Redis

- `POSTGRES_DSN`
- `SUPABASE_DB_DSN`
- `DB_POOL_MINCONN`
- `DB_POOL_MAXCONN`
- `DB_SSLMODE`
- `DB_ALLOW_LEGACY_DROP`
- `REDIS_URL`

## Gmail and worker

- `GMAIL_POLL_INTERVAL`
- `GMAIL_POLL_QUERY`
- `GMAIL_POLL_MAX`
- `GMAIL_MARK_READ`
- `GMAIL_WORKER_IO_CONCURRENCY`
- `GMAIL_WORKER_IO_MAX_WORKERS`
- `GMAIL_WORKER_START_JITTER_MAX`
- `GMAIL_WORKER_START_BUCKETS`
- `NOTIFY_MIN_PRIORITY`

## AI and pricing

- `LLM_BACKEND`
- `LLM_API_URL`
- `LLM_MODEL`
- `LLM_API_KEY`
- `OPENAI_API_KEY`
- `ROUTER_API_URL`
- `ROUTER_MODEL`
- `ROUTER_API_KEY`
- `AI_PRICING_JSON`

## Telegram

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_CALLBACK_SECRET`
- `TELEGRAM_WEBHOOK_BASE_URL`
- `TELEGRAM_WEBHOOK_SECRET`

## Frontend and UI

- `FRONTEND_URL`
- `UI_LANG`

## Outgoing flows

- `OUTGOING_EMAIL_ENCRYPTION_KEY`
- `OUTGOING_DRAFT_TTL_MINUTES`

## Guidance

- keep secrets out of version control
- treat `.env.example` as the authoritative variable inventory
- document deployment-specific values outside the repository when needed
