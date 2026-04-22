# Gmail Integration

## What It Does

The Gmail integration allows each user to connect a Gmail account, poll emails, process them through the AI workflow, and persist results for later review.

## Why It Exists

Gmail is the system's primary inbound workflow source.

## Backend Architecture

Main areas:

- OAuth handling in the service router registration
- Gmail domain code under `app/domains/gmail/`
- processed email APIs under `app/api/routes/email_records.py`

Persistent storage:

- `oauth_tokens`
- `email_records`

## Frontend Architecture

- Gmail management page under `frontend/src/features/gmail/`
- inbox and processed-email views under `frontend/src/features/inbox/`
- settings-driven OAuth entry points

## Data Flow

1. User starts Gmail OAuth
2. Backend redirects to Google and stores token on callback
3. Worker runtime polls Gmail for that user
4. Email processing workflow analyzes and persists results
5. Frontend reads processed email summaries and details

## Key Modules and Files

- `app/domains/gmail/`
- `app/api/routes/email_records.py`
- `frontend/src/features/gmail/`
- `frontend/src/features/inbox/`

## Important Design Decisions

- tokens are stored per user in the database
- processed email data is persisted for dashboard and inbox use
- Gmail integration remains user-scoped rather than global
