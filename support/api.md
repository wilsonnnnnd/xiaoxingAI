# Xiaoxing AI — API Reference

[中文文档](api.zh.md)

Base URL: `http://127.0.0.1:8000`

All endpoints (except `/auth/login`) require a JWT in the `Authorization: Bearer <token>` header.
Interactive docs: http://127.0.0.1:8000/docs

---

## 1. System & Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Root |
| GET | `/health` | Health check |
| GET | `/ai/ping` | Test LLM connectivity |

## 2. Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Admin login → JWT |
| GET | `/auth/me` | Current user info |

## 3. Users

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List all users (admin only) |
| POST | `/users` | Create regular user (admin only) |
| GET | `/users/{user_id}` | Get user (self or admin) |
| PUT | `/users/{user_id}` | Update user settings (self or admin) |

## 4. Bots

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/{user_id}/bots` | List user's bots |
| POST | `/users/{user_id}/bots` | Create bot |
| PUT | `/users/{user_id}/bots/{bot_id}` | Update bot |
| DELETE | `/users/{user_id}/bots/{bot_id}` | Delete bot |
| POST | `/users/{user_id}/bots/{bot_id}/set-default` | Set as default bot |

## 5. Prompts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/db/prompts` | List prompts owned by the current user |
| POST | `/db/prompts` | Create DB prompt |
| PUT | `/db/prompts/{prompt_id}` | Update DB prompt |
| DELETE | `/db/prompts/{prompt_id}` | Delete DB prompt |
| GET | `/prompts` | List file prompts |
| GET | `/prompts/{filename:path}` | Get single file prompt |
| POST | `/prompts/{filename:path}` | Save file prompt |
| DELETE | `/prompts/{filename:path}` | Delete file prompt |

## 6. Config & Stats

| Method | Path | Description |
|--------|------|-------------|
| GET | `/config` | Read current runtime config |
| POST | `/config` | Update .env and hot-reload |
| GET | `/admin/persona-config` | Get persona config |
| PUT | `/admin/persona-config` | Update persona config |
| GET | `/db/stats` | Database statistics |

## 7. AI Processing

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai/analyze` | Analyze email |
| POST | `/ai/summary` | Summarize email |
| POST | `/ai/process` | AI processing pipeline |

## 8. Email Records

| Method | Path | Description |
|--------|------|-------------|
| GET | `/email/records` | List email records |
| GET | `/email/records/{email_id}` | Get single record |

## 9. Gmail Worker & Actions

| Method | Path | Description |
|--------|------|-------------|
| POST | `/worker/start` | Start all enabled users' workers |
| POST | `/worker/stop` | Stop all workers |
| GET | `/worker/status` | Aggregated worker status |
| POST | `/worker/poll` | Trigger immediate poll |
| GET | `/worker/logs` | Recent worker logs |
| DELETE | `/worker/logs` | Clear logs |
| GET | `/gmail/auth/url` | Get Google OAuth URL |
| GET | `/gmail/auth` | Redirect to Google OAuth consent |
| GET | `/gmail/callback` | OAuth callback, save token |
| POST | `/gmail/fetch` | Manually fetch Gmail |
| POST | `/gmail/process` | Process fetched Gmail |
| GET | `/gmail/workstatus` | Gmail processing status |

## 10. Telegram Bot & Chat

| Method | Path | Description |
|--------|------|-------------|
| POST | `/telegram/bot/start` | Start all registered bots |
| POST | `/telegram/bot/stop` | Stop all bots |
| GET | `/telegram/bot/status` | Bot worker status |
| POST | `/telegram/bot/clear_history` | Clear all chat history |
| GET | `/telegram/bot/profile` | Get user memory profile |
| DELETE | `/telegram/bot/profile` | Delete user memory profile |
| POST | `/telegram/bot/generate_profile` | Manually trigger profile generation |
| POST | `/telegram/test` | Send test Telegram message |
| GET | `/telegram/chat_id` | Get Telegram Chat ID |
| POST | `/chat/generate_persona_prompt` | Generate persona prompt chat |
| GET | `/chat/workstatus` | Chat processing status |

---

## Common Error Shape

All errors follow FastAPI's standard format:
```json
{ "detail": "Human-readable error message" }
```

HTTP status codes:
- `400` — bad request (missing config, invalid state)
- `401` — unauthorized (JWT missing or expired)
- `403` — forbidden (e.g. access another user's resource)
- `404` — resource not found
- `422` — validation error (unknown config key, missing field)
- `500` — internal server error
- `502` — LLM backend unreachable
```