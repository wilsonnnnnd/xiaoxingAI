# Data Flow

## Overview

The application has several important data flows.
The most important ones are Gmail processing, AI usage analytics, and dashboard aggregation.

## Gmail Processing Flow

1. A user authorizes Gmail through OAuth
2. OAuth token is stored in `oauth_tokens`
3. Worker runtime polls Gmail for the user
4. Email content enters the processing workflow
5. AI analysis and summary are generated
6. Email metadata and processing results are stored in `email_records`
7. Optional Telegram notifications are sent
8. Logs and worker statistics are recorded

## AI Usage Analytics Flow

1. An AI request completes with model and token usage metadata
2. Usage is normalized into an analytics record
3. A row is appended to `ai_usage_analytics`
4. Stored fields include token counts, model name, source, purpose, and estimated cost
5. Dashboard endpoints aggregate these rows into summaries and time series

## Pricing Flow

1. Pricing configuration is loaded from the centralized pricing source
2. AI usage logging calculates an estimated cost for new records
3. The stored estimated cost is saved with each analytics row
4. Future dashboard and reporting views read the stored value

Important consequence:

- historical stored cost is not recomputed when pricing changes
- new pricing affects new usage records going forward

## Dashboard Flow

### User Dashboard

1. Frontend calls `/api/dashboard`
2. Backend aggregates current-user email counts, worker state, analytics totals, and recent logs
3. Frontend renders personal metrics and charts

### Admin Dashboard

1. Frontend calls `/api/admin/dashboard`
2. Backend aggregates system-wide users, analytics, worker health, top users, and cost breakdown
3. Frontend renders admin-only metrics and operational panels

## Navigation and Role Flow

1. User authenticates
2. Frontend loads current user identity
3. Navigation filters by role
4. `/dashboard` renders either the admin or user dashboard
5. Public visitors remain on the public homepage routes
