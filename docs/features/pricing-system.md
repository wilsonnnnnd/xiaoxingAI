# Pricing System

## What It Does

The pricing system converts tracked AI token usage into estimated cost using a centralized pricing table.

## Why It Exists

The application needs a practical cost estimate for:

- personal dashboard cost visibility
- admin dashboard global cost tracking
- cost breakdown views
- future billing and pricing evolution

## Pricing Source

Primary configuration source:

- `AI_PRICING_JSON`

Related API endpoints:

- `GET /api/config/pricing`
- `POST /api/config/pricing`

Admin settings UI:

- structured pricing editor in the settings area

## Backend Architecture

- pricing helpers: `app/core/ai_usage.py`
- config API: `app/api/routes/config.py`

The backend reads configured rates first and falls back to built-in defaults only when necessary.

## Frontend Architecture

- settings page integration: `frontend/src/features/settings/components/SettingsPage.tsx`
- pricing editor: `frontend/src/features/settings/components/PricingSettings.tsx`

## Data Flow

1. Admin reads pricing via `/api/config/pricing`
2. Admin updates pricing through the structured settings UI
3. Backend validates and stores the configuration in the centralized pricing source
4. New AI analytics records use the updated pricing for future estimated costs

## Historical Cost Behavior

Historical cost is not recomputed.

That means:

- old analytics rows keep their stored `estimated_cost_usd`
- pricing changes affect future analytics rows only

## Important Design Decisions

- one centralized pricing source
- structured admin editing instead of raw JSON-only workflow
- safe fallback defaults remain available
- stored historical estimates remain stable
