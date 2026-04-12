# Xiaoxing AI — API 接口文档

Base URL：`http://127.0.0.1:8000`

除 `/auth/login` 外，所有接口均需在请求头中携带 JWT：`Authorization: Bearer <token>`。
交互式文档：http://127.0.0.1:8000/docs

---

## 1. 系统与健康 (System & Health)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 根路径 |
| GET | `/health` | 健康检查 |
| GET | `/ai/ping` | 测试 LLM 连接 |

## 2. 认证 (Auth)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/login` | 管理员登录获取 JWT |
| GET | `/auth/me` | 获取当前用户信息 |

## 3. 用户管理 (Users)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/users` | 列出所有用户（仅管理员） |
| POST | `/users` | 创建用户（仅管理员） |
| GET | `/users/{user_id}` | 获取指定用户（本人或管理员） |
| PUT | `/users/{user_id}` | 更新用户设置（本人或管理员） |

## 4. Bot 管理 (Bots)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/users/{user_id}/bots` | 列出用户的所有 Bot |
| POST | `/users/{user_id}/bots` | 创建 Bot |
| PUT | `/users/{user_id}/bots/{bot_id}` | 更新 Bot |
| DELETE | `/users/{user_id}/bots/{bot_id}` | 删除 Bot |
| POST | `/users/{user_id}/bots/{bot_id}/set-default` | 设为默认 Bot |

## 5. 提示词管理 (Prompts)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/db/prompts` | 列出当前用户创建的 DB Prompt |
| POST | `/db/prompts` | 创建 DB Prompt |
| PUT | `/db/prompts/{prompt_id}` | 更新 DB Prompt |
| DELETE | `/db/prompts/{prompt_id}` | 删除 DB Prompt |
| GET | `/prompts` | 列出文件 Prompt |
| GET | `/prompts/{filename:path}` | 获取单个文件 Prompt |
| POST | `/prompts/{filename:path}` | 保存文件 Prompt |
| DELETE | `/prompts/{filename:path}` | 删除文件 Prompt |

## 6. 配置与统计 (Config & Stats)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/config` | 读取当前运行时配置 |
| POST | `/config` | 更新 .env 并热重载 |
| GET | `/admin/persona-config` | 获取系统 Persona 配置 |
| PUT | `/admin/persona-config` | 更新系统 Persona 配置 |
| GET | `/db/stats` | 获取数据库统计信息 |

## 7. AI 处理 (AI Processing)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/ai/analyze` | AI 邮件分析 |
| POST | `/ai/summary` | AI 邮件总结 |
| POST | `/ai/process` | AI 综合处理流程 |

## 8. 邮件记录 (Email Records)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/email/records` | 列出邮件记录 |
| GET | `/email/records/{email_id}` | 获取单条邮件记录详情 |

## 9. Gmail Worker & 操作

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/worker/start` | 启动所有已启用用户的 Worker |
| POST | `/worker/stop` | 停止所有 Worker |
| GET | `/worker/status` | 获取 Worker 聚合状态 |
| POST | `/worker/poll` | 立即触发一次轮询 |
| GET | `/worker/logs` | 获取 Worker 运行日志 |
| DELETE | `/worker/logs` | 清空 Worker 日志 |
| GET | `/gmail/auth/url` | 获取 Google OAuth 授权 URL |
| GET | `/gmail/auth` | 跳转 Google OAuth 授权页 |
| GET | `/gmail/callback` | OAuth 回调，保存 Token |
| POST | `/gmail/compose` | 生成发件邮件草稿 |
| POST | `/gmail/fetch` | 主动拉取 Gmail 邮件 |
| POST | `/gmail/process` | 触发处理获取到的 Gmail 邮件 |
| GET | `/gmail/workstatus` | 获取 Gmail 处理工作状态 |

## 10. Telegram Bot & 聊天 (Telegram Bot & Chat)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/telegram/bot/start` | 启动所有已注册的 Telegram Bot |
| POST | `/telegram/bot/stop` | 停止所有 Telegram Bot |
| GET | `/telegram/bot/status` | 获取 Telegram Bot 运行状态 |
| POST | `/telegram/bot/clear_history` | 清空所有对话历史 |
| GET | `/telegram/bot/profile` | 获取用户记忆画像 |
| DELETE | `/telegram/bot/profile` | 删除用户记忆画像 |
| POST | `/telegram/bot/generate_profile` | 手动触发记忆画像生成 |
| POST | `/telegram/test` | 发送 Telegram 测试消息 |
| GET | `/telegram/chat_id` | 获取 Telegram Chat ID |
| POST | `/chat/generate_persona_prompt` | 生成 Persona Prompt 对话 |
| GET | `/chat/workstatus` | 获取 Chat 处理工作状态 |

---

## 错误格式

所有错误遵循 FastAPI 标准格式：
```json
{ "detail": "错误描述信息" }
```

HTTP 状态码：
- `400` — 请求有误（配置缺失、状态非法）
- `401` — 未授权（JWT 缺失或过期）
- `403` — 禁止访问（如访问他人资源）
- `404` — 资源不存在
- `422` — 参数校验失败（未知配置项、字段缺失）
- `500` — 服务器内部错误
- `502` — LLM 后端不可达
```
