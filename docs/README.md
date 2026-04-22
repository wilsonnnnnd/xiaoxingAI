# Documentation Index

This documentation covers the current Xiaoxing AI system: product surfaces, architecture, APIs, deployment, and development workflows.

Use this page as the main entry point into `docs/`.

## How The Docs Are Structured

- `architecture/`: system shape, layering, and data movement
- `features/`: product and platform feature explanations
- `api/`: maintained API surface by audience and domain
- `deployment/`: runtime configuration and production notes
- `development/`: local setup and contributor-facing structure

## Architecture

- [System overview](architecture/system-overview.md): high-level product and system view
- [Backend architecture](architecture/backend-architecture.md): backend layering and responsibilities
- [Frontend architecture](architecture/frontend-architecture.md): frontend structure and route model
- [Data flow](architecture/data-flow.md): request, analytics, and dashboard flows
- [Domain structure](architecture/domain-structure.md): backend domain ownership and boundaries

## Features

- [Admin dashboard](features/admin-dashboard.md): global analytics and operations surface
- [User dashboard](features/user-dashboard.md): personal authenticated dashboard
- [AI usage tracking](features/ai-usage-tracking.md): token, model, and cost analytics
- [Pricing system](features/pricing-system.md): centralized pricing configuration and cost behavior
- [Gmail integration](features/gmail-integration.md): Gmail OAuth and processing flow
- [Worker system](features/worker-system.md): polling runtime and status model
- [Telegram integration](features/telegram-integration.md): notification and interaction flows
- [Authentication](features/authentication.md): login, roles, and protected access
- [Navigation and routing](features/navigation-and-routing.md): public vs authenticated route behavior

## API

- [API overview](api/api-overview.md): entry point for the maintained API surface
- [Admin API](api/admin-api.md): admin-only endpoints and capabilities
- [User API](api/user-api.md): authenticated user-scoped endpoints
- [Dashboard API](api/dashboard-api.md): user and admin dashboard payloads
- [Config API](api/config-api.md): config and pricing endpoints
- [Gmail API](api/gmail-api.md): Gmail, worker, and processed-email endpoints

## Deployment

- [Deploy](deployment/deploy.md): production deployment guide
- [Environment variables](deployment/environment-variables.md): configuration inventory
- [Production notes](deployment/production-notes.md): operational guidance

## Development

- [Local setup](development/local-setup.md): local environment and startup steps
- [Project structure](development/project-structure.md): backend, frontend, and docs layout
- [How to add feature](development/how-to-add-feature.md): recommended implementation path
