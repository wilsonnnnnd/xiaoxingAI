# Dashboard API

## Purpose

The dashboard API surface supports both the personal user dashboard and the admin dashboard.

## Endpoints

### User dashboard

- `GET /api/dashboard`

Returns current-user data such as:

- personal email totals
- token totals
- estimated cost
- worker status
- recent activity
- daily token, cost, and email activity series

### Admin dashboard

- `GET /api/admin/dashboard`

Returns system-wide data such as:

- total users
- active and new users
- total emails processed
- total tokens used
- estimated cost
- top users
- cost breakdown
- operational status
- recent system activity

## Design Notes

- both endpoints aggregate from persisted sources rather than inventing synthetic values
- both endpoints share the dashboard route module, but enforce different scopes

## Related Docs

- [Admin dashboard](../features/admin-dashboard.md)
- [User dashboard](../features/user-dashboard.md)
- [AI usage tracking](../features/ai-usage-tracking.md)
