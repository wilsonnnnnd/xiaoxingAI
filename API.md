# Gmail AI Manager — API Reference

Base URL: `http://127.0.0.1:8000`

All request/response bodies are JSON. All timestamps are ISO-8601 strings.

---

## Table of Contents

1. [System](#1-system)
2. [AI (Debug / Test)](#2-ai-debug--test)
3. [Gmail OAuth](#3-gmail-oauth)
4. [Gmail Fetch & Process](#4-gmail-fetch--process)
5. [Email Worker](#5-email-worker)
6. [Worker Logs](#6-worker-logs)
7. [Telegram](#7-telegram)
8. [Telegram Bot (Chat Worker)](#8-telegram-bot-chat-worker)
9. [Config](#9-config)
10. [Prompts](#10-prompts)
11. [Email Records](#11-email-records)

---

## 1. System

### `GET /health`
Server health check.

**Response**
```json
{ "status": "ok" }
```

---

### `GET /db/stats`
SQLite database statistics.

**Response**
```json
{
  "db_path": "/absolute/path/to/gmailmanager.db",
  "sender_count": 42,
  "log_count": 1337,
  "email_records_count": 38,
  "has_token": true
}
```

---

## 2. AI (Debug / Test)

### `GET /ai/ping`
Test LLM connectivity. Sends a minimal prompt and expects `"pong"` back.

**Response (200)**
```json
{ "ok": true, "backend": "local", "reply": "pong" }
```

**Response (502)** — LLM unreachable
```json
{ "detail": "LLM 调用失败: ..." }
```

---

### `POST /ai/analyze`
Run step 1 of the email pipeline (analysis only).

**Request Body**
```json
{ "subject": "Invoice #1234", "body": "Please find attached..." }
```

**Response**
```json
{
  "type": "analysis",
  "result": {
    "category": "finance",
    "priority": "high",
    "action_required": true,
    "summary": "...",
    "keywords": ["invoice", "payment"]
  },
  "raw": "<raw LLM text>",
  "tokens": 350
}
```

---

### `POST /ai/summary`
Run steps 1+2 (analysis + summary).

**Request Body** — same as `/ai/analyze`

**Response**
```json
{
  "type": "summary",
  "result": {
    "title": "...",
    "points": ["...", "..."],
    "action": "...",
    "deadline": null
  },
  "raw": "<raw LLM text>",
  "tokens": 480
}
```

---

### `POST /ai/process`
Run the full 3-step pipeline (analyze → summarize → write Telegram message).

**Request Body** — same as `/ai/analyze`

**Response**
```json
{
  "subject": "Invoice #1234",
  "analysis": { "category": "finance", "priority": "high", ... },
  "summary": { "title": "...", "points": [...], ... },
  "telegram_message": "<b>📧 Invoice #1234</b>\n...",
  "tokens": 1020
}
```

---

## 3. Gmail OAuth

### `GET /gmail/auth`
Redirect the browser to Google's OAuth consent screen.  
The `redirect_uri` is set automatically to `{origin}/gmail/callback`.

> Open this URL in a browser — not suitable for API fetch.

---

### `GET /gmail/callback?code=<code>`
OAuth callback handled automatically by Google. Exchanges the code for tokens and saves them to the database. Redirects to `/static/home.html?auth=success` on success.

> This endpoint is called by Google, not by the frontend directly.

---

## 4. Gmail Fetch & Process

### `POST /gmail/fetch`
Fetch email metadata/content from Gmail without AI processing.

**Request Body**
```json
{
  "query": "is:unread in:inbox",
  "max_results": 10
}
```

| Field        | Type   | Default               | Description                    |
|--------------|--------|-----------------------|--------------------------------|
| query        | string | `"is:unread in:inbox"`| Gmail search query             |
| max_results  | int    | `10`                  | Max number of emails to return |

**Response**
```json
{
  "count": 2,
  "emails": [
    {
      "id": "18f3a...",
      "subject": "Invoice #1234",
      "from": "billing@acme.com",
      "date": "2026-04-07T10:00:00",
      "snippet": "Please find attached...",
      "body": "<full plain-text body>"
    }
  ]
}
```

**Error (401)** — OAuth token missing or expired
```json
{ "detail": "OAuth token 未找到，请先完成授权" }
```

---

### `POST /gmail/process`
Fetch emails from Gmail and run the full AI pipeline on each one.

**Request Body**
```json
{
  "query": "is:unread in:inbox",
  "max_results": 5,
  "send_telegram": false,
  "mark_read": false
}
```

| Field          | Type    | Default               | Description                              |
|----------------|---------|-----------------------|------------------------------------------|
| query          | string  | `"is:unread in:inbox"`| Gmail search query                       |
| max_results    | int     | `5`                   | Max emails to process                    |
| send_telegram  | boolean | `false`               | Send Telegram notification after process |
| mark_read      | boolean | `false`               | Mark each processed email as read        |

**Response**
```json
{
  "count": 1,
  "results": [
    {
      "status": "ok",
      "id": "18f3a...",
      "from": "billing@acme.com",
      "date": "2026-04-07T10:00:00",
      "subject": "Invoice #1234",
      "analysis": { ... },
      "summary": { ... },
      "telegram_message": "...",
      "tokens": 1020,
      "telegram_sent": true
    }
  ]
}
```

On per-email failure the item has `"status": "error"` and an `"error"` string instead.

---

## 5. Email Worker

The email worker polls Gmail on a fixed interval and sends Telegram notifications automatically.

### `POST /worker/start`
Start the background polling worker.

**Response**
```json
{
  "ok": true,
  "started": true,
  "status": { ... }
}
```
`started` is `false` (not an error) if worker was already running.

---

### `POST /worker/stop`
Stop the background polling worker.

**Response**
```json
{
  "ok": true,
  "stopped": true,
  "status": { ... }
}
```

---

### `GET /worker/status`
Get current worker state and runtime statistics.

**Response**
```json
{
  "running": true,
  "started_at": "2026-04-07T09:00:00",
  "last_poll": "2026-04-07T10:55:00",
  "total_fetched": 120,
  "total_sent": 45,
  "total_errors": 2,
  "last_error": null
}
```

---

### `POST /worker/poll`
Trigger an immediate poll regardless of whether the worker is running.

**Response**
```json
{ "ok": true }
```

---

## 6. Worker Logs

Logs from both the email worker (`log_type: "email"`) and the Telegram chat bot (`log_type: "chat"`) are stored together and queryable by type.

### `GET /worker/logs?limit=100&log_type=`

| Query param | Type   | Default | Description                          |
|-------------|--------|---------|--------------------------------------|
| limit       | int    | `100`   | Max rows (capped at 200)             |
| log_type    | string | _(all)_ | Filter by source: `email` or `chat`  |

**Response**
```json
{
  "logs": [
    {
      "ts": "10:55:02",
      "level": "info",
      "log_type": "email",
      "tokens": 1020,
      "msg": "✅ 已发送：Invoice #1234"
    },
    {
      "ts": "11:03:14",
      "level": "info",
      "log_type": "chat",
      "tokens": 285,
      "msg": "🤖 Xiaoxing: 好的，我帮你查一下…"
    }
  ]
}
```

`level` values: `"info"` | `"warn"` | `"error"`  
`tokens` is `0` for non-LLM log entries.  
Results are in chronological order (oldest first).

---

### `DELETE /worker/logs`
Clear all logs (both email and chat).

**Response**
```json
{ "ok": true, "deleted": 1337 }
```

---

## 7. Telegram

### `POST /telegram/test`
Send a test message using the configured `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.

**Response (200)**
```json
{ "ok": true }
```

**Response (400)** — token or chat_id not configured
```json
{ "detail": "TELEGRAM_BOT_TOKEN 未配置" }
```

---

### `GET /telegram/chat_id?token=<bot_token>`
Poll `getUpdates` to retrieve the most recent `chat_id` that sent a message to the bot.  
Used by the settings page to auto-detect `TELEGRAM_CHAT_ID`.

| Query param | Type   | Default                   | Description                        |
|-------------|--------|---------------------------|------------------------------------|
| token       | string | configured `BOT_TOKEN`    | Override bot token for the request |

**Response**
```json
{ "chat_id": "123456789" }
```
`chat_id` is `null` if no updates are available (no one has messaged the bot yet).

---

## 8. Telegram Bot (Chat Worker)

The Bot Chat Worker listens for messages via Telegram's `getUpdates` long-poll loop and replies using local AI. It maintains per-chat conversation history and builds a daily user profile at midnight.

### `POST /telegram/bot/start`
Start the bot chat worker.

**Response**
```json
{ "ok": true, "started": true, "running": true }
```

---

### `POST /telegram/bot/stop`
Stop the bot chat worker.

**Response**
```json
{ "ok": true, "running": false }
```

---

### `GET /telegram/bot/status`
Get running state of the bot worker.

**Response**
```json
{ "running": true }
```

---

### `POST /telegram/bot/clear_history`
Clear all in-memory conversation history (does not affect the user profile).

**Response**
```json
{ "ok": true }
```

---

### `GET /telegram/bot/profile`
Get the AI-generated user profile for the configured `TELEGRAM_CHAT_ID`.  
The profile is regenerated from daily chat history every night at 00:00.

**Response**
```json
{
  "chat_id": "123456789",
  "profile": "性格特征：直接、幽默...\n兴趣爱好：技术、游戏...",
  "updated_at": "2026-04-07T00:00:05"
}
```
`profile` is `""` and `updated_at` is `null` when no profile exists yet.

---

### `DELETE /telegram/bot/profile`
Delete the user profile for the configured `TELEGRAM_CHAT_ID`.

**Response**
```json
{ "ok": true }
```

---

## 9. Config

Runtime configuration is stored in `.env` at the project root. Changes take effect immediately without restart.

### `GET /config`
Return all current configuration values.

**Response**
```json
{
  "LLM_BACKEND": "local",
  "LLM_API_URL": "http://127.0.0.2:8001/v1/chat/completions",
  "LLM_MODEL": "local-model",
  "OPENAI_API_KEY": "",
  "GMAIL_POLL_INTERVAL": "300",
  "GMAIL_POLL_QUERY": "is:unread in:inbox",
  "GMAIL_POLL_MAX": "20",
  "GMAIL_MARK_READ": "true",
  "NOTIFY_MIN_PRIORITY": "high,medium",
  "TELEGRAM_BOT_TOKEN": "123:ABC...",
  "TELEGRAM_CHAT_ID": "123456789",
  "PROMPT_ANALYZE": "email_analysis.txt",
  "PROMPT_SUMMARY": "email_summary.txt",
  "PROMPT_TELEGRAM": "telegram_notify.txt",
  "PROMPT_CHAT": "chat.txt",
  "PROMPT_PROFILE": "user_profile.txt",
  "UI_LANG": "en"
}
```

All values are strings (including numbers and booleans).

---

### `POST /config`
Update one or more config values. Writes to `.env` and hot-reloads in memory.

**Request Body** — partial update, only send keys you want to change
```json
{
  "GMAIL_POLL_INTERVAL": "120",
  "NOTIFY_MIN_PRIORITY": "high,medium",
  "UI_LANG": "zh"
}
```

**Allowed keys** (any other key returns 422):

| Key                  | Description                                          |
|----------------------|------------------------------------------------------|
| `LLM_BACKEND`        | `"local"` or `"openai"`                              |
| `LLM_API_URL`        | OpenAI-compatible endpoint URL                       |
| `LLM_MODEL`          | Model name sent in requests                          |
| `OPENAI_API_KEY`     | API key (required when backend is `openai`)          |
| `GMAIL_POLL_INTERVAL`| Polling interval in seconds                          |
| `GMAIL_POLL_QUERY`   | Gmail search query string                            |
| `GMAIL_POLL_MAX`     | Max emails fetched per poll                          |
| `GMAIL_MARK_READ`    | `"true"` / `"false"` — mark processed mail as read  |
| `NOTIFY_MIN_PRIORITY`| Comma-separated priorities: `high`, `medium`, `low` |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token                               |
| `TELEGRAM_CHAT_ID`   | Target chat/user ID                                  |
| `PROMPT_ANALYZE`     | Filename of analysis prompt                          |
| `PROMPT_SUMMARY`     | Filename of summary prompt                           |
| `PROMPT_TELEGRAM`    | Filename of Telegram message prompt                  |
| `PROMPT_CHAT`        | Filename of chat reply prompt                        |
| `PROMPT_PROFILE`     | Filename of user profile generation prompt           |
| `UI_LANG`            | UI language: `"en"` or `"zh"`                        |

**Response**
```json
{ "ok": true, "config": { ...same shape as GET /config... } }
```

**Response (422)** — unknown key
```json
{ "detail": "不允许修改的配置项: {'UNKNOWN_KEY'}" }
```

---

## 10. Prompts

Prompt files are `.txt` files stored in `app/prompts/`. Built-in files cannot be deleted but can be edited.

**Built-in files:** `email_analysis.txt`, `email_summary.txt`, `telegram_notify.txt`, `chat.txt`

---

### `GET /prompts`
List all available prompt files.

**Response**
```json
{
  "files": ["chat.txt", "email_analysis.txt", "email_summary.txt", "my_custom.txt", "telegram_notify.txt", "user_profile.txt"],
  "defaults": ["chat.txt", "email_analysis.txt", "email_summary.txt", "telegram_notify.txt"]
}
```

---

### `GET /prompts/{filename}`
Read the content of a prompt file.

**Response**
```json
{
  "filename": "chat.txt",
  "content": "你是一位名叫 Xiaoxing（小星 AI）的 AI 助手..."
}
```

**Response (404)** — file not found
```json
{ "detail": "chat.txt 不存在" }
```

---

### `POST /prompts/{filename}`
Create or overwrite a prompt file.

**Request Body**
```json
{ "content": "Your prompt text here..." }
```

**Response**
```json
{ "ok": true, "filename": "my_custom.txt" }
```

---

### `DELETE /prompts/{filename}`
Delete a custom prompt file. Built-in files cannot be deleted.

**Response**
```json
{ "ok": true, "filename": "my_custom.txt" }
```

**Response (403)** — attempt to delete a built-in file
```json
{ "detail": "内置文件不可删除" }
```

---

## 11. Email Records

Persistent store of every email processed by the system. Records are written automatically by both the Worker (auto-poll) and the `/gmail/process` endpoint.

### `GET /email/records`
List email processing records, newest first.

**Query Parameters**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `limit` | int | `50` | Maximum number of records to return |
| `priority` | string | — | Filter by priority (`high` / `medium` / `low`) |

**Response**
```json
{
  "count": 142,
  "records": [
    {
      "id": 142,
      "email_id": "18f3a2b4c5d6e7f8",
      "subject": "Your invoice is ready",
      "sender": "billing@example.com",
      "date": "Mon, 12 May 2025 09:00:00 +0000",
      "body": "Hi, please find your invoice attached...",
      "analysis": { "type": "invoice", "priority": "medium", "summary": "..." },
      "summary": { "key_points": ["..."], "action_required": false },
      "telegram_msg": "<b>📧 Invoice Ready</b>\n...",
      "tokens": 1240,
      "priority": "medium",
      "sent_telegram": true,
      "created_at": "2025-05-12T09:01:23"
    }
  ]
}
```

---

### `GET /email/records/{email_id}`
Fetch a single email record by its Gmail message ID.

**Path Parameter**: `email_id` — Gmail message ID string.

**Response (200)** — same shape as one element in the `records` array above.

**Response (404)**
```json
{ "detail": "邮件记录不存在" }
```

---

## Common Error Shape

All errors follow FastAPI's standard format:
```json
{ "detail": "Human-readable error message" }
```

HTTP status codes used:
- `400` — bad request (missing config, invalid state)
- `401` — OAuth token missing/expired
- `403` — forbidden (e.g. delete built-in prompt)
- `404` — resource not found
- `422` — validation error (unknown config key, missing field)
- `500` — internal server error
- `502` — LLM backend unreachable

---

## React Usage Notes

### Base URL
```ts
const API = "http://127.0.0.1:8000";
```

### Generic fetch helper
```ts
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? JSON.stringify(data));
  return data as T;
}
```

### Polling pattern (logs, status)
```ts
useEffect(() => {
  const id = setInterval(async () => {
    const data = await api<{ logs: Log[] }>("/worker/logs?limit=100&log_type=chat");
    setLogs(data.logs);
  }, 2000);
  return () => clearInterval(id);
}, []);
```

### Config update
```ts
await api("/config", {
  method: "POST",
  body: JSON.stringify({ GMAIL_POLL_INTERVAL: "120" }),
});
```

### Start / stop worker
```ts
await api("/worker/start",  { method: "POST" });
await api("/worker/stop",   { method: "POST" });
await api("/telegram/bot/start", { method: "POST" });
await api("/telegram/bot/stop",  { method: "POST" });
```

### Gmail OAuth redirect
```ts
// Simply navigate the browser — do not fetch()
window.location.href = API + "/gmail/auth";
```
After authorization, Google redirects back to `/gmail/callback`, which redirects to `/static/home.html?auth=success`. In a React SPA, intercept the `?auth=success` query param on mount.
