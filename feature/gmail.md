# Gmail Polling & AI Email Pipeline

## Overview

Each registered user runs an independent Gmail polling worker. When new emails arrive they pass through a 3-stage AI pipeline and are pushed to Telegram.

```
Gmail (OAuth2) → AI Analysis → Telegram Push
```

## How It Works

### 1. Gmail Polling

- Each user authorises their Gmail account via Google OAuth2 (Settings page → "Authorize via Google")
- A background worker polls the inbox on a configurable interval (default: 300 s)
- Only emails matching the search query are fetched (default: `is:unread in:inbox category:primary`)
- OAuth tokens are encrypted and stored per-user in PostgreSQL

### 2. AI Analysis Pipeline

Each email is passed through 3 LLM calls:

| Step | Prompt | Output |
|------|--------|--------|
| 1. Classify | `email_analysis.txt` | Priority (urgent/normal/low) + category |
| 2. Summarise | `email_summary.txt` | Short summary (2–4 sentences) |
| 3. Telegram message | `telegram_notify.txt` | HTML-formatted Telegram notification |

Tool routing for Telegram chat is a separate subsystem (see Tool System) and is not part of the per-email pipeline.

Results are cached in Redis for 1 hour (keyed by email ID). If Redis is unavailable the pipeline runs without caching.

### 3. Priority Filter

Each user can set a minimum priority threshold. Emails below the threshold are processed but not pushed to Telegram.

Configuration: Settings → Gmail → Minimum Priority

### 4. Deduplication

- Processed email IDs stored per `(user_id, email_id)` in `email_records` table
- Every processed email (body, analysis, summary, Telegram message, token count) is persisted

## Configuration

| `.env` variable | Default | Description |
|-----------------|---------|-------------|
| `GMAIL_POLL_INTERVAL` | `300` | Poll interval in seconds |
| `GMAIL_POLL_QUERY` | `is:unread in:inbox category:primary` | Gmail search query fallback |
| `GMAIL_POLL_MAX` | `5` | Max emails per poll cycle |
| `GMAIL_MARK_READ` | `true` | Mark processed emails as read |
| `NOTIFY_MIN_PRIORITY` | _(empty)_ | Comma-separated priorities to notify; empty = all |

Per-user overrides are available in the Settings page.

---

## Outgoing Email (Draft + Confirm)

Outgoing email uses a **draft-first** flow to avoid accidental sends:

1. Generate a draft (compose or reply).
2. Send a Telegram preview.
3. User confirms/cancels (inline buttons) or modifies (reply text).
4. Only after confirmation does the system send via Gmail API.

### Data Model

- `outgoing_email_drafts`: stores the outgoing draft, binds to Telegram preview message, and tracks state.
- `outgoing_email_actions`: audit log + idempotency (unique `telegram_update_id`) to prevent duplicate sends.

### Security

- Draft body is encrypted (AES-GCM).
- Telegram inline button callback_data is signed.

### Key Variables

| Variable | Description |
|---|---|
| `OUTGOING_EMAIL_ENCRYPTION_KEY` | Base64(32 bytes) key to encrypt outgoing draft bodies |
| `OUTGOING_DRAFT_TTL_MINUTES` | Draft expiry window; expired drafts cannot be confirmed |
| `TELEGRAM_CALLBACK_SECRET` | HMAC secret for signing callback_data |

---

## Reply Format Settings

Reply formatting is configurable per user and is applied when generating **reply drafts**.

### Placeholders

- `{{content}}` — AI-generated reply body
- `{{signature}}` — signature configured by the user
- `{{closing}}` — optional closing text
- `{{sender_name}}` — resolved sender name (filled when composing/sending)

### Web UI

- Route: `/settings/reply-format`
- Supports templates CRUD, default template, signature, and live preview.

## Prerequisites

- `credentials.json` in project root (Google Cloud Console → OAuth 2.0 Client ID → Desktop app)
- Each user must click **Authorize via Google** in Settings before starting their worker

## Related

- [Telegram →](telegram.md)
- [Prompt Editor →](prompts.md)
