# Backend Architecture

## Purpose

The backend provides authenticated APIs, integrations, workflow orchestration, and persistent analytics for the product.

## Main Packages

### `app/api/routes/`

Route modules define the external API surface.
They stay relatively thin and delegate business logic to domains, workflows, and repositories.

Key route areas:

- auth and registration
- user and invite management
- Gmail and worker endpoints
- processed email APIs
- prompt and reply-format APIs
- admin and user dashboard APIs
- config and pricing APIs

### `app/core/`

Shared infrastructure and platform setup.

Key responsibilities:

- application factory and router registration
- configuration loading from environment
- authentication and authorization helpers
- realtime and websocket infrastructure
- reusable tool and debug infrastructure

### `app/domains/`

Domain-oriented business logic.

Current domains:

- `gmail/`
- `worker/`
- `telegram/`
- `outgoing/`

The domain layer is where runtime behavior should live when it is not just transport glue.

### `app/workflows/`

Cross-domain orchestration lives here.
The main example is the email processing flow, which coordinates Gmail retrieval, AI analysis, prompt usage, automation decisions, persistence, and notification behavior.

### `app/db/repositories/`

The SQL access layer is grouped by resource.
Examples:

- `user_repo.py`
- `email_repo.py`
- `ai_usage_repo.py`
- `log_repo.py`
- `invite_repo.py`

This keeps SQL discoverable and avoids scattering direct queries across route handlers.

## Request Handling Pattern

Typical request path:

1. FastAPI route receives request
2. Auth dependency resolves current user or admin
3. Route calls a domain, workflow, or repository helper
4. Repository reads or writes PostgreSQL
5. Response model is returned to the frontend

## Data and Runtime Boundaries

- Persistent state: PostgreSQL
- Optional runtime support: Redis
- External integrations: Gmail OAuth/API, Telegram API, AI providers
- Real-time frontend updates: websocket and status endpoints

## Design Decisions

- Keep route handlers thin
- Favor domain and workflow orchestration over large route files
- Keep SQL centralized in repositories
- Treat analytics logging as non-blocking support logic rather than critical-path business logic
