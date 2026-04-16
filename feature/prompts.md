# Prompt Editor

## Overview

Xiaoxing prompts are plain text files stored under `app/prompts/`. The backend reads these files at runtime (via `app/utils/prompt_loader.py`), so edits take effect without restarting the server.

The web UI provides a prompt editor page that edits these files through the `/prompts` API.

## Prompt Files (current)

Common built-in prompts:

- `gmail/email_analysis.txt` — classify priority and extract key fields
- `gmail/email_summary.txt` — generate a structured summary
- `gmail/telegram_notify.txt` — render Telegram HTML notification
- `outgoing/email_reply_compose.txt` — compose a reply draft (content only; no closing/signature)
- `outgoing/email_edit.txt` — modify an existing draft (content only; no closing/signature)
- `outgoing/email_compose.txt` — compose a new outgoing email

## Visibility Rules (web UI)

- Non-admin users only see a small allowlist of prompts
- Admin users can see and edit all non-internal prompts
- Prompts under `app/prompts/tools/` are treated as internal and hidden from the `/prompts` file API

See:

- `app/core/constants.py` (`USER_VISIBLE_PROMPTS`)
- `app/api/routes/prompts.py` (`_is_internal_prompt`)

## Related

- [Tool System →](tool-system.md)
- [Gmail Pipeline →](gmail.md)
