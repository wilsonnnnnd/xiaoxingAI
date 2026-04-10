# Prompt Editor

## Overview

All LLM prompts used by Xiaoxing are editable from the web UI. There are two types: system built-in prompts (shared across all users) and per-user custom prompts.

## Prompt Types

| Type key | Used for |
|----------|---------|
| `chat` | Bot conversation persona (assignable per-bot) |
| `email_analysis` | Gmail email classification and priority |
| `email_summary` | Email summary generation |
| `telegram_notify` | Telegram notification message composition |
| `user_profile` | Memory extraction from chat history |
| `router` _(hidden)_ | Tool dispatch routing — not shown in the UI editor |

## Built-in Prompts

Located in `app/prompts/`. Imported into the database on first startup. Editable from **Prompts** page (admin only).

Changes take effect immediately — all prompts are **hot-reloaded** on each LLM call (no restart needed).

## Custom Prompts (Chat Personas)

Users can create their own chat persona prompts via the Persona Generator (Skills → Chat). These are stored in `user_prompts` with `type = 'chat'` and scoped to that user.

Each bot can have one custom prompt assigned:
- Skills → Chat → Prompt Management → select bot → Assign
- When assigned, the prompt replaces the default Xiaoxing description in the chat system prompt
- The `[身份设定]` header (if present) is parsed and injected as explicit identity statements

## `router.txt` Special Handling

The `router.txt` prompt drives the Tool Routing system. It is:
- Stored at `app/prompts/tools/router.txt`
- Excluded from the UI prompt editor (not a user-facing setting)
- Hot-reloaded on every routing call

## Prompt Variables

Prompts use Python `str.format()` substitution. Available variables per prompt type:

| Prompt | Variables |
|--------|-----------|
| `chat.txt` | `{persona_section}`, `{profile_section}`, `{db_context_section}`, `{history}`, `{message}` |
| `user_profile.txt` | `{existing_profile}`, `{chat_history}` |
| `email_analysis.txt` | `{email_body}` |
| `email_summary.txt` | `{email_body}` |
| `telegram_notify.txt` | `{analysis}`, `{summary}` |

## Related

- [Chat Persona →](persona.md)
- [Tool System →](tool-system.md)
