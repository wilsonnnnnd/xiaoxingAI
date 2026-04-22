# Admin API

## Purpose

Admin APIs expose system-wide management and monitoring capabilities.

## Main Endpoints

### Dashboard and analytics

- `GET /api/admin/dashboard`

### User and invite management

- `GET /api/users`
- `POST /api/users`
- `GET /api/users/{user_id}`
- `PUT /api/users/{user_id}`
- `GET /api/invites`
- `POST /api/invites`
- `POST /api/invites/{code}/revoke`

### Admin tools

- `GET /api/prompts`
- prompt CRUD endpoints under `/api/prompts/...`
- debug endpoints under `/api/debug/...`

### Worker control

- `POST /api/worker/start`
- `POST /api/worker/stop`
- `POST /api/worker/poll`

## Access Rules

- admin role required
- normal users must not receive global analytics or admin management data

## Related Docs

- [Admin dashboard](../features/admin-dashboard.md)
- [Navigation and routing](../features/navigation-and-routing.md)
