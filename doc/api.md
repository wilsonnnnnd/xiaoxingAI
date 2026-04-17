# Xiaoxing AI — API Reference

Base URL: `http://127.0.0.1:8000/api`

All endpoints except `/api/auth/login` need a JWT token in the request header:
`Authorization: Bearer <token>`

Interactive docs: http://127.0.0.1:8000/docs

---

## 1. System and Health

| Method | Path | Description |
|------|------|------|
| GET | `/api/` | Root path |
| GET | `/api/health` | Health check |
| GET | `/api/ai/ping` | Test LLM connection |

## 2. Auth

| Method | Path | Description |
|------|------|------|
| POST | `/api/auth/login` | Admin login and get JWT |
| GET | `/api/auth/me` | Get current user info |

## 3. User Management

| Method | Path | Description |
|------|------|------|
| GET | `/api/users` | List all users, admin only |
| POST | `/api/users` | Create a user, admin only |
| GET | `/api/users/{user_id}` | Get one user, self or admin |
| PUT | `/api/users/{user_id}` | Update user settings, self or admin |

## 4. Bot Management

| Method | Path | Description |
|------|------|------|
| GET | `/api/users/{user_id}/bots` | List all bots of a user |
| POST | `/api/users/{user_id}/bots` | Create a bot |
| PUT | `/api/users/{user_id}/bots/{bot_id}` | Update a bot |
| DELETE | `/api/users/{user_id}/bots/{bot_id}` | Delete a bot |
| POST | `/api/users/{user_id}/bots/{bot_id}/set-default` | Set the default bot |

## 5. Prompt Management

| Method | Path | Description |
|------|------|------|
| GET | `/api/db/prompts` | List DB prompts created by the current user |
| POST | `/api/db/prompts` | Create a DB prompt |
| PUT | `/api/db/prompts/{prompt_id}` | Update a DB prompt |
| DELETE | `/api/db/prompts/{prompt_id}` | Delete a DB prompt |
| GET | `/api/prompts` | List file prompts |
| GET | `/api/prompts/{filename:path}` | Get one file prompt |
| POST | `/api/prompts/{filename:path}` | Save a file prompt |
| DELETE | `/api/prompts/{filename:path}` | Delete a file prompt |

## 6. Config and Stats

| Method | Path | Description |
|------|------|------|
| GET | `/api/config` | Read current runtime config |
| POST | `/api/config` | Update .env and hot reload |
| GET | `/api/db/stats` | Get database statistics |

## 7. AI Processing

| Method | Path | Description |
|------|------|------|
| POST | `/api/ai/analyze` | Analyze an email with AI |
| POST | `/api/ai/summary` | Summarize an email with AI |
| POST | `/api/ai/process` | Run the full AI process |

## 8. Email Records

| Method | Path | Description |
|------|------|------|
| GET | `/api/email/records` | List email records |
| GET | `/api/email/records/{email_id}` | Get one email record |

## 9. Gmail Worker and Actions

| Method | Path | Description |
|------|------|------|
| POST | `/api/worker/start` | Start workers for all enabled users |
| POST | `/api/worker/stop` | Stop all workers |
| GET | `/api/worker/status` | Get worker status |
| POST | `/api/worker/poll` | Run one poll now |
| GET | `/api/worker/logs` | Get worker logs |
| DELETE | `/api/worker/logs` | Clear worker logs |
| GET | `/api/gmail/auth/url` | Get Google OAuth URL |
| GET | `/api/gmail/auth` | Open Google OAuth page |
| GET | `/api/gmail/callback` | OAuth callback and save token |
| POST | `/api/gmail/compose` | Generate an email draft |
| POST | `/api/gmail/fetch` | Fetch Gmail manually |
| POST | `/api/gmail/process` | Process fetched Gmail messages |
| GET | `/api/gmail/workstatus` | Get Gmail work status |

## 10. Telegram Tools

| Method | Path | Description |
|------|------|------|
| POST | `/api/telegram/test` | Send a Telegram test message |
| GET | `/api/telegram/chat_id` | Get Telegram chat ID |

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
