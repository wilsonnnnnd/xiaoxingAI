# Telegram Multi-bot Chat

## Overview

Each registered Bot can operate as a conversational AI assistant. Multiple bots run simultaneously, each with its own conversation history, long-term user memory, and optional custom persona prompt.

## Bot Modes

| Mode | Behaviour |
|------|-----------|
| `all` | Full-featured: chat + email notifications |
| `chat` | Chat only, no email push |
| `notify` | Email notifications only, ignores chat messages |

## Conversation History

- Last **40 messages** (20 turns) kept in memory per bot
- History persisted in Redis (7-day TTL) — survives server restarts
- `/clear` command wipes all conversation history for that bot
- Per-bot `threading.Lock` prevents race conditions under concurrent messages

## Custom Persona

Each bot can be assigned a custom chat prompt that defines its personality, communication style, and identity (zodiac, gender, age feel, etc.).

- Generate a persona: Skills → Chat → Persona Generator
- Save and assign to a bot: Skills → Chat → Prompt Management → Assign
- Identity attributes (zodiac, gender, etc.) are embedded directly into the saved prompt content

See [Chat Persona Generator →](persona.md)

## Built-in Commands

| Command | Action |
|---------|--------|
| `/start`, `/hi` | Greeting message |
| `/clear` | Clear conversation history |
| `/help` | Show available commands |

## Tool Integration

The bot can call built-in tools based on message intent:

- **get_time** — returns current time
- **get_emails** — lists recent emails
- **fetch_email** — retrieves full email content

A lightweight Router LLM (port 8002) dispatches tool calls; falls back to keyword matching if unavailable.

See [Tool System →](tool-system.md)

## Long-term Memory

At midnight the bot summarises the day's conversation into structured memories (`[事实]`, `[偏好]`, `[近期事件]`, `[性格观察]`). These are filtered by relevance and injected into future conversations.

See [Memory System →](memory.md)

## Related

- [Telegram Push →](telegram-push.md)
- [Tool System →](tool-system.md)
- [Memory System →](memory.md)
- [Chat Persona →](persona.md)
