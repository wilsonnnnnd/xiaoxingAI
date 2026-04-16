# Xiaoxing AI — API Reference

Base URL: `http://127.0.0.1:8000`

All endpoints except `/auth/login` need a JWT token in the request header:
`Authorization: Bearer <token>`

Interactive docs: http://127.0.0.1:8000/docs

---

## 1. System and Health

| Method | Path | Description |
|------|------|------|
| GET | `/` | Root path |
| GET | `/health` | Health check |
| GET | `/ai/ping` | Test LLM connection |

## 2. Auth

| Method | Path | Description |
|------|------|------|
| POST | `/auth/login` | Admin login and get JWT |
| GET | `/auth/me` | Get current user info |

## 3. User Management

| Method | Path | Description |
|------|------|------|
| GET | `/users` | List all users, admin only |
| POST | `/users` | Create a user, admin only |
| GET | `/users/{user_id}` | Get one user, self or admin |
| PUT | `/users/{user_id}` | Update user settings, self or admin |

## 4. Bot Management

| Method | Path | Description |
|------|------|------|
| GET | `/users/{user_id}/bots` | List all bots of a user |
| POST | `/users/{user_id}/bots` | Create a bot |
| PUT | `/users/{user_id}/bots/{bot_id}` | Update a bot |
| DELETE | `/users/{user_id}/bots/{bot_id}` | Delete a bot |
| POST | `/users/{user_id}/bots/{bot_id}/set-default` | Set the default bot |

## 5. Prompt Management

| Method | Path | Description |
|------|------|------|
| GET | `/db/prompts` | List DB prompts created by the current user |
| POST | `/db/prompts` | Create a DB prompt |
| PUT | `/db/prompts/{prompt_id}` | Update a DB prompt |
| DELETE | `/db/prompts/{prompt_id}` | Delete a DB prompt |
| GET | `/prompts` | List file prompts |
| GET | `/prompts/{filename:path}` | Get one file prompt |
| POST | `/prompts/{filename:path}` | Save a file prompt |
| DELETE | `/prompts/{filename:path}` | Delete a file prompt |

## 6. Config and Stats

| Method | Path | Description |
|------|------|------|
| GET | `/config` | Read current runtime config |
| POST | `/config` | Update .env and hot reload |
| GET | `/admin/persona-config` | Get system persona config |
| PUT | `/admin/persona-config` | Update system persona config |
| GET | `/db/stats` | Get database statistics |

## 7. AI Processing

| Method | Path | Description |
|------|------|------|
| POST | `/ai/analyze` | Analyze an email with AI |
| POST | `/ai/summary` | Summarize an email with AI |
| POST | `/ai/process` | Run the full AI process |

## 8. Email Records

| Method | Path | Description |
|------|------|------|
| GET | `/email/records` | List email records |
| GET | `/email/records/{email_id}` | Get one email record |

## 9. Gmail Worker and Actions

| Method | Path | Description |
|------|------|------|
| POST | `/worker/start` | Start workers for all enabled users |
| POST | `/worker/stop` | Stop all workers |
| GET | `/worker/status` | Get worker status |
| POST | `/worker/poll` | Run one poll now |
| GET | `/worker/logs` | Get worker logs |
| DELETE | `/worker/logs` | Clear worker logs |
| GET | `/gmail/auth/url` | Get Google OAuth URL |
| GET | `/gmail/auth` | Open Google OAuth page |
| GET | `/gmail/callback` | OAuth callback and save token |
| POST | `/gmail/compose` | Generate an email draft |
| POST | `/gmail/fetch` | Fetch Gmail manually |
| POST | `/gmail/process` | Process fetched Gmail messages |
| GET | `/gmail/workstatus` | Get Gmail work status |

## 10. Telegram Bot and Chat

| Method | Path | Description |
|------|------|------|
| POST | `/telegram/bot/start` | Start all registered Telegram bots |
| POST | `/telegram/bot/stop` | Stop all Telegram bots |
| GET | `/telegram/bot/status` | Get Telegram bot status |
| POST | `/telegram/bot/clear_history` | Clear all chat history |
| GET | `/telegram/bot/profile` | Get user memory profile |
| DELETE | `/telegram/bot/profile` | Delete user memory profile |
| POST | `/telegram/bot/generate_profile` | Generate the memory profile manually |
| POST | `/telegram/test` | Send a Telegram test message |
| GET | `/telegram/chat_id` | Get Telegram chat ID |
| POST | `/chat/generate_persona_prompt` | Generate a persona prompt chat |
| GET | `/chat/workstatus` | Get chat work status |

---

## Error Format

All errors follow the standard FastAPI format:

```json
{ "detail": "Error message" }
```

Common HTTP status codes:

- `400` — bad request
- `401` — unauthorized
- `403` — forbidden
- `404` — resource not found
- `422` — validation failed
- `500` — internal server error
- `502` — LLM backend is not reachable

