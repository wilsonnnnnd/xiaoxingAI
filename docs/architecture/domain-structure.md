# Domain Structure

## Why Domain Structure Exists

The backend is organized around business domains rather than a single flat services layer.
This makes it easier to reason about ownership and runtime behavior as the product grows.

## Current Domains

### `app/domains/gmail/`

Responsibilities:

- Gmail OAuth integration
- Gmail client behavior
- email retrieval support
- Gmail-specific runtime helpers used by the worker system

### `app/domains/worker/`

Responsibilities:

- worker lifecycle
- user-scoped worker status
- start, stop, poll, and runtime state reporting

### `app/domains/telegram/`

Responsibilities:

- Telegram messaging
- callback and delivery logic
- webhook and polling-related integration helpers

### `app/domains/outgoing/`

Responsibilities:

- outgoing email drafts
- confirmation and action flows
- integration points for reply and send workflows

## Relationship To Other Layers

- routes expose domains to HTTP clients
- workflows orchestrate multiple domains together
- repositories provide persistent storage access to domains and workflows
- core provides shared infrastructure for domains

## Practical Rule Of Thumb

- put transport concerns in routes
- put shared infrastructure in `core`
- put business-specific runtime logic in `domains`
- put multi-step orchestration in `workflows`
- put SQL in repositories
