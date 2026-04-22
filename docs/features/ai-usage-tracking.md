# AI Usage Tracking

## What It Does

AI usage tracking records model usage, token counts, and estimated cost for AI requests that provide usage metadata.

## Why It Exists

The analytics layer powers:

- user dashboard usage metrics
- admin dashboard usage and cost views
- model usage reporting
- top users and cost breakdown reporting
- future billing and pricing evolution

## Persistence Model

Table:

- `ai_usage_analytics`

Common stored fields:

- `user_id`
- `recorded_at`
- `provider`
- `source`
- `purpose`
- `model_name`
- `prompt_tokens`
- `completion_tokens`
- `total_tokens`
- `estimated_cost_usd`

## Backend Architecture

- pricing and normalization support: `app/core/ai_usage.py`
- repository access: `app/db/repositories/ai_usage_repo.py`
- dashboard aggregation: `app/api/routes/admin_dashboard.py`

## Data Flow

1. An AI call completes
2. Usage metadata is extracted when available
3. Estimated cost is calculated from the centralized pricing source
4. A record is appended to `ai_usage_analytics`
5. Dashboard APIs aggregate the stored rows into summaries and charts

## Important Design Decisions

- append-only analytics model
- logging failures must not break the main AI request flow
- reuse persisted analytics for reporting rather than recomputing from unrelated logs
- estimated cost is stored per row for stability and future reporting consistency
