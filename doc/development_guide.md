﻿﻿﻿# 小星项目开发与扩展指南 (Development & Extension Guide)

本文档旨在指导开发者如何在"小星"项目中添加新功能，并明确各功能模块的存放位置。

---

## 1. 整体架构概览

项目采用 **前后端分离** 架构：

- **后端 (Backend)**: 基于 Python FastAPI，采用领域驱动设计 (DDD) 的简化版，分为 API 层、Service/Skill 层、Repository 层和 DB 模型层。
- **前端 (Frontend)**: 基于 React 19 + TypeScript + Vite，采用 **Feature-based** 的组织结构，使用 TanStack Query 管理服务器状态，Zustand 管理客户端状态。
- **新增页面示例**: 邮件回复格式配置页 `/settings/reply-format`（`frontend/src/features/replyFormat/`），用于编辑回复模板与署名。

```
请求链路 (后端):
HTTP → Route (FastAPI) → Service/Skill → Repository → PostgreSQL
                       → Core (LLM / Redis / Telegram)

数据链路 (前端):
页面组件 → useQuery/useMutation → features/xxx/api/index.ts → axios (client.ts) → 后端 API
```

---

## 2. 后端扩展流程 (Backend)

### 2.1 项目结构

```
app/
├── main.py              # 应用入口、中间件、路由注册、lifespan
├── config.py            # 重新导出 core/config.py
├── api/routes/          # HTTP 接口层
├── core/                # 核心工具 (JWT、LLM、Redis、Telegram、WebSocket、Tools)
├── db/
│   ├── base.py          # SQLAlchemy 模型 + init_db()
│   ├── session.py       # 连接池
│   └── repositories/    # 数据访问层 (所有 SQL)
├── schemas/             # Pydantic 请求/响应模型
├── services/            # 业务逻辑层
├── skills/              # 复杂异步技能 (如 Gmail 轮询)
└── utils/               # 工具函数 (prompt_loader, json_parser)
```

### 2.2 环境变量 & 配置 (`app/core/config.py`)

所有配置通过环境变量注入，并在 `Settings` 类中读取，通过 `get_settings()` 全局依赖获得单例。新增配置字段需在此文件中添加。

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `POSTGRES_DSN` | `postgresql://postgres:postgres@localhost:5432/xiaoxing` | PostgreSQL 连接串 |
| `REDIS_URL` | `redis://localhost:6380` | Redis 连接串 |
| `JWT_SECRET` | `change-me-in-production` | JWT 签名密钥（生产必须修改） |
| `JWT_EXPIRE_MINUTES` | `60` | Token 有效期 |
| `ADMIN_USER` | — | 管理员邮箱 |
| `ADMIN_PASSWORD` | — | 管理员密码 |
| `FRONTEND_URL` | `http://localhost:5173` | CORS 允许的来源 |
| `LLM_BACKEND` | `local` | `local` 或 `openai` |
| `LLM_API_URL` | `http://127.0.0.1:8001/v1/chat/completions` | 主 LLM 推理地址 |
| `LLM_MODEL` | `local-model` | 主模型名称 |
| `ROUTER_API_URL` | `http://127.0.0.1:8002/v1/chat/completions` | 小型路由模型地址 |
| `ROUTER_MODEL` | `local-router` | 路由模型名称 |
| `OPENAI_API_KEY` | — | 当 `LLM_BACKEND=openai` 时使用 |
| `UI_LANG` | `en` | 默认界面语言 (`en` / `zh`) |
| `TELEGRAM_BOT_TOKEN` | — | Bot Token |
| `TELEGRAM_CHAT_ID` | — | 默认推送 Chat ID |
| `GMAIL_POLL_INTERVAL` | `300` | Gmail 轮询间隔（秒） |
| `GMAIL_POLL_QUERY` | `is:unread in:inbox` | Gmail 搜索条件 |
| `GMAIL_POLL_MAX` | `5` | 每次最多处理邮件数 |
| `GMAIL_MARK_READ` | `true` | 处理后标记已读 |
| `NOTIFY_MIN_PRIORITY` | `""` | 推送最低优先级（空=全部） |

