# Frontend Architecture

## Purpose

The frontend is a React single-page application that supports public visitors, authenticated users, and administrators without turning the public landing page into the in-app home.

## Main Structure

### `frontend/src/features/`

Product functionality is organized by feature.

Current notable features:

- `auth`
- `dashboard`
- `gmail`
- `inbox`
- `settings`
- `users`
- `prompts`
- `automationRules`
- `replyFormat`
- `debug`

Each feature typically owns:

- API client helpers
- page-level components
- feature-specific exports

### `frontend/src/components/`

Shared layout and UI primitives such as:

- `Layout`
- sidebar and navigation components
- shared cards, buttons, badges, form controls, and other reusable UI

### `frontend/src/config/`

Shared client configuration including navigation definitions and role-aware filtering logic.

### `frontend/src/i18n/`

English and Chinese translation catalogs plus the language utilities used across the app.

## Route Model

- `/`: public homepage
- `/home`: public homepage alias
- `/dashboard`: authenticated dashboard entry
- other authenticated product routes are grouped under the main app layout

The dashboard route is role-aware:

- admins see the admin dashboard
- normal users see the personal user dashboard

## State and Data Fetching

- React Query is used for API data fetching and caching
- Auth token is stored in local storage and used by the shared API client
- Shared user identity is commonly loaded through `getMe()`

## UI Principles

- light, airy, glass-like system
- restrained motion and hover behavior
- same visual language across public, user, and admin surfaces
- no heavy dark-panel admin theme

## Design Decisions

- keep the public homepage concept separate from the authenticated dashboard concept
- prefer feature-local API/client code over a large global state layer
- keep role-aware behavior close to navigation and route composition
