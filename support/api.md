# Xiaoxing AI — API Reference

[中文文档](api.zh.md)

Base URL: `http://127.0.0.1:8000/api`

All endpoints (except `/api/auth/login`) require a JWT in the `Authorization: Bearer <token>` header.
Interactive docs: http://127.0.0.1:8000/docs

---

## 1. System & Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/` | Root |
| GET | `/api/health` | Health check |
| GET | `/api/ai/ping` | Test LLM connectivity |

## 2. Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Admin login → JWT |
| GET | `/api/auth/me` | Current user info |

## 3. Users

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users` | List all users (admin only) |
| POST | `/api/users` | Create regular user (admin only) |
| GET | `/api/users/{user_id}` | Get user (self or admin) |
| PUT | `/api/users/{user_id}` | Update user settings (self or admin) |

## 4. Bots

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users/{user_id}/bots` | List user's bots |
| POST | `/api/users/{user_id}/bots` | Create bot |
| PUT | `/api/users/{user_id}/bots/{bot_id}` | Update bot |
| DELETE | `/api/users/{user_id}/bots/{bot_id}` | Delete bot |
| POST | `/api/users/{user_id}/bots/{bot_id}/set-default` | Set as default bot |

## 5. Prompts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/db/prompts` | List prompts owned by the current user |
| POST | `/api/db/prompts` | Create DB prompt |
| PUT | `/api/db/prompts/{prompt_id}` | Update DB prompt |
| DELETE | `/api/db/prompts/{prompt_id}` | Delete DB prompt |
| GET | `/api/prompts` | List file prompts |
| GET | `/api/prompts/{filename:path}` | Get single file prompt |
| POST | `/api/prompts/{filename:path}` | Save file prompt |
| DELETE | `/api/prompts/{filename:path}` | Delete file prompt |

## 6. Config & Stats

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/config` | Read current runtime config |
| POST | `/api/config` | Update .env and hot-reload |
| GET | `/api/db/stats` | Database statistics |

## 7. AI Processing

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai/analyze` | Analyze email |
| POST | `/api/ai/summary` | Summarize email |
| POST | `/api/ai/process` | AI processing pipeline |

## 8. Email Records

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/email/records` | List email records |
| GET | `/api/email/records/{email_id}` | Get single record |

## 9. Gmail Worker & Actions

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/worker/start` | Start all enabled users' workers |
| POST | `/api/worker/stop` | Stop all workers |
| GET | `/api/worker/status` | Aggregated worker status |
| POST | `/api/worker/poll` | Trigger immediate poll |
| GET | `/api/worker/logs` | Recent worker logs |
| DELETE | `/api/worker/logs` | Clear logs |
| GET | `/api/gmail/auth/url` | Get Google OAuth URL |
| GET | `/api/gmail/auth` | Redirect to Google OAuth consent |
| GET | `/api/gmail/callback` | OAuth callback, save token |
| POST | `/api/gmail/compose` | Generate an outgoing email draft |
| POST | `/api/gmail/fetch` | Manually fetch Gmail |
| POST | `/api/gmail/process` | Process fetched Gmail |
| GET | `/api/gmail/workstatus` | Gmail processing status |

## 10. Telegram Tools

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/telegram/test` | Send test Telegram message |
| GET | `/api/telegram/chat_id` | Get Telegram Chat ID |

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