**Prompt 文件配置（可被数据库覆盖）：**

| 变量名 | 默认文件路径 |
|--------|-------------|
| `PROMPT_ANALYZE` | `gmail/email_analysis.txt` |
| `PROMPT_SUMMARY` | `gmail/email_summary.txt` |
| `PROMPT_TELEGRAM` | `gmail/telegram_notify.txt` |
| `PROMPT_CHAT` | `chat.txt` |
| `PROMPT_PROFILE` | `user_profile.txt` |

### 2.3 数据库模型 (`app/db/base.py`)

在此文件中定义 SQLAlchemy Core 表结构，`init_db()` 在应用启动时自动建表。

**现有表：**

| 表名 | 主要字段 | 说明 |
|------|----------|------|
| `user` | `id`, `email`, `role`, `password_hash`, `worker_enabled`, `min_priority`, `max_emails_per_run`, `poll_interval` | 用户账号 |
| `bot` | `id`, `user_id`, `name`, `token`, `chat_id`, `is_default`, `chat_prompt_id`, `bot_mode` | Telegram Bot 配置 |
| `system_prompts` | `id`, `name`, `type`, `content`, `is_default` | 系统内置 Prompt（不可改） |
| `user_prompts` | `id`, `user_id`, `name`, `type`, `content`, `is_default`, `meta` | 用户自定义 Prompt |
| `oauth_tokens` | `id`, `user_id`, `token_json` | Gmail OAuth Token |
| `email_records` | `id`, `user_id`, `email_id`, `subject`, `sender`, `analysis_json`, `summary_json`, `telegram_msg`, `priority`, `sent_telegram` | 已处理邮件存档 |
| `reply_templates` | `id`, `user_id`, `name`, `body_template`, `closing`, `is_default` | 用户邮件回复模板 |
| `reply_format_settings` | `user_id`, `default_template_id`, `signature` | 用户回复格式设置（默认模板/署名） |
| `worker_stats` | `id`, `user_id`, `total_sent`, `total_fetched`, `total_errors`, `total_tokens`, `last_poll` | Gmail Worker 统计 |
| `user_profile` | `bot_id` (PK), `profile` | 每个 Bot 对话用户画像（文本） |
| `log` | `id`, `user_id`, `ts`, `level`, `log_type`, `tokens`, `msg` | 系统日志 |

### 2.4 Pydantic Schemas (`app/schemas/`)

定义 HTTP 请求/响应的数据格式。按资源类型分文件组织：

| 文件 | 主要 Schema |
|------|-------------|
| `auth.py` | `AdminLoginRequest` |
| `user.py` | `UserCreate`, `UserUpdate` |
| `bot.py` | `BotCreate`, `BotUpdate` |
| `prompt.py` | `PromptCreate`, `PromptUpdate` |
| `chat.py` | `ChatPersonaRequest` |
| `persona.py` | `PersonaConfigSave` |

**新增 Schema 示例：**
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

### 2.5 Repository 层 (`app/db/repositories/`)

**职责**：封装所有 SQL 操作，禁止在 Route 或 Service 中直接执行 SQL。返回值统一为 `dict` 或 `list[dict]`。

**现有 Repository 及方法签名：**

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

**新增 Repository 模板：**
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

### 2.6 Service / Skill 层

- **Service** (`app/services/`): 组合多个 Repository 调用或核心工具的业务逻辑。
- **Skill** (`app/skills/`): 具有独立生命周期的复杂模块（如后台轮询 Worker）。

**现有服务：**

| 文件 | 类 | 核心方法 |
|------|----|----------|
| `gmail_service.py` | `GmailService` | `fetch()`, `process()` |
| `telegram_service.py` | `TelegramService` | `clear_history()`, `generate_profile()` |
| `persona_prompt_service.py` | `PersonaPromptService` | `generate(payload)` → 4 阶段 Prompt 生成 |

**Skill 目录结构（以 `gmail/` 为例）：**
```
app/skills/gmail/
├── schemas.py    # 该 Skill 专用的 Pydantic 模型
├── client.py     # Gmail API 客户端封装
├── auth.py       # OAuth2 流程
├── pipeline.py   # AI 处理管线 (analyze → summarize → telegram)
└── worker.py     # 后台轮询 Worker
```

