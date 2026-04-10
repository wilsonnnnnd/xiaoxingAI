# Chat Persona Generator

## Overview

The Persona Generator creates a detailed, structured chat persona prompt through a 4-stage AI pipeline. The generated persona defines the bot's personality, communication style, and identity. Once saved, it can be assigned to any bot.

## Generation Pipeline

| Stage | What happens |
|-------|-------------|
| 1. Tone & Persona | Core personality traits from keywords |
| 2. Character Portrait | Detailed character description |
| 3. Chat Prompt | Conversational behaviour rules |
| 4. Specific Chat Style | Final template fill with identity attributes |

## Identity Attributes

Before generation, you can optionally specify:

| Attribute | Options |
|-----------|---------|
| Zodiac (星座) | Aries → Pisces (12 signs) |
| Chinese Zodiac (属相) | Rat → Pig (12 animals) |
| Gender (性别) | Male / Female / Other |
| Age feel (年龄感) | 少年感 / 年轻成年人 / 成熟 / 中年感 |

These are appended as supplements to the generation keywords and **also embedded directly into the saved prompt** as an identity header:

```
[身份设定] 星座：双鱼座、属相：羊、性别：女性、年龄感：少年感。
如果用户问你的星座、属相、性别、年龄等个人特征，直接如实回答。
```

When injected into the chat system prompt, this header is expanded into explicit statements ("你的星座是双鱼座，...") with a hard ban on denying the identity.

## Usage

1. Skills → Chat → Persona Generator
2. Enter descriptive keywords (e.g. "活泼、喜欢星星、话比较多")
3. Optionally select zodiac / Chinese zodiac / gender / age feel
4. Click **Generate**
5. Review the structured card preview (or switch to raw text edit mode)
6. Enter a name and click **Save**
7. In Prompt Management below, assign the saved prompt to a bot

## Saving & Assignment

- Saved prompts are stored in the `user_prompts` table (`type = 'chat'`)
- Prompt content = `[身份设定]` header + generated body
- Each bot can have one assigned chat prompt (`chat_prompt_id` on the `bot` row)
- Reassigning or deleting automatically reflects in the bot list

## Related

- [Telegram Chat →](telegram-chat.md)
- [Prompt Editor →](prompts.md)
