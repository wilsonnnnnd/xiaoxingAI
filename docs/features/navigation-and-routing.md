# Navigation and Routing

## What It Does

Navigation and routing define how public visitors, normal users, and admins move through the product.

## Why It Exists

The application now has multiple product surfaces and must avoid mixing:

- public marketing navigation
- normal user product navigation
- admin operations navigation

## Key Routes

- `/`: public homepage
- `/home`: public homepage alias
- `/dashboard`: authenticated dashboard entry
- `/inbox`: processed email inbox
- `/settings`: user and admin settings
- `/users`: admin user management
- `/prompts`: admin prompt management
- `/debug`: admin debugging tools

## Role Behavior

### Public visitors

- access the public homepage at `/`
- do not see dashboard access

### Normal users

- log in and land on `/dashboard`
- see the user dashboard
- do not receive admin-only entries

### Admin users

- log in and land on `/dashboard`
- see the admin dashboard
- see admin navigation items such as Users, Prompts, and Debug

## Navigation Architecture

- navigation config: `frontend/src/config/navigation.ts`
- sidebar rendering: `frontend/src/components/layout/Sidebar.tsx`

The sidebar applies role-aware filtering and authenticated dashboard replacement behavior so the in-app home stays consistent.

## Important Design Decisions

- keep the public homepage separate from the authenticated dashboard
- keep `/dashboard` as the authenticated app entry
- use role-aware rendering rather than duplicating full route trees