### 2.7 API 路由层 (`app/api/routes/`)

在此添加 FastAPI Router，在 `app/api/routes/__init__.py` 中注册，并在 `app/main.py` 中 `include_router`。

**现有路由总览：**

| 文件 | 主要端点 |
|------|----------|
| `health.py` | `GET /`, `GET /health` |
| `auth.py` | `POST /auth/login`, `GET /auth/me` |
| `users.py` | `GET/POST /users`, `GET/PUT /users/{id}` |
| `bots.py` | `GET/POST /users/{id}/bots`, `PUT/DELETE .../bots/{bot_id}`, `POST .../set-default` |
| `db_prompts.py` | `GET/POST /db/prompts`, `PUT/DELETE /db/prompts/{id}` |
| `prompts.py` | `GET/POST/DELETE /prompts/{filename}` |
| `config.py` | `GET/POST /config`（管理员） |
| `admin_persona.py` | `GET/PUT /admin/persona-config`（管理员） |
| `email_records.py` | `GET /email/records`, `GET /email/records/{email_id}` |
| `ai.py` | `GET /ai/ping`, `POST /ai/analyze`, `/ai/summary`, `/ai/process` |
| `gmail_actions.py` | `POST /gmail/fetch`, `POST /gmail/process` |
| `telegram_tools.py` | `POST /telegram/test`, `GET /telegram/chat_id`, `POST /telegram/bot/clear_history`, `GET/DELETE/POST /telegram/bot/profile` |
| `stats_logs.py` | `GET/DELETE /worker/logs`, `GET /db/stats` |
| `chat.py` | `POST /chat/generate_persona_prompt` |
| `reply_format.py` | `GET/PUT /reply-format`, `/reply-templates` CRUD |

**新增路由模板：**
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

### 2.8 核心工具 (`app/core/`)

| 模块 | 功能 |
|------|------|
| `auth.py` | JWT 签发/验证、bcrypt、依赖项 `current_user` / `require_admin` / `assert_self_or_admin` |
| `llm.py` | `call_llm(prompt)` / `call_router(prompt)` → `(text, tokens)`，带 3 次退避重试 + Redis 缓存（1h） |
| `chat.py` | `chat_reply(message, history, profile, ...)` → `(reply, tokens)`；`build_user_profile(history)` |
| `redis_client.py` | LLM 缓存、对话历史（TTL 7天）、去重、任务队列；Redis 不可用时降级处理 |
| `telegram/client.py` | Telegram API 封装：`send_message()` / `edit_message_text()` / `test_connection()` / `get_latest_chat_id()` |
| `bot_worker.py` | Telegram Bot 多实例管理，长轮询 + 任务队列消费，每日自动生成用户画像 |
| `realtime/ws.py` | WebSocket 订阅/发布：`subscribe_worker()` / `publish_worker_status()` / `subscribe_bot()` / `publish_bot_status()` |
| `debug/*` | 内存调试事件缓冲：Telegram 事件与 Outgoing Trace |
| `constants.py` | 业务常量 |

### 2.9 Tools 系统 (`app/core/tools/`)

AI 可调用的工具函数，通过装饰器注册后由路由模型自动分发：

```python
@register(
    "tool_name",
    "工具描述（路由模型用于判断是否调用）",
    keywords=["触发关键词"],
    takes_message=True,   # 是否传入用户消息
    takes_user_id=True    # 是否传入 user_id
)
def my_tool(message: str, user_id: int | None = None) -> str:
    return "工具返回的文本，会被注入到 LLM 上下文中"
```

**现有工具：**

| 工具 | 触发场景 |
|------|----------|
| `time_tool` | 询问时间、日期、星期 |
| `emails_tool` | 查询本地邮件记录/统计 |
| `fetch_email_tool` | 实时拉取 Gmail + AI 处理 |

---

## 3. 前端扩展流程 (Frontend)

### 3.1 技术栈

