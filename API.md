# Xiaoxing AI — API Reference

Base URL: `http://127.0.0.1:8000`

All endpoints (except `/auth/login`) require a JWT in the `Authorization: Bearer <token>` header.
Interactive docs: http://127.0.0.1:8000/docs

---

## Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Admin login → JWT |
| GET | `/auth/me` | Current user info |

---

## Users

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List all users (admin only) |
| POST | `/users` | Create regular user (admin only) |
| GET | `/users/{id}` | Get user (self or admin) |
| PUT | `/users/{id}` | Update user settings (self or admin) |

---

## Bots

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/{id}/bots` | List user's bots |
| POST | `/users/{id}/bots` | Create bot |
| PUT | `/users/{id}/bots/{bot_id}` | Update bot |
| DELETE | `/users/{id}/bots/{bot_id}` | Delete bot |
| POST | `/users/{id}/bots/{bot_id}/set-default` | Set as default bot |

---

## DB Prompts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/db/prompts` | List prompts (system built-ins + own) |
| POST | `/db/prompts` | Create custom prompt |
| PUT | `/db/prompts/{id}` | Update prompt |
| DELETE | `/db/prompts/{id}` | Delete prompt |

---

## Gmail Worker

| Method | Path | Description |
|--------|------|-------------|
| POST | `/worker/start` | Start all enabled users' workers |
| POST | `/worker/stop` | Stop all workers |
| GET | `/worker/status` | Aggregated worker status |
| POST | `/worker/poll` | Trigger immediate poll |
| GET | `/worker/logs` | Recent logs |
| DELETE | `/worker/logs` | Clear logs |
| GET | `/gmail/auth` | Redirect to Google OAuth consent |
| GET | `/gmail/callback` | OAuth callback, save token |

---

## Telegram Bot (Chat Worker)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/telegram/bot/start` | Start all registered bots |
| POST | `/telegram/bot/stop` | Stop all bots |
| GET | `/telegram/bot/status` | Bot worker status |
| POST | `/telegram/bot/clear_history` | Clear all chat history |
| GET | `/telegram/bot/profile` | Get user memory profile |
| DELETE | `/telegram/bot/profile` | Delete user memory profile |
| POST | `/telegram/bot/generate_profile` | Manually trigger profile generation |

---

## Email Records & Config

| Method | Path | Description |
|--------|------|-------------|
| GET | `/email/records` | List email records |
| GET | `/email/records/{email_id}` | Get single record |
| GET | `/config` | Read current runtime config |
| POST | `/config` | Update .env and hot-reload |
| GET | `/db/stats` | Database statistics |
| GET | `/health` | Health check |
| GET | `/ai/ping` | Test LLM connectivity |

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
