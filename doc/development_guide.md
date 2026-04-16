﻿# Xiaoxing Project Development and Extension Guide

This document explains how developers can add new features to the Xiaoxing project and where each module should be placed.

---

## 1. Architecture Overview

The project uses a separated frontend and backend structure:

- **Backend**: Built with Python FastAPI. It uses a simple layered design with API, Service or Skill, Repository, and database model layers.
- **Frontend**: Built with React 19, TypeScript, and Vite. It uses a feature-based structure. TanStack Query manages server state, and Zustand manages client state.
- **Example new page**: The reply format page at `/settings/reply-format` in `frontend/src/features/replyFormat/` is used to edit reply templates and signatures.

```
Request flow (backend):
HTTP → Route (FastAPI) → Service/Skill → Repository → PostgreSQL
                       → Core (LLM / Redis / Telegram)

Data flow (frontend):
Page component → useQuery/useMutation → features/xxx/api/index.ts → axios (client.ts) → Backend API
```

---

## 2. Backend Extension Flow

### 2.1 Project Structure

```
app/
├── main.py              # app entry, middleware, route registration, lifespan
├── config.py            # re-export of core/config.py
├── api/routes/          # HTTP API layer
├── core/                # core tools (JWT, LLM, Redis, Telegram, WebSocket, Tools)
├── db/
│   ├── base.py          # SQLAlchemy models + init_db()
│   ├── session.py       # connection pool
│   └── repositories/    # data access layer (all SQL)
├── schemas/             # Pydantic request and response models
├── services/            # business logic layer
├── skills/              # complex async modules, such as Gmail polling
└── utils/               # helper functions, such as prompt_loader and json_parser
```

### 2.2 Environment Variables and Config in `app/core/config.py`

All settings come from environment variables. They are loaded in the `Settings` class and accessed by the global `get_settings()` singleton. When you add a new config field, add it in this file.

| Variable | Default | Description |
|--------|--------|------|
| `POSTGRES_DSN` | `postgresql://postgres:postgres@localhost:5432/xiaoxing` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6380` | Redis connection string |
| `JWT_SECRET` | `change-me-in-production` | JWT signing key, must be changed in production |
| `JWT_EXPIRE_MINUTES` | `60` | Token lifetime |
| `ADMIN_USER` | — | Admin email |
| `ADMIN_PASSWORD` | — | Admin password |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin |
| `LLM_BACKEND` | `local` | `local` or `openai` |
| `LLM_API_URL` | `http://127.0.0.1:8001/v1/chat/completions` | Main LLM endpoint |
| `LLM_MODEL` | `local-model` | Main model name |
| `ROUTER_API_URL` | `http://127.0.0.1:8002/v1/chat/completions` | Small router model endpoint |
| `ROUTER_MODEL` | `local-router` | Router model name |
| `OPENAI_API_KEY` | — | Used when `LLM_BACKEND=openai` |
| `UI_LANG` | `en` | Default UI language, `en` or `zh` |
| `TELEGRAM_BOT_TOKEN` | — | Bot token |
| `TELEGRAM_CHAT_ID` | — | Default push chat ID |
| `GMAIL_POLL_INTERVAL` | `300` | Gmail polling interval in seconds |
| `GMAIL_POLL_QUERY` | `is:unread in:inbox` | Gmail search query |
| `GMAIL_POLL_MAX` | `5` | Max emails per run |
| `GMAIL_MARK_READ` | `true` | Mark email as read after processing |
| `NOTIFY_MIN_PRIORITY` | `""` | Minimum priority for push messages, empty means all |

**Prompt file config, can be overridden by the database:**

| Variable | Default file path |
|--------|-------------|
| `PROMPT_ANALYZE` | `gmail/email_analysis.txt` |
| `PROMPT_SUMMARY` | `gmail/email_summary.txt` |
| `PROMPT_TELEGRAM` | `gmail/telegram_notify.txt` |
| `PROMPT_CHAT` | `chat.txt` |
| `PROMPT_PROFILE` | `user_profile.txt` |

### 2.3 Database Models in `app/db/base.py`

SQLAlchemy Core table definitions are stored in this file. The `init_db()` function creates tables automatically when the app starts.

**Current tables:**

