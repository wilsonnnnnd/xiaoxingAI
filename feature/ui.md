# Web UI

## Overview

Xiaoxing ships a light, minimal single-page application (React + TypeScript + Vite + Tailwind CSS). In production mode the frontend is served directly by the FastAPI backend.

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/login` | Login | Email + password authentication |
| `/home` | Home / Dashboard | System overview, quick-start checklist |
| `/skill` | Skills Hub | Entry point for skills (currently Gmail) |
| `/skill/gmail` | Gmail | Worker control, live email log, per-user settings |
| `/prompts` | Prompt Editor | View and edit prompt files (admin + limited non-admin view) |
| `/settings` | Settings | Google OAuth, bot configuration, environment variables |
| `/settings/reply-format` | Reply Format | Configure per-user reply templates and signature |
| `/users` | User Management | Admin-only: create/manage users |
| `/debug` | Debug Tools | Admin-only debug utilities |
| `/help` | Help | Quick-start and common operations |

## Internationalisation (i18n)

- English and Chinese supported
- Language switcher in the Sidebar
- UI language is stored in local storage, and is saved to the server when the user manually switches
- Translation keys in `frontend/src/i18n/en.ts` and `zh.ts`

## Mobile Support

- `md` and above: fixed Sidebar layout
- below `md`: top bar + drawer Sidebar (overlay with backdrop; closes on navigation)

See:

- `frontend/src/components/Layout.tsx`
- `frontend/src/components/layout/Sidebar.tsx`

## UI Docs

- Design system: [doc/ui-design.md](../doc/ui-design.md)
- Frontend engineering guide: [doc/ui-guide.md](../doc/ui-guide.md)

## Development Mode

```bash
cd frontend
npm run dev
```
Vite dev server on `http://localhost:5173` with HMR. API calls proxy to `http://127.0.0.1:8000`.

## Production Mode

```bash
cd frontend
npm run build
```
Built files go to `frontend/dist/`. The FastAPI app serves them at `http://127.0.0.1:8000`.

## Tech Stack

| Layer | Library |
|-------|---------|
| UI framework | React 19 |
| Language | TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Data fetching | TanStack Query v5 |
| State | Zustand |
| HTTP client | Axios |

## Related

- [Authentication →](auth.md)
