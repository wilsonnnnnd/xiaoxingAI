# Gmail Polling & AI Email Pipeline

## Overview

Each registered user runs an independent Gmail polling worker. When new emails arrive they pass through a 4-stage AI pipeline and are pushed to Telegram.

```
Gmail (OAuth2) → AI Analysis → Telegram Push
```

## How It Works

### 1. Gmail Polling

- Each user authorises their Gmail account via Google OAuth2 (Settings page → "Authorize via Google")
- A background worker polls the inbox on a configurable interval (default: 300 s)
- Only emails matching the search query (default: `is:unread in:inbox`) are fetched
- OAuth tokens are encrypted and stored per-user in PostgreSQL

### 2. AI Analysis Pipeline

Each email is passed through 4 LLM calls:

| Step | Prompt | Output |
|------|--------|--------|
| 1. Classify | `email_analysis.txt` | Priority (urgent/normal/low) + category |
| 2. Summarise | `email_summary.txt` | Short summary (2–4 sentences) |
| 3. Telegram message | `telegram_notify.txt` | HTML-formatted Telegram notification |
| 4. (Router) | `router.txt` | Tool dispatch for bot-side queries |

Results are cached in Redis for 1 hour (keyed by email ID). If Redis is unavailable the pipeline runs without caching.

### 3. Priority Filter

Each user can set a minimum priority threshold. Emails below the threshold are processed but not pushed to Telegram.

Configuration: Settings → Gmail → Minimum Priority

### 4. Deduplication

- Processed email IDs stored per `(user_id, email_id)` in `email_records` table
- Redis `SET NX` prevents duplicate processing across restarts
- Every processed email (body, analysis, summary, Telegram message, token count) is persisted

## Configuration

| `.env` variable | Default | Description |
|-----------------|---------|-------------|
| `GMAIL_POLL_INTERVAL` | `300` | Poll interval in seconds |
| `GMAIL_POLL_QUERY` | `is:unread in:inbox` | Gmail search query |
| `GMAIL_POLL_MAX` | `20` | Max emails per poll cycle |
| `GMAIL_MARK_READ` | `true` | Mark processed emails as read |
| `NOTIFY_MIN_PRIORITY` | _(empty)_ | Comma-separated priorities to notify; empty = all |

Per-user overrides are available in the Settings page.

## Prerequisites

- `credentials.json` in project root (Google Cloud Console → OAuth 2.0 Client ID → Desktop app)
- Each user must click **Authorize via Google** in Settings before starting their worker

## Related

- [Telegram Push →](telegram-push.md)
- [Prompt Editor →](prompts.md)