| Table | Main fields | Description |
|------|----------|------|
| `user` | `id`, `email`, `role`, `password_hash`, `worker_enabled`, `min_priority`, `max_emails_per_run`, `poll_interval` | User account |
| `bot` | `id`, `user_id`, `name`, `token`, `chat_id`, `is_default`, `chat_prompt_id`, `bot_mode` | Telegram bot config |
| `system_prompts` | `id`, `name`, `type`, `content`, `is_default` | Built-in system prompts |
| `user_prompts` | `id`, `user_id`, `name`, `type`, `content`, `is_default`, `meta` | User custom prompts |
| `oauth_tokens` | `id`, `user_id`, `token_json` | Gmail OAuth token |
| `email_records` | `id`, `user_id`, `email_id`, `subject`, `sender`, `analysis_json`, `summary_json`, `telegram_msg`, `priority`, `sent_telegram` | Saved processed emails |
| `reply_templates` | `id`, `user_id`, `name`, `body_template`, `closing`, `is_default` | User email reply templates |
| `reply_format_settings` | `user_id`, `default_template_id`, `signature` | User reply format settings |
| `worker_stats` | `id`, `user_id`, `total_sent`, `total_fetched`, `total_errors`, `total_tokens`, `last_poll` | Gmail worker stats |
| `user_profile` | `bot_id` as PK, `profile` | Text profile for each bot conversation |
| `log` | `id`, `user_id`, `ts`, `level`, `log_type`, `tokens`, `msg` | System log |

### 2.4 Pydantic Schemas in `app/schemas/`

This folder defines the request and response format for HTTP APIs. Files are grouped by resource type.

| File | Main schemas |
|------|-------------|
| `auth.py` | `AdminLoginRequest` |
| `user.py` | `UserCreate`, `UserUpdate` |
| `bot.py` | `BotCreate`, `BotUpdate` |
| `prompt.py` | `PromptCreate`, `PromptUpdate` |
| `chat.py` | `ChatPersonaRequest` |
| `persona.py` | `PersonaConfigSave` |

**Example of a new schema:**
```python
# app/schemas/my_feature.py
from pydantic import BaseModel

class MyFeatureCreate(BaseModel):
    name: str
    value: int

class MyFeatureResponse(BaseModel):
    id: int
    name: str
    value: int
```

### 2.5 Repository Layer in `app/db/repositories/`

**Purpose**: put all SQL operations here. Do not run SQL directly in a Route or Service. Return values should be `dict` or `list[dict]`.

**Current repositories and method signatures:**

```python
# user_repo.py
create_user(email, display_name, role, password_hash) -> dict
get_user_by_email(email) -> dict | None
get_user_by_id(user_id) -> dict | None
list_users() -> list[dict]
update_user(user_id, **fields) -> dict | None

# bot_repo.py
create_bot(user_id, name, token, chat_id, is_default, chat_prompt_id, bot_mode) -> dict
get_bot(bot_id) -> dict | None
get_bots_by_user(user_id) -> list[dict]
get_default_bot(user_id) -> dict | None
get_all_bots() -> list[dict]
get_notify_bots(user_id) -> list[dict]   # mode='all' or 'notify'
update_bot(bot_id, user_id, **fields) -> dict | None
delete_bot(bot_id) -> bool

# prompt_repo.py
get_prompts(user_id, ptype) -> list[dict]
get_prompt(prompt_id) -> dict | None
create_prompt(user_id, name, ptype, content, is_default, meta) -> dict
update_prompt(prompt_id, **fields) -> dict | None
delete_prompt(prompt_id) -> bool
get_user_prompt(user_id, filename) -> str | None
save_user_prompt(user_id, filename, content) -> None
list_user_prompt_names(user_id) -> list[str]

# email_repo.py
is_email_processed(email_id, user_id) -> bool
save_email_record(...) -> None
get_email_records(limit, priority, user_id) -> list[dict]
count_email_records(user_id) -> int

# log_repo.py
insert_log(ts, level, msg, log_type, tokens, user_id) -> None
get_recent_logs(limit=10, log_type=None, user_id=None) -> list[dict]
clear_logs(log_type, user_id) -> int

# oauth_repo.py
load_token_json(user_id) -> str | None
save_token_json(token_json, user_id) -> None

# stats_repo.py
get_worker_stats(user_id) -> dict
save_worker_stats(...) -> None

# profile_repo.py
get_profile(bot_id) -> str
save_profile(bot_id, profile) -> None

# persona_repo.py
get_persona_configs() -> dict[str, dict[str, str]]
upsert_persona_config(category, key, content) -> None
```

