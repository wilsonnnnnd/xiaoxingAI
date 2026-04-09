# 多账号功能设计文档

本文档记录 Xiaoxing AI 多账号功能的完整设计决策，作为开发实施依据。

---

## 目录

1. [设计目标](#设计目标)
2. [数据库变更](#数据库变更)
3. [认证与权限](#认证与权限)
4. [多账号 Worker](#多账号-worker)
5. [Prompt 管理](#prompt-管理)
6. [Redis 新增键](#redis-新增键)
7. [API 变更](#api-变更)
8. [前端变更](#前端变更)
9. [实施阶段](#实施阶段)

---

## 设计目标

- 支持多个 Gmail 账号各自独立授权（共用 Google OAuth Client，每账号独立 token）
- 每个账号可注册多个 Telegram Bot，各自拥有独立 Token 和 Chat ID
- 每个账号设定一个**默认 Bot** 用于邮件通知推送；其余 Bot 用于特定聊天场景，可绑定专属 Prompt
- 两级权限：`admin` 可管理所有账号数据，`user` 只能访问自己的数据
- JWT 认证，通过 Gmail OAuth 回调自动登录签发 token
- 每个账号独立的邮件 Worker，服务重启后自动恢复；每个 Bot 独立的对话 Worker

---

## 数据库变更

### 删除的表

| 表名 | 删除原因 |
|------|----------|
| `sender` | 职责与 `email_records` 重叠，去重逻辑已由 `email_records.email_id UNIQUE` 保证 |

### 改名的表

| 旧名 | 新名 | 变更说明 |
|------|------|----------|
| `worker_logs` | `log` | 加 `user_id` 字段，NULL 表示系统日志 |

### 新表：`user`

系统核心账号表，每行对应一个 Gmail 账号。

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | BIGSERIAL PK | 主键 |
| `email` | VARCHAR UNIQUE NOT NULL | Gmail 邮箱地址（唯一，登录标识）|
| `display_name` | VARCHAR | 显示名称 |
| `role` | VARCHAR NOT NULL DEFAULT 'user' | 权限：`admin` / `user` |
| `password_hash` | TEXT | bcrypt 哈希，admin 账号使用，普通用户为 NULL |
| `worker_enabled` | BOOLEAN NOT NULL DEFAULT FALSE | 是否开启邮件 Worker（重启后自动恢复）|
| `min_priority` | VARCHAR NOT NULL DEFAULT 'medium' | 邮件过滤最低优先级：`high` / `medium` / `low` |
| `max_emails_per_run` | INTEGER NOT NULL DEFAULT 10 | 每次轮询最多处理邮件数 |
| `poll_interval` | INTEGER NOT NULL DEFAULT 60 | 轮询间隔（秒）|
| `created_at` | TIMESTAMP NOT NULL DEFAULT NOW() | 账号创建时间 |
| `updated_at` | TIMESTAMP NOT NULL DEFAULT NOW() | 最后修改个人资料时间 |

```sql
CREATE TABLE IF NOT EXISTS "user" (
    id                 BIGSERIAL PRIMARY KEY,
    email              VARCHAR UNIQUE NOT NULL,
    display_name       VARCHAR,
    role               VARCHAR NOT NULL DEFAULT 'user',
    password_hash      TEXT,
    worker_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    min_priority       VARCHAR NOT NULL DEFAULT 'medium',
    max_emails_per_run INTEGER NOT NULL DEFAULT 10,
    poll_interval      INTEGER NOT NULL DEFAULT 60,
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 新表：`bot`

每个用户可注册多个 Telegram Bot。`is_default=TRUE` 的 Bot 用于邮件通知，其余 Bot 用于特定聊天场景。

**规则：**
- 同一用户只能有一个 `is_default=TRUE` 的 Bot（应用层约束，设置新默认时自动取消旧的）
- 用户必须先有至少一个默认 Bot，才能启动邮件 Worker
- 非默认 Bot 通过 `chat_prompt_id` 绑定专属聊天 Prompt，NULL 时回退用户默认 Prompt

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | BIGSERIAL PK | 主键 |
| `user_id` | BIGINT FK → user.id NOT NULL | 所属用户 |
| `name` | VARCHAR NOT NULL | Bot 显示名称（如「邮件通知 Bot」）|
| `token` | TEXT NOT NULL | Telegram Bot Token |
| `chat_id` | VARCHAR NOT NULL | 推送目标 Chat ID |
| `is_default` | BOOLEAN NOT NULL DEFAULT FALSE | 是否为邮件通知默认 Bot |
| `chat_prompt_id` | BIGINT FK → prompts.id | 该 Bot 专属聊天 Prompt，NULL = 使用用户默认 |
| `created_at` | TIMESTAMP NOT NULL DEFAULT NOW() | 创建时间 |
| `updated_at` | TIMESTAMP NOT NULL DEFAULT NOW() | 最后修改时间 |

```sql
CREATE TABLE IF NOT EXISTS bot (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    name           VARCHAR NOT NULL,
    token          TEXT NOT NULL,
    chat_id        VARCHAR NOT NULL,
    is_default     BOOLEAN NOT NULL DEFAULT FALSE,
    chat_prompt_id BIGINT REFERENCES prompts(id) ON DELETE SET NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 变更表：`log`（原 `worker_logs`）

新增 `user_id` 字段，NULL 代表系统级日志（仅 admin 可见）。

| 列 | 类型 | 变更 |
|----|------|------|
| `id` | BIGSERIAL PK | 不变 |
| `user_id` | BIGINT FK → user.id | **新增**，NULL = 系统日志 |
| `ts` | TEXT | 不变 |
| `level` | TEXT | 不变 |
| `log_type` | TEXT | 不变（email / chat）|
| `tokens` | INTEGER | 不变 |
| `msg` | TEXT | 不变 |
| `created_at` | TEXT | 不变 |

**访问控制逻辑：**
- `admin`：可查看全部 log（含 `user_id=NULL` 的系统日志）
- `user`：只能查看 `WHERE user_id = me.id`，系统日志不可见

### 变更表：`oauth_tokens`

去掉单行约束，改为每个用户一行。

| 列 | 类型 | 变更 |
|----|------|------|
| `id` | BIGSERIAL PK | 原 `CHECK(id=1)` 约束**移除** |
| `user_id` | BIGINT FK → user.id UNIQUE | **新增**，一对一绑定 |
| `token_json` | TEXT | 不变 |
| `updated_at` | TEXT | 不变 |

### 变更表：`email_records`

| 列 | 类型 | 变更 |
|----|------|------|
| `user_id` | BIGINT FK → user.id NOT NULL | **新增** |
| 其余列 | — | 不变 |

注：`email_id` 去重改为 `UNIQUE(user_id, email_id)`，不同账号可能收到同一封邮件 ID。

### 变更表：`worker_stats`

| 列 | 类型 | 变更 |
|----|------|------|
| `user_id` | BIGINT FK → user.id NOT NULL | **新增** |
| 其余列 | — | 不变 |

### 变更表：`user_profile`

改为按 `bot_id` 存储。不同 Bot 面向不同聊天场景，各自维护独立的对话画像。

| 列 | 类型 | 变更 |
|----|------|------|
| `bot_id` | BIGINT FK → bot.id PK | 替换原 `chat_id` 字段 |
| `profile` | TEXT | 不变 |
| `updated_at` | TEXT | 不变 |

### 新表：`prompts`

统一管理系统内置和用户自定义 Prompt。

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | BIGSERIAL PK | 主键 |
| `user_id` | BIGINT FK → user.id | NULL = 系统内置（所有人只读），非 NULL = 用户私有 |
| `name` | VARCHAR NOT NULL | prompt 名称 |
| `type` | VARCHAR NOT NULL | 类型：`chat` / `email_analysis` / `email_summary` / `telegram_notify` / `user_profile` |
| `content` | TEXT NOT NULL | prompt 内容 |
| `is_default` | BOOLEAN NOT NULL DEFAULT FALSE | 是否为该用户此类型的默认 prompt |
| `created_at` | TIMESTAMP NOT NULL DEFAULT NOW() | 创建时间 |
| `updated_at` | TIMESTAMP NOT NULL DEFAULT NOW() | 最后修改时间 |

**规则：**
- `user_id=NULL`：系统内置，所有用户可见，只有 admin 可修改
- `user_id=X`：用户 X 的私有 prompt，仅 X 可见可改
- 同一用户同一 `type` 只能有一个 `is_default=TRUE`（应用层约束）
- 首次启动时，将 `app/prompts/` 目录下 4 个 `.txt` 文件自动导入为系统内置记录（幂等操作）

```sql
CREATE TABLE IF NOT EXISTS prompts (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT REFERENCES "user"(id) ON DELETE CASCADE,
    name       VARCHAR NOT NULL,
    type       VARCHAR NOT NULL,
    content    TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## 认证与权限

### 登录方式

| 角色 | 登录方式 |
|------|----------|
| `user` | Gmail OAuth 回调后自动签发 JWT，无需密码 |
| `admin` | 用户名 + 密码（bcrypt），通过 `POST /auth/admin-login` |

### JWT 结构

```json
{
  "sub": "42",
  "email": "user@gmail.com",
  "role": "user",
  "version": 3,
  "exp": 1712345678
}
```

| 字段 | 说明 |
|------|------|
| `sub` | user.id |
| `version` | 与 Redis `jwt:version:<user_id>` 对齐，用于主动吊销 |
| `exp` | 1 小时后过期 |

### JWT 版本吊销（防重放）

- Redis 中维护 `jwt:version:<user_id>`（整数，无过期时间）
- 每次验证 token 时，从 Redis 读取当前版本号，若不匹配则拒绝
- 触发版本号 +1 的场景：
  - 用户重新完成 Gmail OAuth 授权
  - admin 强制踢出某用户
- Redis 不可达时降级：跳过版本校验，仅验证 JWT 签名（可配）

### Admin 初始账号

服务启动时检测是否存在 `role='admin'` 的用户：
- 不存在：从环境变量 `ADMIN_USER`（email）、`ADMIN_PASSWORD` 创建默认 admin
- 已存在：跳过

```ini
# .env
ADMIN_USER=admin@example.com
ADMIN_PASSWORD=changeme
```

### 依赖注入

```python
# 任何已登录用户
async def current_user(token: str = Depends(oauth2_scheme)) -> UserRow

# 仅 admin
async def require_admin(user: UserRow = Depends(current_user)) -> UserRow
```

### 权限矩阵

| 操作 | user | admin |
|------|------|-------|
| 查看/修改自己的账号信息 | ✅ | ✅ |
| 查看所有账号列表 | ❌ | ✅ |
| 删除/禁用其他账号 | ❌ | ✅ |
| 查看自己的 log | ✅ | ✅ |
| 查看所有 log（含系统日志）| ❌ | ✅ |
| 管理自己的 prompt | ✅ | ✅ |
| 修改系统内置 prompt | ❌ | ✅ |
| 管理自己的 Bot（增删改查）| ✅ | ✅ |
| 管理他人的 Bot | ❌ | ✅ |
| 启停自己的 worker | ✅ | ✅ |
| 启停他人的 worker | ❌ | ✅ |
| 查看自己的邮件记录/统计 | ✅ | ✅ |
| 查看所有人的邮件记录/统计 | ❌ | ✅ |

---

## 多账号 Worker

### 架构

```
服务启动
  ├─ 查询 user WHERE worker_enabled = TRUE
  │    └─ 为每个用户实例化 EmailWorker(user_id=X)
  │         └─ 取该用户的默认 Bot（bot WHERE user_id=X AND is_default=TRUE）
  │         └─ 使用该用户的 min_priority、max_emails_per_run、poll_interval
  │         └─ 使用该用户的 oauth_tokens
  │
  └─ 查询所有 bot 记录
       └─ 为每个 Bot 实例化 ChatWorker(bot_id=Y)
            └─ 使用该 Bot 的 token、chat_id
            └─ 按优先级选用 chat prompt
            └─ 维护独立对话历史（Redis: chat:history:<bot_id>）
            └─ 每日生成独立 user_profile（按 bot_id）

全局字典：
  _email_workers: dict[int, EmailWorker]   # user_id → email worker
  _chat_workers:  dict[int, ChatWorker]    # bot_id  → chat worker
```

**两类 Worker 对比：**

| | EmailWorker | ChatWorker |
|---|---|---|
| 触发方式 | 定时轮询 Gmail API | 长轮询 Telegram getUpdates |
| 绑定维度 | user（一个用户一个）| bot（一个 Bot 一个）|
| 使用 Bot | 该用户的默认 Bot | 自身 |
| Prompt | email_analysis / email_summary / telegram_notify | chat / user_profile |
| 会话历史 | 无 | 按 bot_id 隔离 |

### Worker 生命周期

| API | 行为 |
|-----|------|
| `POST /users/{id}/worker/start` | 实例化并启动该用户的 worker，同时更新 `user.worker_enabled=TRUE` |
| `POST /users/{id}/worker/stop` | 停止并销毁，更新 `user.worker_enabled=FALSE` |
| `GET /users/{id}/worker/status` | 返回是否运行中、最后轮询时间、本次统计 |

---

## Prompt 管理

### 首次启动导入

```
应用启动 → init_db() → 检测 prompts 表中 user_id IS NULL 的记录数
  → 若为 0：读取 app/prompts/*.txt → 批量 INSERT（幂等）
  → 若 > 0：跳过
```

导入映射：

| 文件 | type | name |
|------|------|------|
| `chat.txt` | `chat` | 对话回复 |
| `user_profile.txt` | `user_profile` | 用户画像生成 |
| `gmail/email_analysis.txt` | `email_analysis` | 邮件分析 |
| `gmail/email_summary.txt` | `email_summary` | 邮件摘要 |
| `gmail/telegram_notify.txt` | `telegram_notify` | Telegram 通知 |

### 用户选用逻辑

**聊天 Prompt（chat 类型）—— 按 Bot 查找：**
1. 该 Bot 绑定的 `chat_prompt_id`
2. 该 Bot 所属用户的 `is_default=TRUE` 的 `chat` prompt
3. 系统内置（`user_id=NULL`）的 `chat` prompt
4. 磁盘文件（兜底）

**其他类型 Prompt（email_analysis / email_summary 等）—— 按用户查找：**
1. 用户自己的 `is_default=TRUE` 的该类型 prompt
2. 系统内置（`user_id=NULL`）的该类型 prompt
3. 磁盘文件（兜底）

---

## Redis 新增键

在现有 5 个键模式基础上新增：

| 键 | 类型 | TTL | 说明 |
|----|------|-----|------|
| `jwt:version:<user_id>` | String（整数）| 无 | JWT 版本计数器，用于主动吊销 |
| `chat:history:<bot_id>` | List | 7d | 替代原 `chat:history:<chat_id>`，按 bot_id 隔离 |
| `chat:history_today:<bot_id>` | List | 25h | 替代原 `chat:history_today:<chat_id>` |
| `dedup:tg:<bot_id>:<update_id>` | String | 10min | 加 bot_id 前缀，防跨 Bot 误判 |
| `queue:chat:<bot_id>` | List | 无 | 每个 Bot 独立消息队列 |

---

## API 变更

### 新增 Endpoints

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| `GET` | `/auth/oauth/start` | 无 | 发起 Gmail OAuth，返回授权 URL |
| `GET` | `/auth/oauth/callback` | 无 | OAuth 回调，upsert user，签发 JWT |
| `POST` | `/auth/admin-login` | 无 | Admin 密码登录，返回 JWT |
| `GET` | `/auth/me` | 已登录 | 返回当前登录用户信息 |
| `GET` | `/users` | admin | 所有账号列表 |
| `GET` | `/users/{id}` | 本人或 admin | 查看账号详情 |
| `PUT` | `/users/{id}` | 本人或 admin | 修改账号信息（名称、邮件过滤规则）|
| `POST` | `/users/{id}/worker/start` | 本人或 admin | 启动邮件 Worker（需存在默认 Bot）|
| `POST` | `/users/{id}/worker/stop` | 本人或 admin | 停止邮件 Worker |
| `GET` | `/users/{id}/worker/status` | 本人或 admin | 查询邮件 Worker 状态 |
| `GET` | `/users/{id}/bots` | 本人或 admin | 查询该用户的 Bot 列表 |
| `POST` | `/users/{id}/bots` | 本人或 admin | 添加新 Bot |
| `PUT` | `/users/{id}/bots/{bot_id}` | 本人或 admin | 修改 Bot（名称、token、chat_id、chat_prompt_id）|
| `DELETE` | `/users/{id}/bots/{bot_id}` | 本人或 admin | 删除 Bot（默认 Bot 需先切换默认才能删）|
| `POST` | `/users/{id}/bots/{bot_id}/set-default` | 本人或 admin | 将指定 Bot 设为默认（自动取消其他）|
| `GET` | `/prompts` | 已登录 | 查询可用 prompt（系统内置 + 自己的）|
| `POST` | `/prompts` | 已登录 | 创建用户私有 prompt |
| `PUT` | `/prompts/{id}` | 所有者或 admin | 修改 prompt |
| `DELETE` | `/prompts/{id}` | 所有者或 admin | 删除 prompt（系统内置不可删）|

### 现有 Endpoints 变更

| 路径 | 变更 |
|------|------|
| `GET /logs` | 加 JWT 认证；admin 返回全部，user 过滤 `user_id=me.id` |
| `GET /db/stats` | 加 JWT 认证；admin 返回全局统计，user 返回自己的统计 |
| `GET/POST /prompts/*` | 原文件接口废弃，统一走数据库 `prompts` 表 |
| 其余所有 endpoints | 加 `Depends(current_user)` |

---

## 前端变更

### 新增页面

| 路由 | 页面 | 说明 |
|------|------|------|
| `/login` | 登录页 | Gmail OAuth 按钮 + admin 密码表单 |
| `/accounts` | 账号管理 | 账号列表（admin 看全部，user 只看自己）、添加账号、启停邮件 Worker |
| `/accounts/{id}/bots` | Bot 管理 | Bot 列表；添加/删除/编辑 Bot；设置默认 Bot；绑定专属 Prompt |

### 现有页面变更

| 页面 | 变更 |
|------|------|
| `Home.tsx` | log 列表新增 "用户" 列（admin 可见具体用户，user 列隐藏或固定为自己）|
| `Prompts.tsx` | 从数据库加载 prompt，区分系统内置（只读）和用户私有（可编辑）|
| `Settings.tsx` | 拆分为全局设置（admin）和个人设置（当前用户）|
| `Layout.tsx` | 根据 role 显示/隐藏菜单项（账号管理仅 admin 可见）|

### API Client 变更

- `localStorage` 存储 JWT
- 所有请求自动注入 `Authorization: Bearer <token>` header
- 响应拦截器：收到 401 自动跳转 `/login`

---

## 实施阶段

| 阶段 | 内容 | 关键文件 |
|------|------|----------|
| 1. 数据库 | 重写 `db.py`：删 `sender`，改 `worker_logs→log`，建 `user`/`bot`/`prompts` 表，各表加 `user_id`/`bot_id` | `app/db.py` |
| 2. Auth | JWT 模块；OAuth 回调登录；admin 密码登录；依赖注入；启动检测 admin | `app/core/auth.py`、`app/main.py` |
| 3. 用户/Bot/Prompt API | CRUD endpoints；权限校验；Bot 默认切换逻辑 | `app/main.py` 或拆路由 |
| 4. 多账号 Worker | `EmailWorker` 按 user 实例化；`ChatWorker` 按 bot 实例化；启动恢复；Redis key 改为 bot_id | `app/skills/gmail/worker.py`、`app/core/bot_worker.py`、`app/main.py` |
| 5. 前端 | 登录页；JWT 拦截器；账号管理页；Bot 管理页；log 用户列；prompt UI | `frontend/src/` |

---

## 环境变量补充

```ini
# .env
ADMIN_USER=admin@example.com   # 首次启动自动创建 admin 用的邮箱
ADMIN_PASSWORD=changeme        # 首次启动 admin 初始密码（生产环境必须修改）
JWT_SECRET=your-secret-key     # JWT 签名密钥（生产环境用强随机串）
JWT_EXPIRE_MINUTES=60          # Access Token 有效期（分钟）
```

---

*本文档对应功能尚未实施，实施过程中如有调整请同步更新。*
