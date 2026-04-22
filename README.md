# Xiaoxing AI

Xiaoxing AI is a production-style AI SaaS application for Gmail-driven workflows.
It combines a public marketing homepage, an authenticated user dashboard, an admin dashboard, Gmail and Telegram integrations, and a tracked AI usage and pricing system.

[中文说明](README.zh.md)

## Overview

The application has three distinct product surfaces:

- Public Homepage: public-facing landing page at `/`
- User Dashboard: authenticated personal workspace at `/dashboard` for normal users
- Admin Dashboard: authenticated analytics and operations dashboard at `/dashboard` for admins

Core capabilities:

- Gmail processing pipeline with per-user OAuth and worker execution
- Telegram bot integration for notifications and interactive flows
- AI usage analytics persisted in `ai_usage_analytics`
- Configurable pricing via `AI_PRICING_JSON`, API endpoints, and admin settings UI
- Role-aware navigation, routing, and access control
- Domain-oriented backend structure with `domains/`, `core/`, `workflows/`, and repository-based database access

## Key Features

- Public product landing page that remains separate from authenticated app navigation
- Personal user dashboard for email activity, worker state, token usage, and estimated cost
- Admin dashboard for global metrics, top users, model usage, and cost breakdown
- AI usage tracking with per-request model, token, and estimated-cost analytics
- Configurable pricing table with safe fallback defaults and admin editing support
- Gmail worker system with user-scoped polling, processed email storage, and automation rules
- Telegram bot management and delivery flows
- Admin user management, invite-based registration, prompt management, and debugging tools

## Architecture Summary

Backend:

- `app/api/routes/`: HTTP route modules
- `app/core/`: configuration, auth, app setup, realtime, and tooling infrastructure
- `app/domains/`: domain logic for Gmail, worker runtime, Telegram, and outgoing flows
- `app/workflows/`: cross-domain orchestration such as the email processing flow
- `app/db/repositories/`: SQL access layer grouped by resource

Frontend:

- `frontend/src/features/`: feature-based React modules
- `frontend/src/components/`: shared UI primitives and layout
- `frontend/src/config/navigation.ts`: role-aware navigation configuration
- `frontend/src/i18n/`: English and Chinese UI catalogs

## Quick Start

### Requirements

- Python 3.11+
- Node.js 18+
- PostgreSQL
- Redis recommended
- Google OAuth credentials for Gmail
- Optional LLM provider credentials depending on deployment mode

### Setup

1. Copy `.env.example` to `.env`
2. Configure database, auth, Gmail, Telegram, and LLM settings
3. Install backend dependencies with `pip install -r requirements.txt`
4. Install frontend dependencies with `cd frontend && npm install`
5. Run the backend with `uvicorn app.main:app --reload`
6. Run the frontend with `cd frontend && npm run dev`

See the full setup and deployment docs:

- [Local setup](docs/development/local-setup.md)
- [Environment variables](docs/deployment/environment-variables.md)
- [Deployment guide](docs/deployment/deploy.md)

## Documentation

Start here:

- [Documentation index](docs/README.md)
- [System overview](docs/architecture/system-overview.md)
- [Backend architecture](docs/architecture/backend-architecture.md)
- [Frontend architecture](docs/architecture/frontend-architecture.md)
- [Project structure](docs/development/project-structure.md)

Feature and API references:

- [Admin dashboard](docs/features/admin-dashboard.md)
- [User dashboard](docs/features/user-dashboard.md)
- [AI usage tracking](docs/features/ai-usage-tracking.md)
- [Pricing system](docs/features/pricing-system.md)
- [Dashboard API](docs/api/dashboard-api.md)
- [Config API](docs/api/config-api.md)

## Architecture Diagram

Public visitor
→ `/`
→ Public Homepage

Authenticated user
→ `/dashboard`
→ role check from current user identity
  → `admin`
    → Admin Dashboard
    → global analytics, top users, cost breakdown, worker health
  → `user`
    → User Dashboard
    → personal email activity, token usage, estimated cost, worker status

Operational request flow
→ User action or worker poll
→ FastAPI route layer
→ domain logic / workflow orchestration
→ AI provider call
→ usage metadata returned
→ pricing lookup from centralized pricing source
→ analytics row written to `ai_usage_analytics`
→ persisted email/log/runtime data updated

Analytics outputs
→ User Dashboard reads personal aggregates from persisted user-scoped data
→ Admin Dashboard reads global aggregates from persisted system-wide data

Role separation
→ `/` stays public
→ `/dashboard` is authenticated
→ normal users never receive admin/global analytics
→ admins keep the global dashboard view

## Documentation Structure

```text
docs/
  architecture/
  features/
  api/
  deployment/
  development/
```

The `docs/` tree is the maintained documentation source of truth. Legacy documentation folders have been removed to avoid duplication and stale architecture notes.
