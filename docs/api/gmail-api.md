# Gmail API

## Purpose

The Gmail API surface supports OAuth connection, worker status, email processing views, and Gmail-related product workflows.

## Main Endpoints

### Gmail auth and integration

- `GET /api/gmail/auth/url`
- `GET /api/gmail/auth`
- `GET /api/gmail/callback`

### Worker status

- `GET /api/worker/status`
- `GET /api/gmail/workstatus`

### Processed email views

- `GET /api/emails/processed`
- `GET /api/emails/processed/stats`
- `GET /api/emails/processed/{id}`

### AI processing helpers

- `GET /api/ai/ping`
- `POST /api/ai/analyze`
- `POST /api/ai/summary`
- `POST /api/ai/process`

## Notes

- Gmail data is user-scoped
- worker control endpoints are admin-only where they affect global runtime lifecycle
- processed email APIs are the maintained inbox-facing surface

## Related Docs

- [Gmail integration](../features/gmail-integration.md)
- [Worker system](../features/worker-system.md)
