# Production Notes

## Security

- always replace the default `JWT_SECRET`
- do not commit `.env` or `credentials.json`
- restrict admin account access and rotate credentials when needed
- protect Telegram callback secrets and webhook secrets

## OAuth and Integrations

- ensure Google OAuth redirect URIs match the deployed backend
- ensure `FRONTEND_URL` matches the actual frontend origin
- use HTTPS for Telegram webhook mode

## Data and Analytics

- PostgreSQL is the source of truth for users, emails, prompts, logs, and analytics
- AI usage analytics should be monitored for growth over time
- historical stored estimated cost is stable and not recomputed when pricing changes

## Runtime Operations

- monitor worker start, stop, and polling behavior
- validate Redis availability according to your expected runtime mode
- keep an eye on dashboard health indicators and recent error logs
