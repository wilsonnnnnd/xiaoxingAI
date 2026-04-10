# Telegram Multi-bot Push Notifications

## Overview

Each user binds their own Telegram Bot. After AI analyses an email the system sends an HTML-formatted notification to the user's designated Telegram chat.

## Setup

1. Create a Bot via **@BotFather** → `/newbot` → copy the token
2. Get your Chat ID via **@userinfobot** or the **Get Chat ID** button in Settings
3. In Settings → Bots, add a new Bot with the token and chat ID
4. Set bot mode to `notify` (notification-only) or `all` (chat + notification)
5. Start the Gmail worker on the Skills → Gmail page

## Multi-bot Architecture

- Each user can have multiple bots with different tokens
- All bots run concurrently as independent asyncio tasks
- Each bot maintains its own Telegram API connection and chat ID whitelist
- A shared Redis task queue prevents duplicate processing when multiple bots are active

## Notification Format

Notifications are composed by the LLM using `telegram_notify.txt` prompt and delivered as HTML:

```
📧 <b>[Priority] Subject</b>
From: sender@example.com

AI-generated summary of the email content...

<i>Processed at HH:MM:SS</i>
```

## Deduplication

Redis `SET NX` on `update_id` ensures each Telegram update is processed exactly once, even across server restarts.

## Related

- [Gmail Pipeline →](gmail.md)
- [Telegram Chat →](telegram-chat.md)
