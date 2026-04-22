# User API

## Purpose

User APIs expose authenticated, user-scoped product functionality.

## Main Endpoints

### Authentication

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `POST /api/auth/change-password`

### Personal dashboard

- `GET /api/dashboard`

### Processed email and inbox

- `GET /api/emails/processed`
- `GET /api/emails/processed/stats`
- `GET /api/emails/processed/{id}`

### Worker and logs

- `GET /api/worker/status`
- `GET /api/worker/logs`
- `GET /api/worker/logs/window`

### Gmail

- `GET /api/gmail/auth/url`
- `GET /api/gmail/auth`
- `GET /api/gmail/callback`

### Settings and formatting

- `GET /api/reply-format`
- `PUT /api/reply-format`
- reply-template CRUD endpoints

## Access Rules

- endpoints are scoped to the authenticated user unless explicitly admin-only elsewhere
- normal users should not receive global admin analytics

## Related Docs

- [User dashboard](../features/user-dashboard.md)
- [Gmail integration](../features/gmail-integration.md)
