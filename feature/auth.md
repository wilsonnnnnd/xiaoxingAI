# Authentication & User Management

## Overview

Xiaoxing uses JWT-based authentication with bcrypt password hashing. An admin account is created automatically on first startup. Admins can create additional users, each with isolated resources.

## Authentication Flow

```
POST /auth/login
  → verify bcrypt password
  → issue JWT (HS256, configurable TTL)
  → store token version in Redis
```

Every authenticated request validates:
1. JWT signature and expiry
2. Token version against Redis (instant revocation support)

If Redis is unavailable, token version checking degrades and revocation guarantees are reduced.

## JWT Configuration

| `.env` variable | Default | Description |
|-----------------|---------|-------------|
| `JWT_SECRET` | _(required)_ | Signing key — **change in production** |
| `JWT_EXPIRE_MINUTES` | `60` | Token lifetime in minutes |

## User Roles

| Role | Permissions |
|------|-------------|
| `admin` | Full access: manage all users, view all logs, edit all settings |
| `user` | Own resources only: Gmail worker, bots, prompts, OAuth token |

## Resource Isolation

Each user owns:
- Gmail OAuth token (`oauth_tokens` table, scoped by `user_id`)
- Gmail worker state and email records
- Telegram bots (`bot` table, `user_id` FK)
- Per-user settings (`user_settings`, `user_id` FK)
- Custom prompt overrides (`user_prompts`, `user_id` FK)
- Outgoing email drafts (`outgoing_email_drafts`, scoped by `user_id`)
- Reply format settings and templates (`reply_format_settings`, `reply_templates`)

## Password Management

- Passwords hashed with **bcrypt** (cost factor 12)
- Admin password set via `ADMIN_PASSWORD` in `.env` on first startup
- User passwords set by admin in the User Management page
- No password reset flow — admin resets directly from UI

## Token Revocation

Changing a password or logging out increments the token version in Redis. All previously issued tokens for that user become immediately invalid.

## Related

- [Web UI →](ui.md)