**Template for a new repository:**
```python
# app/db/repositories/my_repo.py
from app.db.session import get_conn

async def create_item(name: str, user_id: int) -> dict:
    async with get_conn() as conn:
        row = await conn.fetchrow(
            "INSERT INTO my_table (name, user_id) VALUES ($1, $2) RETURNING *",
            name, user_id
        )
        return dict(row)
```

### 2.6 Service and Skill Layer

- **Service** in `app/services/`: business logic that combines repositories and core tools.
- **Skill** in `app/skills/`: more complex modules with their own lifecycle, such as background polling workers.

**Current services:**

| File | Class | Main methods |
|------|----|----------|
| `gmail_service.py` | `GmailService` | `fetch()`, `process()` |
| `telegram_service.py` | `TelegramService` | `clear_history()`, `generate_profile()` |
| `persona_prompt_service.py` | `PersonaPromptService` | `generate(payload)` for a 4-stage prompt flow |

**Skill folder structure, using `gmail/` as an example:**
```
app/skills/gmail/
├── schemas.py    # Pydantic models for this skill
├── client.py     # Gmail API client wrapper
├── auth.py       # OAuth2 flow
├── pipeline.py   # AI processing pipeline, analyze to summarize to telegram
└── worker.py     # background polling worker
```

### 2.7 API Route Layer in `app/api/routes/`

Add new FastAPI routers here. Then register them in `app/api/routes/__init__.py` and include them in `app/main.py`.

**Current routes overview:**

| File | Main endpoints |
|------|----------|
| `health.py` | `GET /`, `GET /health` |
| `auth.py` | `POST /auth/login`, `GET /auth/me` |
| `users.py` | `GET/POST /users`, `GET/PUT /users/{id}` |
| `bots.py` | `GET/POST /users/{id}/bots`, `PUT/DELETE .../bots/{bot_id}`, `POST .../set-default` |
| `db_prompts.py` | `GET/POST /db/prompts`, `PUT/DELETE /db/prompts/{id}` |
| `prompts.py` | `GET/POST/DELETE /prompts/{filename}` |
| `config.py` | `GET/POST /config`, admin only |
| `admin_persona.py` | `GET/PUT /admin/persona-config`, admin only |
| `email_records.py` | `GET /email/records`, `GET /email/records/{email_id}` |
| `ai.py` | `GET /ai/ping`, `POST /ai/analyze`, `/ai/summary`, `/ai/process` |
| `gmail_actions.py` | `POST /gmail/fetch`, `POST /gmail/process` |
| `telegram_tools.py` | `POST /telegram/test`, `GET /telegram/chat_id`, `POST /telegram/bot/clear_history`, `GET/DELETE/POST /telegram/bot/profile` |
| `stats_logs.py` | `GET/DELETE /worker/logs`, `GET /db/stats` |
| `chat.py` | `POST /chat/generate_persona_prompt` |
| `reply_format.py` | `GET/PUT /reply-format` and CRUD for `/reply-templates` |

**Template for a new route:**
```python
# app/api/routes/my_feature.py
from fastapi import APIRouter, Depends
from app.core.auth import current_user, require_admin
from app.schemas.my_feature import MyFeatureCreate, MyFeatureResponse
from app.db.repositories import my_repo

router = APIRouter(tags=["my-feature"])

@router.get("/my-feature", response_model=list[MyFeatureResponse])
async def list_items(user=Depends(current_user)):
    return await my_repo.list_items(user["id"])

@router.post("/my-feature", response_model=MyFeatureResponse)
async def create_item(body: MyFeatureCreate, user=Depends(current_user)):
    return await my_repo.create_item(body.name, user["id"])
```

### 2.8 Core Tools in `app/core/`

| Module | Function |
|------|------|
| `auth.py` | JWT sign and verify, bcrypt, and dependencies like `current_user`, `require_admin`, `assert_self_or_admin` |
| `llm.py` | `call_llm(prompt)` and `call_router(prompt)` return `(text, tokens)` with retry and Redis cache |
| `chat.py` | `chat_reply(message, history, profile, ...)` returns `(reply, tokens)` and `build_user_profile(history)` |
| `redis_client.py` | LLM cache, chat history, dedup, task queue, with fallback if Redis is unavailable |
| `telegram/client.py` | Telegram API wrapper for `send_message()`, `edit_message_text()`, `test_connection()`, and `get_latest_chat_id()` |
| `bot_worker.py` | Multi-instance Telegram bot manager with long polling and daily profile generation |
| `realtime/ws.py` | WebSocket subscribe and publish helpers for worker and bot status |
| `debug/*` | In-memory debug event buffer |
| `constants.py` | Business constants |