| 库 | 版本 | 用途 |
|----|------|------|
| React | 19 | UI 框架 |
| TypeScript | 6 | 类型安全 |
| Vite | 8 | 构建工具 |
| React Router | 7 | 客户端路由 |
| TanStack Query | 5 | 服务器状态 + 缓存 |
| react-hook-form | 7 | 表单管理 |
| zod | 4 | 表单验证 Schema |
| axios | 1 | HTTP 客户端 |
| Zustand | 5 | 客户端全局状态 |
| react-hot-toast | 2 | Toast 通知 |
| Tailwind CSS | 4 | 样式 |

**TypeScript 严格模式注意事项：**
- `verbatimModuleSyntax: true` — 所有仅用于类型的导入**必须**使用 `import type { ... }`
- `noUnusedLocals: true` / `noUnusedParameters: true` — 未使用的变量/参数会报错
- `catch` 块中不需要错误对象时，写 `catch {}` 而非 `catch (e) {}`

### 3.2 项目结构

```
frontend/src/
├── App.tsx              # 路由配置
├── main.tsx             # 应用入口
├── api/
│   └── client.ts        # Axios 实例（所有请求都用这个）
├── components/
│   ├── common/          # 共用 UI 原子组件
│   │   └── form/        # react-hook-form 受控表单组件
│   └── layout/          # Layout、Sidebar 等
├── constants/
│   └── navigation.ts    # 侧边栏导航配置
├── features/            # 业务功能模块（每个功能一个目录）
├── hooks/               # 全局 Custom Hooks
├── i18n/                # 国际化
├── pages/               # 非功能性页面（Home、Skill 首页等）
├── types/
│   └── index.ts         # 全局共享类型定义
└── utils/
    └── formatLog.ts     # 日志消息格式化
```

**现有路由（`App.tsx`）：**

```
/login                  → LoginPage (公开)
/ (Layout 包裹)
  ├── /home             → Home (仪表盘)
  ├── /skill            → Skill (技能首页)
  ├── /skill/gmail      → GmailPage
  ├── /skill/chat       → ChatPage
  ├── /settings         → SettingsPage
  ├── /prompts          → PromptsPage
  ├── /debug            → DebugPage (管理员)
  ├── /users            → UsersPage (管理员)
  └── /persona-config   → PersonaConfigPage (管理员)
```

### 3.3 API 客户端 (`src/api/client.ts`)

```typescript
// 使用方式
import { api } from '../../../api/client'
const data = await api.get<MyType>('/endpoint').then(r => r.data)
```

**已配置的拦截器（无需手动处理）：**
- 请求拦截：自动附加 `Authorization: Bearer <token>`（来自 localStorage）
- 响应拦截：
  - `401`/`403` → 跳转 `/login`，清除 Token
  - HTTP 错误 → 自动通过 `react-hot-toast` 显示 i18n 错误 Toast
  - **禁止**在页面组件中自行维护 `errMsg` 状态

### 3.4 共用 UI 组件 (`src/components/common/`)

**优先使用以下组件，禁止在 Feature 页面中写内联样式或原生 HTML 替代品：**

| 组件 | Props 摘要 | 用途 |
|------|-----------|------|
| `Button` | `variant: 'primary'\|'telegram'`, `loading?: boolean`, `disabled?` | 标准按钮 |
| `Card` | `title: string`, `badge?: string`, `full?: boolean` | 数据容器卡片 |
| `Modal` | `isOpen`, `onClose`, `title`, `footer?`, `size: 'sm'\|'md'\|'lg'\|'xl'` | 弹窗（Portal 挂载） |
| `InputField` | `label?`, `multi?: boolean`, `rows?`, `error?`, `required?`, `onChange?: (value: string) => void` | 输入框 / 多行文本 |
| `Select` | `label?`, `options: {label,value}[]`, `error?`, `required?`, `onChange?: (value: string) => void` | 下拉选择 |
| `Switch` | `label?`, `error?`, `onChange?: (checked: boolean) => void` | 开关 |
| `Badge` | `variant: 'success'\|'error'\|'warning'\|'info'\|'neutral'` | 状态标签 |

> **注意**：`InputField`、`Select` 的 `onChange` 直接传值（`string`），`Switch` 的 `onChange` 传 `boolean`，而非原生 `ChangeEvent`。

