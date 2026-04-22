# Project Structure

## Root Layout

```text
app/        backend application
frontend/   React frontend
docs/       maintained project documentation
tests/      automated tests
```

## Backend Structure

- `app/api/routes/`: route modules
- `app/core/`: app setup, auth, config, realtime, tooling
- `app/domains/`: business domains
- `app/workflows/`: multi-step orchestration
- `app/db/repositories/`: SQL access layer
- `app/schemas/`: request and response models

## Frontend Structure

- `frontend/src/features/`: feature-based modules
- `frontend/src/components/`: shared UI and layout
- `frontend/src/config/`: navigation and shared configuration
- `frontend/src/i18n/`: translation catalogs
- `frontend/src/types/`: shared frontend type definitions

## Documentation Structure

- `docs/architecture/`
- `docs/features/`
- `docs/api/`
- `docs/deployment/`
- `docs/development/`
