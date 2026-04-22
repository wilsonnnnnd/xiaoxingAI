# System Overview

## What This System Is

Xiaoxing AI is an AI SaaS application for email-centric workflows.
It combines public product marketing, authenticated user workspaces, administrator analytics, and operational tooling in one system.

## Product Surfaces

- Public Homepage: public landing page at `/`
- User Dashboard: personal dashboard for authenticated normal users at `/dashboard`
- Admin Dashboard: global analytics and operations dashboard for authenticated admins at `/dashboard`

## Core Capabilities

- Gmail integration with per-user OAuth tokens
- Worker-driven email polling and processing
- AI-based analysis, summarization, and reply-draft generation
- Telegram bot integration for notifications and interactive flows
- AI usage analytics with token, model, and estimated-cost tracking
- Configurable pricing table used for future cost estimation
- Role-based authentication, navigation, and route behavior

## High-Level Architecture

- Backend API: FastAPI application under `app/`
- Frontend SPA: React + Vite application under `frontend/`
- Database: PostgreSQL for users, settings, email records, prompts, analytics, and logs
- Redis: optional runtime support for caching and other non-critical infrastructure concerns

## Main Backend Layers

- `app/api/routes/`: HTTP interface
- `app/core/`: shared infrastructure and application setup
- `app/domains/`: domain-specific business logic
- `app/workflows/`: multi-step orchestration across domains
- `app/db/repositories/`: repository-style SQL access layer

## Main Frontend Layers

- `frontend/src/features/`: feature-based product modules
- `frontend/src/components/`: shared UI and layout components
- `frontend/src/config/`: shared configuration such as navigation
- `frontend/src/i18n/`: translation catalogs and language handling

## Why The Structure Matters

The system is no longer a single internal tool page.
It now supports:

- a public marketing surface
- a user-facing product experience
- an admin-facing operations and analytics surface

That split is reflected in the documentation, navigation, route behavior, and backend API boundaries.
