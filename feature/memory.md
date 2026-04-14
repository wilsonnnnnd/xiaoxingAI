# User Memory System

## Overview

Each bot builds and maintains a structured long-term memory of the user it chats with. Memories are extracted from conversation history, categorised, and injected into subsequent conversations to enable personalised responses.

## Memory Categories

| Category | What is stored |
|----------|---------------|
| `[事实]` Facts | Objective information: name, occupation, location, age, family |
| `[偏好]` Preferences | Likes, habits, preferred reply style, dislikes |
| `[近期事件]` Recent Events | Things mentioned recently — kept with time cues ("recently", "last week") |
| `[性格观察]` Personality | Observed traits backed by actual conversation evidence |

## How Memory is Built

1. **Accumulation** — Every conversation turn is appended to `_histories_today` (in-memory + Redis)
2. **Extraction** — At midnight, the day's history is fed to `build_user_profile()` using the `user_profile.txt` prompt
3. **Merge** — The LLM merges new observations with the existing memory, removing outdated entries
4. **Persistence** — Updated memory is saved to the `user_profile` table in PostgreSQL

Rules enforced by the prompt:
- Only record what the user explicitly said or strongly implied — no speculation
- Each memory item ≤ 30 characters
- Outdated entries are removed on merge

## Relevance Filtering at Injection Time

Rather than injecting all memories every turn, the system filters by relevance:

- **Facts, Preferences, Personality** — always injected
- **Recent Events** — injected only when the current message shares 2+ character n-grams with the event text

This keeps the context window lean while still providing relevant background.

## Manual Trigger

For debugging, the profile update can be triggered manually via the Debug page → "Update Profile Now". This uses the current conversation window history as input.

## Storage

- Table: `user_profile (bot_id, profile TEXT, updated_at)`
- One profile row per bot
- Shared Redis key for `_histories_today` (cleared after nightly update)

## Related

- [Telegram →](telegram.md)
