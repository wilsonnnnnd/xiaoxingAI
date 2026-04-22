# Worker System

## What It Does

The worker system runs Gmail polling and processing for user accounts.
It also exposes runtime status to both users and administrators.

## Why It Exists

Email processing is asynchronous and operationally significant.
The application needs a runtime layer that can:

- poll Gmail on an interval
- report status to the UI
- support admin monitoring
- expose user-scoped worker state

## Backend Architecture

- domain runtime: `app/domains/worker/`
- worker APIs:
  - `GET /api/worker/status`
  - `POST /api/worker/start`
  - `POST /api/worker/stop`
  - `POST /api/worker/poll`

User-level status is also surfaced through the dashboard and Gmail status endpoints.

## Frontend Architecture

- worker status hook: `frontend/src/hooks/useWorkerStatus.ts`
- Gmail feature pages and dashboards consume worker status

## Data Flow

1. Worker runtime polls Gmail according to user settings
2. Runtime status is exposed through APIs and websocket updates
3. Dashboards and Gmail UI consume the current state

## Important Design Decisions

- admins can control global worker lifecycle
- normal users receive only their own worker view
- worker state is part of both operational monitoring and daily product usability