**表单受控组件 (`src/components/common/form/`)：**

与 `react-hook-form` 集成，自动处理注册和错误显示：

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Control } from 'react-hook-form'
import { FormInput, FormSelect, FormSwitch } from '../../../components/common/form'

const { control, handleSubmit } = useForm<FormData>({ resolver: zodResolver(schema) })

<FormInput name="email" control={control} label="邮箱" required />
<FormSelect name="role" control={control} label="角色" options={[...]} />
<FormSwitch name="enabled" control={control} label="启用" />
```

### 3.5 创建新 Feature 模块

在 `frontend/src/features/` 下新建目录，内部结构：

```
features/my-feature/
├── api/
│   └── index.ts     # 该模块的所有 API 调用函数
├── components/
│   └── MyFeaturePage.tsx
├── hooks/           # (可选) 该模块专用 Hooks
├── types.ts         # (可选) 模块专用类型
└── index.ts         # 公共入口，导出页面组件和对外接口
```

**`api/index.ts` 规范：**
```typescript
import { api } from '../../../api/client'
import type { MyItem } from '../../../types'  // 类型必须用 import type

export const getItems = () =>
  api.get<MyItem[]>('/my-feature').then(r => r.data)

export const createItem = (data: { name: string }) =>
  api.post<MyItem>('/my-feature', data).then(r => r.data)

export const updateItem = (id: number, patch: Partial<MyItem>) =>
  api.put<MyItem>(`/my-feature/${id}`, patch).then(r => r.data)

export const deleteItem = (id: number) =>
  api.delete(`/my-feature/${id}`).then(r => r.data)
```

**页面组件规范：**
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
    // onError 不需要：全局拦截器已处理错误 Toast
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

### 3.6 注册路由与导航

**1. 添加路由** (`src/App.tsx`)：
```tsx
import { MyFeaturePage } from './features/my-feature'
// 在 Layout 路由内添加：
<Route path="/my-feature" element={<MyFeaturePage />} />
```

**2. 添加导航菜单** (`src/constants/navigation.ts`)：
```typescript
{ to: '/my-feature', key: 'nav.my_feature', adminOnly: false }
```

**3. 添加 i18n 文本** (`src/i18n/zh.ts` 和 `en.ts`)：
```typescript
// zh.ts
'nav.my_feature': '我的功能',
// en.ts
'nav.my_feature': 'My Feature',
```

### 3.7 国际化 (i18n)

所有用户可见的文字**必须**通过 i18n，不允许硬编码中英文字符串。

```typescript
import { useI18n } from '../../../i18n'

function MyComponent() {
  const { t } = useI18n()
  return <span>{t('my_feature.title')}</span>
}
```

**现有 i18n key 分类：** `nav.*`, `home.*`, `settings.*`, `prompts.*`, `debug.*`, `chat.*`, `users.*`, `persona_config.*`, `log.*`, `error.*`, `opt.*`

### 3.8 全局共享类型 (`src/types/index.ts`)

在此文件中定义跨 Feature 使用的类型。功能模块内部专用类型放在各自的 `types.ts` 中。

**现有主要类型：**
```typescript
AuthUser           // id, email, role
User               // id, email, role, worker_enabled, min_priority, max_emails_per_run, poll_interval
Bot                // id, user_id, name, token, chat_id, is_default, chat_prompt_id, bot_mode
Config             // 所有后端配置字段 (LLM_BACKEND, GMAIL_POLL_INTERVAL 等 50+ 字段)
LogEntry           // id, user_id, ts, level, log_type, tokens, msg
EmailRecord        // id, email_id, subject, sender, analysis, summary, telegram_msg, priority, ...
WorkerStatus       // running, interval, query, priorities, stats
DbStats            // db_path, sender_count, email_records_count, ...
PromptFile         // filename, content, is_custom
DbPrompt           // id, user_id, name, type, content, is_default
PersonaConfigData  // Record<category, Record<key, string>>
PersonaGenerateResult  // prompt, tokens
```

### 3.9 全局 Custom Hooks (`src/hooks/`)

| Hook | 返回值 | 作用 |
|------|--------|------|
| `useHealthCheck(interval?)` | `boolean \| null` | 定期检查 `/health`，null 表示检查中 |
| `useWorkerStatus()` | `{ gmailWorker, chatBot }` | 监听 WebSocket 状态，更新 Query 缓存 |
| `useConfirmDiscard(isDirty, msg)` | — | 表单有未保存更改时，离开页面前弹出确认 |

### 3.10 Tailwind 颜色规范

使用已有的颜色变量，不要随意引入新颜色：

| 用途 | 颜色值 |
|------|--------|
| 深色背景 (页面/卡片) | `#0f172a`, `#0b0e14`, `#1e2330`, `#16213e` |
| 边框 | `#2d3748` |
| 主文本 | `#e2e8f0` |
| 次要文本 | `#94a3b8`, `#64748b` |
| Indigo 强调 | `#6366f1` |
| Telegram 蓝 | `#0088cc` |
| 成功 | `#22c55e` |
| 错误 | `#ef4444` |
| 警告 | `#fcd34d` |

