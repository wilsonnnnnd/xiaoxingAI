# Admin Dashboard

## What It Does

The admin dashboard provides a global operational and analytics view of the system.
It is intended for administrators only.

## Why It Exists

Administrators need a single place to monitor:

- system growth
- AI usage
- estimated cost
- top users
- worker and operational status
- future business metrics such as membership readiness

## Frontend Architecture

- main page component: `frontend/src/features/dashboard/components/DashboardPage.tsx`
- chart primitives: `frontend/src/features/dashboard/components/LineChart.tsx`
- data client: `frontend/src/features/dashboard/api/index.ts`

The admin view is rendered at `/dashboard` when the authenticated user role is `admin`.

## Backend Architecture

- endpoint: `/api/admin/dashboard`
- route module: `app/api/routes/admin_dashboard.py`
- data sources:
  - `user`
  - `email_records`
  - `log`
  - `ai_usage_analytics`
  - worker runtime status

## Data Flow

1. Admin frontend requests `/api/admin/dashboard`
2. Backend aggregates totals, daily series, operational state, top users, and cost breakdown
3. Frontend renders KPI cards, charts, top users, and recent activity panels

## Key Modules and Files

- `app/api/routes/admin_dashboard.py`
- `app/db/repositories/ai_usage_repo.py`
- `app/db/repositories/email_repo.py`
- `app/db/repositories/log_repo.py`
- `app/domains/worker/`

## Important Design Decisions

- admin-only scope: no normal user should receive global metrics
- dashboard uses persisted analytics rather than fabricated values
- placeholder business metrics remain visible when not yet implemented, but are labeled intentionally
- top users and cost breakdown use real analytics data only
