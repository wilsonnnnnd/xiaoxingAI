# User Dashboard

## What It Does

The user dashboard is the authenticated home for normal users.
It shows personal activity and status rather than system-wide admin metrics.

## Why It Exists

The project has three separate product surfaces:

- public homepage
- user dashboard
- admin dashboard

The user dashboard exists so authenticated users have a useful in-app home without turning the public homepage into a private dashboard.

## Frontend Architecture

- route entry: `/dashboard`
- user view component: `frontend/src/features/dashboard/components/UserDashboardContent.tsx`
- shared dashboard route wrapper: `frontend/src/features/dashboard/components/DashboardPage.tsx`

User-facing content includes:

- personal email metrics
- personal token and estimated-cost metrics
- worker state
- personal recent activity
- quick links into inbox, Gmail tools, and settings

## Backend Architecture

- endpoint: `/api/dashboard`
- route module: `app/api/routes/admin_dashboard.py`

Although the route module also contains the admin dashboard endpoint, the user dashboard response is scoped strictly to the current user.

## Data Flow

1. Normal user logs in and is redirected to `/dashboard`
2. Frontend requests `/api/dashboard`
3. Backend aggregates current-user data from email, analytics, worker, and log sources
4. Frontend renders personal charts and status panels

## Key Modules and Files

- `frontend/src/features/dashboard/components/UserDashboardContent.tsx`
- `frontend/src/features/dashboard/api/index.ts`
- `app/api/routes/admin_dashboard.py`
- `app/db/repositories/ai_usage_repo.py`
- `app/db/repositories/email_repo.py`
- `app/db/repositories/log_repo.py`

## Important Design Decisions

- no admin or global metrics are exposed to normal users
- the public homepage stays public and separate
- `/dashboard` is the authenticated app entry for both roles, but rendering is role-aware
- placeholders are used for membership-related data that does not yet exist
