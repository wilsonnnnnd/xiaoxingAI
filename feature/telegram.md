# Telegram Integration

## Overview

Xiaoxing integrates with Telegram in two ways:

- **Push Notifications**: after an email is processed, an HTML notification is delivered.
- **Multi-bot Chat**: each bot can act as a conversational assistant with memory, persona, and tools.

Each user can bind their own Telegram bots and choose a bot mode.

## Bot Modes

| Mode | Behaviour |
|------|-----------|
| `all` | Full-featured: chat + email notifications |
| `chat` | Chat only, no email push |
| `notify` | Email notifications only, ignores chat messages |

## Push Notifications

### Setup

1. Create a bot via **@BotFather** → `/newbot` → copy the token
2. Get your Chat ID via **@userinfobot** or the **Get Chat ID** button in Settings
3. In Settings → Bots, add a new Bot with the token and chat ID
4. Set bot mode to `notify` (notification-only) or `all` (chat + notification)
5. Start the Gmail worker on the Skills → Gmail page

### Notification Format

Notifications are composed by the LLM using `telegram_notify.txt` and delivered as HTML:

```
📧 <b>[Priority] Subject</b>
From: sender@example.com

AI-generated summary of the email content...

<i>Processed at HH:MM:SS</i>
```

## Multi-bot Chat

### Conversation History

- Last **40 messages** (20 turns) kept in memory per bot
- History persisted in Redis (7-day TTL) — survives server restarts
- `/clear` command wipes all conversation history for that bot
- Per-bot `threading.Lock` prevents race conditions under concurrent messages

### Custom Persona

Each bot can be assigned a custom chat prompt that defines its personality, communication style, and identity.

- Generate a persona: Skills → Chat → Persona Generator
- Save and assign to a bot: Skills → Chat → Prompt Management → Assign

See [Chat Persona Generator →](persona.md)

### Built-in Commands

| Command | Action |
|---------|--------|
| `/start`, `/hi` | Greeting message |
| `/clear` | Clear conversation history |
| `/help` | Show available commands |

### Tool Integration

The bot can call built-in tools based on message intent:

- **get_time** — returns current time
- **get_emails** — lists recent emails
- **fetch_email** — retrieves full email content

A lightweight Router LLM (port 8002) dispatches tool calls; falls back to keyword matching if unavailable.

See [Tool System →](tool-system.md)

## Long-term Memory

At midnight the bot summarises the day's conversation into structured memories. These are filtered by relevance and injected into future conversations.

See [Memory System →](memory.md)

## Deduplication and Reliability

- Telegram update dedup: Redis `SET NX` on `update_id` avoids duplicate processing.
- Multi-bot concurrency: bots run as independent asyncio tasks.

## Related

- [Gmail Pipeline →](gmail.md)
- [Tool System →](tool-system.md)
- [LLM Configuration →](llm-configuration.md)
