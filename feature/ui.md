# Web UI

## Overview

Xiaoxing ships a dark-themed single-page application (React + TypeScript + Vite + Tailwind CSS). In production mode the frontend is served directly by the FastAPI backend.

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/login` | Login | Email + password authentication |
| `/` | Home / Dashboard | System overview, quick-start checklist |
| `/skill` | Skills Hub | Entry point for Gmail and Chat sub-skills |
| `/skill/gmail` | Gmail | Worker control, live email log, per-user settings |
| `/skill/chat` | Chat | Bot worker control, persona generator, prompt management, live chat log |
| `/prompts` | Prompt Editor | View and edit all system prompts |
| `/settings` | Settings | Google OAuth, bot configuration, environment variables |
| `/users` | User Management | Admin-only: create/manage users |
| `/debug` | Debug Tools | Manual triggers for profile update, cache flush, etc. |

## Internationalisation (i18n)

- English and Chinese supported
- Language switcher in the top navigation bar
- Preference stored via **Zustand** (persists across page reloads)
- Translation keys in `frontend/src/i18n/en.ts` and `zh.ts`

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
| UI framework | React 18 |
| Language | TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Data fetching | TanStack Query v5 |
| State | Zustand |
| HTTP client | Axios |

## Related

- [Authentication →](auth.md)
