# Deploy

## Purpose

This guide describes the production deployment shape for Xiaoxing AI.

## Deployment Model

Recommended production stack:

- FastAPI backend
- built frontend assets served behind a reverse proxy
- PostgreSQL
- Redis recommended
- HTTPS reverse proxy such as Nginx
- process management via systemd, container platform, or equivalent

## Required Services

- application server
- PostgreSQL
- Redis recommended for full runtime behavior
- public HTTPS origin if using Telegram webhook mode
- Google OAuth credentials for Gmail

## Deployment Steps

1. Provision PostgreSQL and Redis
2. Set all required environment variables
3. Install backend and frontend dependencies
4. Build the frontend with `cd frontend && npm run build`
5. Run the backend process with a production ASGI server strategy
6. Place the app behind HTTPS
7. Configure `FRONTEND_URL` to the deployed frontend origin
8. Configure Gmail OAuth redirect URIs to match the deployed backend
9. Optionally configure Telegram webhook mode with a public HTTPS backend URL

## Operational Notes

- use a strong `JWT_SECRET`
- do not commit `credentials.json` or `.env`
- protect admin credentials and pricing configuration carefully
- monitor worker health, dashboard analytics, and database size over time
- remember that pricing changes affect future analytics rows, not historical stored estimates

## Recommended Checks After Deployment

- `/health` responds
- login works
- `/dashboard` renders the correct role-aware dashboard
- Gmail OAuth completes successfully
- worker status is visible
- admin pricing editor loads and saves

## Related Docs

- [Environment variables](environment-variables.md)
- [Production notes](production-notes.md)