### 2.9 Tools System in `app/core/tools/`

AI tools can be registered with a decorator and then called automatically by the router model:

```python
@register(
    "tool_name",
    "Tool description used by the router model",
    keywords=["trigger keyword"],
    takes_message=True,   # whether to pass the user message
    takes_user_id=True    # whether to pass the user_id
)
def my_tool(message: str, user_id: int | None = None) -> str:
    return "The tool output text will be added to the LLM context"
```

**Current tools:**

| Tool | Trigger use case |
|------|----------|
| `time_tool` | Ask for time, date, or weekday |
| `emails_tool` | Check local email records or stats |
| `fetch_email_tool` | Fetch Gmail in real time and process it with AI |

---

## 3. Frontend Extension Flow

### 3.1 Tech Stack

| Library | Version | Use |
|----|------|------|
| React | 19 | UI framework |
| TypeScript | 6 | Type safety |
| Vite | 8 | Build tool |
| React Router | 7 | Client routing |
| TanStack Query | 5 | Server state and cache |
| react-hook-form | 7 | Form management |
| zod | 4 | Form validation schema |
| axios | 1 | HTTP client |
| Zustand | 5 | Global client state |
| react-hot-toast | 2 | Toast notifications |
| Tailwind CSS | 4 | Styling |

**Notes for strict TypeScript mode:**
- `verbatimModuleSyntax: true` means all type-only imports must use `import type { ... }`
- `noUnusedLocals: true` and `noUnusedParameters: true` mean unused items will cause errors
- if you do not need the error object in a `catch` block, use `catch {}` instead of `catch (e) {}`

### 3.2 Project Structure

```
frontend/src/
├── App.tsx              # route config
├── main.tsx             # app entry
├── api/
│   └── client.ts        # Axios instance for all requests
├── components/
│   ├── common/          # shared UI components
│   │   └── form/        # controlled form components for react-hook-form
│   └── layout/          # Layout, Sidebar, and so on
├── constants/
│   └── navigation.ts    # sidebar navigation config
├── features/            # feature modules, one folder per feature
├── hooks/               # global custom hooks
├── i18n/                # internationalization
├── pages/               # non-feature pages, such as Home
├── types/
│   └── index.ts         # shared global types
└── utils/
    └── formatLog.ts     # log message formatter
```

**Current routes in `App.tsx`:**

```
/login                  → LoginPage, public
/                       → wrapped by Layout
  ├── /home             → Home dashboard
  ├── /skill            → Skill home page
  ├── /skill/gmail      → GmailPage
  ├── /skill/chat       → ChatPage
  ├── /settings         → SettingsPage
  ├── /prompts          → PromptsPage
  ├── /debug            → DebugPage, admin only
  ├── /users            → UsersPage, admin only
  └── /persona-config   → PersonaConfigPage, admin only
```

### 3.3 API Client in `src/api/client.ts`

```typescript
// usage
import { api } from '../../../api/client'
const data = await api.get<MyType>('/endpoint').then(r => r.data)
```

**Configured interceptors, no need to handle them manually:**
- request interceptor: automatically adds `Authorization: Bearer <token>` from localStorage
- response interceptor:
  - `401` or `403` redirects to `/login` and clears the token
  - HTTP errors show i18n error toasts through `react-hot-toast`
  - do not keep a local `errMsg` state in page components

### 3.4 Shared UI Components in `src/components/common/`

**Use these standard components first. Do not add inline styles or replace them with raw HTML in feature pages.**

| Component | Main props | Use |
|------|-----------|------|
| `Button` | `variant: 'primary'\|'telegram'`, `loading?: boolean`, `disabled?` | Standard button |
| `Card` | `title: string`, `badge?: string`, `full?: boolean` | Data container card |
| `Modal` | `isOpen`, `onClose`, `title`, `footer?`, `size: 'sm'\|'md'\|'lg'\|'xl'` | Modal dialog |
| `InputField` | `label?`, `multi?: boolean`, `rows?`, `error?`, `required?`, `onChange?: (value: string) => void` | Input or text area |
| `Select` | `label?`, `options: {label,value}[]`, `error?`, `required?`, `onChange?: (value: string) => void` | Dropdown selector |
| `Switch` | `label?`, `error?`, `onChange?: (checked: boolean) => void` | Switch |
| `Badge` | `variant: 'success'\|'error'\|'warning'\|'info'\|'neutral'` | Status badge |