### 3.11 表单规范

对于包含 3 个字段以上的表单，**必须**使用 `react-hook-form` + `zod`：

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
      <FormSelect name="priority" control={control} label="优先级"
        options={[{label:'高',value:'high'},{label:'中',value:'medium'},{label:'低',value:'low'}]} />
      <FormSwitch name="enabled" control={control} label="启用" />
      <Button type="submit" loading={mutation.isPending} disabled={!isDirty}>
        保存
      </Button>
    </form>
  )
}
```

---

## 4. 完整新功能开发流程示例

以添加"通知模板"功能为例：

### 后端步骤

1. **定义模型** → `app/db/base.py` 添加 `notification_templates` 表
2. **定义 Schema** → `app/schemas/notification.py` 添加 `TemplateCreate`, `TemplateResponse`
3. **实现 Repository** → `app/db/repositories/template_repo.py`
4. **（可选）Service** → `app/services/notification_service.py`
5. **添加路由** → `app/api/routes/notifications.py`
6. **注册路由** → `app/api/routes/__init__.py` 导入，`app/main.py` `include_router`

### 前端步骤

1. **创建 Feature 目录** → `frontend/src/features/notifications/`
2. **定义类型** → `src/types/index.ts`（跨模块）或 `features/notifications/types.ts`（局部）
3. **实现 API 层** → `features/notifications/api/index.ts`
4. **实现页面** → `features/notifications/components/NotificationsPage.tsx`
5. **注册路由** → `src/App.tsx`
6. **添加导航** → `src/constants/navigation.ts`
7. **更新 i18n** → `src/i18n/zh.ts` + `en.ts`
8. **导出** → `features/notifications/index.ts`

---

## 5. 快速检查清单 (Checklist)

### 后端
- [ ] 数据库模型已在 `app/db/base.py` 中定义
- [ ] Pydantic Schema 已在 `app/schemas/` 下创建
- [ ] SQL 逻辑封装在 Repository 中，Route/Service 不直接执行 SQL
- [ ] 路由已在 `app/api/routes/__init__.py` 注册并在 `main.py` 中 `include_router`
- [ ] 鉴权路由使用了 `Depends(current_user)` 或 `Depends(require_admin)`
- [ ] 新增环境变量已在 `app/core/config.py` 的 `Settings` 中声明

### 前端
- [ ] Feature 目录结构完整（`api/index.ts`, `components/`, `index.ts`）
- [ ] API 调用使用 `api` 实例，类型导入用 `import type`
- [ ] 页面使用 `useQuery` / `useMutation`，未手动维护 loading/error 状态
- [ ] 未在页面中处理 API 错误 Toast（拦截器已处理）
- [ ] 使用了 `src/components/common/` 的标准组件，无内联样式
- [ ] 3 个字段以上的表单使用了 `react-hook-form` + `zod`
- [ ] i18n 文本已在 `zh.ts` 和 `en.ts` 中同步更新
- [ ] 路由已在 `App.tsx` 注册，导航已在 `navigation.ts` 配置
- [ ] `npm run build` 通过（零 TypeScript 错误）
