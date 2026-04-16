# Telegram Integration

## Overview

Xiaoxing uses Telegram for:

- Email notifications (HTML message after an email is processed)
- Interactive buttons for outgoing email drafts (confirm / cancel / modify) via `callback_data`

Each user can bind one or more Telegram bots; the Gmail worker sends notifications only to bots in `all` or `notify` mode.

## Bot Modes

| Mode | Behaviour |
|------|-----------|
| `all` | Receives email notifications |
| `notify` | Receives email notifications (notification-only) |

## Push Notifications

### Setup

1. Create a bot via **@BotFather** → `/newbot` → copy the token
2. Get your Chat ID via **@userinfobot** or the **Get Chat ID** button in Settings
3. In Settings → Bots, add a new bot with the token and chat ID
4. Set bot mode to `notify` or `all`
5. Start the Gmail worker on the Skills → Gmail page

### Notification Format

Notifications are composed by the LLM using `app/prompts/gmail/telegram_notify.txt` and delivered as HTML.

## Outgoing Draft Callbacks

When the system generates an outgoing reply draft, it can attach inline buttons (confirm/cancel). Telegram button payloads use `callback_data`, so the backend signs it to prevent forgery.

Required env var:

- `TELEGRAM_CALLBACK_SECRET` — secret key used to sign and verify callback payloads

## Deduplication and Reliability

- Telegram update dedup uses Redis keys based on `update_id` to avoid duplicate processing.

## Related

- [Gmail Pipeline →](gmail.md)
- [Tool System →](tool-system.md)
- [LLM Configuration →](llm-configuration.md)