> Note: `InputField` and `Select` pass a direct string value to `onChange`, and `Switch` passes a boolean. They do not pass the native `ChangeEvent`.

**Form components in `src/components/common/form/`:**

They work with `react-hook-form` and handle register and error display automatically.

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Control } from 'react-hook-form'
import { FormInput, FormSelect, FormSwitch } from '../../../components/common/form'

const { control, handleSubmit } = useForm<FormData>({ resolver: zodResolver(schema) })

<FormInput name="email" control={control} label="Email" required />
<FormSelect name="role" control={control} label="Role" options={[...]} />
<FormSwitch name="enabled" control={control} label="Enabled" />
```

### 3.5 Create a New Feature Module

Create a new folder under `frontend/src/features/` with this structure:

```
features/my-feature/
├── api/
│   └── index.ts     # all API calls for this module
├── components/
│   └── MyFeaturePage.tsx
├── hooks/           # optional hooks for this module
├── types.ts         # optional types for this module
└── index.ts         # public entry that exports the page and API
```

**Standard pattern for `api/index.ts`:**
```typescript
import { api } from '../../../api/client'
import type { MyItem } from '../../../types'  // use import type for types

export const getItems = () =>
  api.get<MyItem[]>('/my-feature').then(r => r.data)

export const createItem = (data: { name: string }) =>
  api.post<MyItem>('/my-feature', data).then(r => r.data)

export const updateItem = (id: number, patch: Partial<MyItem>) =>
  api.put<MyItem>(`/my-feature/${id}`, patch).then(r => r.data)

export const deleteItem = (id: number) =>
  api.delete(`/my-feature/${id}`).then(r => r.data)
```

**Page component pattern:**
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { Card, Button } from '../../../components/common'
import { getItems, createItem } from '../api'

export function MyFeaturePage() {
  const qc = useQueryClient()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['my-feature'],
    queryFn: getItems,
  })

  const mutation = useMutation({
    mutationFn: createItem,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-feature'] })
      toast.success('Created')
    },
    // no onError needed, the global interceptor already handles error toasts
  })

  if (isLoading) return <div>Loading...</div>

  return (
    <Card title="My Feature">
      {items.map(item => <div key={item.id}>{item.name}</div>)}
      <Button onClick={() => mutation.mutate({ name: 'test' })} loading={mutation.isPending}>
        Create
      </Button>
    </Card>
  )
}
```

### 3.6 Register Routes and Navigation

**1. Add the route in `src/App.tsx`:**
```tsx
import { MyFeaturePage } from './features/my-feature'
// add this inside the Layout routes
<Route path="/my-feature" element={<MyFeaturePage />} />
```

**2. Add the navigation item in `src/constants/navigation.ts`:**
```typescript
{ to: '/my-feature', key: 'nav.my_feature', adminOnly: false }
```

**3. Add i18n text in `src/i18n/zh.ts` and `en.ts`:**
```typescript
// zh.ts
'nav.my_feature': 'My Feature',
// en.ts
'nav.my_feature': 'My Feature',
```

### 3.7 Internationalization, i18n

All user-facing text must go through i18n. Do not hardcode Chinese or English strings in components.

```typescript
import { useI18n } from '../../../i18n'

function MyComponent() {
  const { t } = useI18n()
  return <span>{t('my_feature.title')}</span>
}
```

**Current i18n key groups:** `nav.*`, `home.*`, `settings.*`, `prompts.*`, `debug.*`, `chat.*`, `users.*`, `persona_config.*`, `log.*`, `error.*`, `opt.*`

### 3.8 Shared Global Types in `src/types/index.ts`

Put types used across many features in this file. Feature-only types can stay in each feature's own `types.ts`.

**Main existing types:**
```typescript
AuthUser           // id, email, role
User               // id, email, role, worker_enabled, min_priority, max_emails_per_run, poll_interval
Bot                // id, user_id, name, token, chat_id, is_default, chat_prompt_id, bot_mode
Config             // all backend config fields, such as LLM_BACKEND and GMAIL_POLL_INTERVAL
LogEntry           // id, user_id, ts, level, log_type, tokens, msg
EmailRecord        // id, email_id, subject, sender, analysis, summary, telegram_msg, priority, ...
WorkerStatus       // running, interval, query, priorities, stats
DbStats            // db_path, sender_count, email_records_count, ...
PromptFile         // filename, content, is_custom
DbPrompt           // id, user_id, name, type, content, is_default
PersonaConfigData  // Record<category, Record<key, string>>
PersonaGenerateResult  // prompt, tokens
```

