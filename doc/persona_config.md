# Chat Persona Configuration Guide

This document explains the chat persona system in Xiaoxing AI. It includes how admins can set style prompts for zodiac, Chinese zodiac, and gender, and how users can generate their own chat system prompt with AI.

---

## Contents

1. [Feature Overview](#feature-overview)
2. [Database Design](#database-design)
3. [Admin: Persona Config Page](#admin-persona-config-page)
4. [User: Chat Prompt Generator](#user-chat-prompt-generator)
5. [AI Generation Pipeline](#ai-generation-pipeline)
6. [API Endpoints](#api-endpoints)

---

## Feature Overview

The chat persona feature has two levels:

| Level | User | Description |
|------|--------|------|
| **Persona configuration** at system level | Admin | Configure style prompts for zodiac, Chinese zodiac, and gender. They are stored in the `system_prompts` table and used as reference context for AI generation. |
| **Chat prompt** at user level | Regular user | Enter keywords and optionally choose zodiac, Chinese zodiac, or gender. The AI uses a four-step pipeline to generate a custom system prompt, stores it in the `user_prompts` table, and it can be assigned to a bot. |

---

## Database Design

### Table Structure

The system uses two tables to store prompts, and each table has a clear role:

```
system_prompts                    user_prompts
────────────────────────────      ──────────────────────────────
id          BIGSERIAL PK          id          BIGSERIAL PK
name        VARCHAR               user_id     BIGINT → user(id)
type        VARCHAR               name        VARCHAR
content     TEXT                  type        VARCHAR
is_default  BOOLEAN               content     TEXT
created_at  TIMESTAMP             is_default  BOOLEAN
updated_at  TIMESTAMP             created_at  TIMESTAMP
                                  updated_at  TIMESTAMP
```

- **`system_prompts`**: admin-only. It stores built-in AI prompt templates such as `chat`, `user_profile`, and `email_analysis`, and also all persona config items where `type = 'persona_config'`.
- **`user_prompts`**: each row belongs to one user. It stores user-generated or saved chat personas where `type = 'chat'`, and also user overrides for default prompts.

The foreign key `bot.chat_prompt_id` points to `user_prompts(id)`. It means the chat persona currently used by that bot.

### Name Format for Persona Config

The `name` field for persona config rows uses the format `{category}:{key}`:

| category | example key | meaning |
|---|---|---|
| `zodiac` | `aries`, `taurus`, ... | the 12 zodiac signs |
| `chinese_zodiac` | `rat`, `ox`, ... | the 12 Chinese zodiac animals |
| `gender` | `male`, `female`, `other` | gender |

Example: `name = 'zodiac:aries'` means the style prompt for Aries.

### Data Migration from the Old `prompts` Table

If the database still has the old single `prompts` table, `init_db()` will run a one-time migration when the app starts:

1. Rows with `user_id IS NULL` are copied to `system_prompts`, keeping the original IDs
2. Rows with `user_id IS NOT NULL` are copied to `user_prompts`, keeping the original IDs
3. The sequence values of the new tables are fixed
4. The foreign key `bot.chat_prompt_id` is rebound to `user_prompts`
5. The old `prompts` table is deleted

The migration is idempotent. If the old table does not exist, it returns immediately and does not run again.

---

## Admin: Persona Config Page

Location: **PersonaConfig** in the navigation bar, visible only to admins.

### Functions

- switch between the three tabs: zodiac, Chinese zodiac, and gender
- click one item such as Aries, and the editor on the right shows the current style prompt
- edit the text and click Save to write it into the `system_prompts` table with upsert logic
- if an item has no config yet, you can enter new content and save it directly

### Suggested Style Prompt Format

The prompt should describe the typical chat style of this type of user in the third person. For example:

```
An Aries user is direct and warm. The speaking style is short and strong.
They like to express ideas clearly, act quickly, dislike too much hesitation,
and may be a little impulsive but calm down soon.
```

This text is added as extra context, with a label like `[Zodiac Style Reference]`, into step 1 and step 2 of the AI generation flow.

---

## User: Chat Prompt Generator

Location: **Chat page** → **Chat Prompt Generator** card

### Steps

1. **Choose attributes** if needed. Select from zodiac, Chinese zodiac, and gender. Only options already configured by the admin are shown.
2. **Enter keywords**. Freely describe the chat personality you want, for example: `a lively and cute girl, likes jokes, speaks in short sentences`
3. Click **Generate Prompt**. The AI runs a four-step pipeline and usually takes about 10 to 30 seconds
4. You can edit the generated result directly in the result box
5. Enter a name and click **Save Prompt** to store it in the `user_prompts` table
6. In the prompt management card, assign the saved prompt to a bot

### How the Selected Options Work

When the user selects zodiac, Chinese zodiac, or gender, the backend reads the matching style prompt from `system_prompts` and appends it to the keywords like this before sending everything to the AI:

```
<user input keywords>

[Zodiac Style Reference]
<content of zodiac:aries>

[Chinese Zodiac Style Reference]
<content of chinese_zodiac:rat>
```

If one option has no saved content yet, it is skipped silently and generation still works.

---

## AI Generation Pipeline

The generation uses a four-step pipeline. Everything runs in `POST /chat/generate_persona_prompt`:

```
User input, keywords plus style reference
        │
        ▼
Step 1  tonePersonaGenerator.txt
        The LLM analyzes tone and style and returns tone JSON
        {tone, style, rhythm, language_features, ...}
        │
        ▼
Step 2  characterPortraitGeneration.txt
        The LLM creates a character portrait and returns portrait JSON
        {personality_traits, social_persona, emotional_pattern, ...}
        │
        ▼
Step 3  chatPrompt.txt
        The LLM creates a free-form system prompt for reference
        │
        ▼
Step 4  specificChatStyle.txt, template fill only, no LLM
        Fill the structured template with JSON fields from step 1 and 2
        → final system prompt
```

Step 4 is only string replacement and does not call the LLM. This makes the output more stable and predictable.

### Token Cost

The three LLM calls usually use about 500 to 2000 tokens in total. The result page shows the total token usage.

---

## API Endpoints

### Admin Persona Config

| Method | Path | Description |
|------|------|------|
| `GET` | `/admin/persona-config` | Get all persona config and return it grouped by category |
| `PUT` | `/admin/persona-config` | Save one config item with upsert |

`PUT` request body:
```json
{
  "category": "zodiac",
  "key": "aries",
  "content": "Aries style description..."
}
```

### Chat Prompt Generation

| Method | Path | Description |
|------|------|------|
| `POST` | `/chat/generate_persona_prompt` | Run the four-step AI pipeline and return the generated system prompt |

Request body:
```json
{
  "keywords": "a lively and cute girl who likes jokes",
  "zodiac": "aries",
  "chinese_zodiac": "rat",
  "gender": "female"
}
```

Response:
```json
{
  "prompt": "...<generated system prompt>...",
  "tokens": 1230
}
```

`zodiac`, `chinese_zodiac`, and `gender` are all optional. If you pass `null` or do not pass them, no extra style reference is added.

### User Prompt CRUD

| Method | Path | Description |
|------|------|------|
| `GET` | `/db/prompts` | List all prompts of the current user |
| `POST` | `/db/prompts` | Create a new prompt |
| `PUT` | `/db/prompts/{id}` | Update a prompt |
| `DELETE` | `/db/prompts/{id}` | Delete a prompt |

These endpoints work on the `user_prompts` table and only return data of the current logged-in user.
