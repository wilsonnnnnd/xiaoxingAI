# Authentication

## What It Does

Authentication manages login, registration, current-user identity, password changes, and role-based access.

## Why It Exists

The product needs to distinguish between:

- public visitors
- authenticated normal users
- authenticated admins

## Backend Architecture

Core auth modules:

- `app/api/routes/auth.py`
- `app/core/auth.py`

Main endpoints:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `POST /api/auth/change-password`

## Frontend Architecture

- auth feature pages under `frontend/src/features/auth/`
- shared identity fetch through `getMe()`
- role-aware routing and navigation in layout and dashboard code

## Role Model

- `admin`
- `user`

Role affects:

- dashboard rendering
- navigation entries
- protected admin routes and APIs

## Important Design Decisions

- JWT-based authentication
- invite-aware registration support
- admin-only APIs use explicit admin dependencies
- authenticated app home is `/dashboard`, while the public homepage remains public