### 3.9 Global Custom Hooks in `src/hooks/`

| Hook | Return value | Purpose |
|------|--------|------|
| `useHealthCheck(interval?)` | `boolean \| null` | Check `/health` regularly, `null` means still checking |
| `useWorkerStatus()` | `{ gmailWorker, chatBot }` | Listen to WebSocket status and update Query cache |
| `useConfirmDiscard(isDirty, msg)` | — | Show a confirm dialog when a form has unsaved changes |

### 3.10 Tailwind Color Rules

Use the existing color values. Do not add random new colors.

| Use | Color value |
|------|--------|
| Dark background for page or card | `#0f172a`, `#0b0e14`, `#1e2330`, `#16213e` |
| Border | `#2d3748` |
| Main text | `#e2e8f0` |
| Secondary text | `#94a3b8`, `#64748b` |
| Indigo highlight | `#6366f1` |
| Telegram blue | `#0088cc` |
| Success | `#22c55e` |
| Error | `#ef4444` |
| Warning | `#fcd34d` |

### 3.11 Form Rules

For forms with more than 3 fields, you must use `react-hook-form` and `zod`:

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  priority: z.enum(['high', 'medium', 'low']),
  enabled: z.boolean(),
  count: z.number().int().min(1).max(100),
})

type FormData = z.infer<typeof schema>

export function MyForm() {
  const { control, handleSubmit, formState: { isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'medium', enabled: true, count: 5 },
  })

  const mutation = useMutation({ mutationFn: saveData })

  return (
    <form onSubmit={handleSubmit(data => mutation.mutate(data))}>
      <FormInput name="email" control={control} label="Email" required />
      <FormSelect name="priority" control={control} label="Priority"
        options={[{label:'High',value:'high'},{label:'Medium',value:'medium'},{label:'Low',value:'low'}]} />
      <FormSwitch name="enabled" control={control} label="Enabled" />
      <Button type="submit" loading={mutation.isPending} disabled={!isDirty}>
        Save
      </Button>
    </form>
  )
}
```

---

## 4. Example of a Full New Feature Flow

Here is an example for adding a notification template feature.

### Backend steps

1. **Define the model** in `app/db/base.py` and add the `notification_templates` table
2. **Define the schemas** in `app/schemas/notification.py`, such as `TemplateCreate` and `TemplateResponse`
3. **Implement the repository** in `app/db/repositories/template_repo.py`
4. **Optional service layer** in `app/services/notification_service.py`
5. **Add routes** in `app/api/routes/notifications.py`
6. **Register the routes** by importing in `app/api/routes/__init__.py` and using `include_router` in `app/main.py`

### Frontend steps

1. **Create the feature folder** in `frontend/src/features/notifications/`
2. **Define types** in `src/types/index.ts` for shared types or `features/notifications/types.ts` for local types
3. **Build the API layer** in `features/notifications/api/index.ts`
4. **Build the page** in `features/notifications/components/NotificationsPage.tsx`
5. **Register the route** in `src/App.tsx`
6. **Add navigation** in `src/constants/navigation.ts`
7. **Update i18n** in `src/i18n/zh.ts` and `en.ts`
8. **Export from the module** in `features/notifications/index.ts`

---

## 5. Quick Checklist

### Backend
- [ ] The database model is defined in `app/db/base.py`
- [ ] The Pydantic schema is created under `app/schemas/`
- [ ] SQL logic is inside the repository, not directly in Route or Service
- [ ] The route is registered in `app/api/routes/__init__.py` and included in `main.py`
- [ ] Protected routes use `Depends(current_user)` or `Depends(require_admin)`
- [ ] New environment variables are declared in the `Settings` class in `app/core/config.py`

### Frontend
- [ ] The feature folder has the full structure, such as `api/index.ts`, `components/`, and `index.ts`
- [ ] API calls use the shared `api` instance, and type imports use `import type`
- [ ] Pages use `useQuery` and `useMutation` instead of manual loading or error state logic
- [ ] API error toasts are not handled inside the page because the interceptor already handles them
- [ ] Standard components from `src/components/common/` are used, with no inline styles
- [ ] Forms with more than 3 fields use `react-hook-form` and `zod`
- [ ] i18n text is updated in both `zh.ts` and `en.ts`
- [ ] The route is added in `App.tsx`, and navigation is added in `navigation.ts`
- [ ] `npm run build` passes with zero TypeScript errors

