# Xiaoxing AI — API 接口文档

[English](api.md)

Base URL：`http://127.0.0.1:8000/api`

除 `/api/auth/login` 外，所有接口均需在请求头中携带 JWT：`Authorization: Bearer <token>`。
交互式文档：http://127.0.0.1:8000/docs

---

## 1. 系统与健康 (System & Health)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/` | 根路径 |
| GET | `/api/health` | 健康检查 |
| GET | `/api/ai/ping` | 测试 LLM 连接 |

## 2. 认证 (Auth)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 管理员登录获取 JWT |
| GET | `/api/auth/me` | 获取当前用户信息 |

## 3. 用户管理 (Users)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users` | 列出所有用户（仅管理员） |
| POST | `/api/users` | 创建用户（仅管理员） |
| GET | `/api/users/{user_id}` | 获取指定用户（本人或管理员） |
| PUT | `/api/users/{user_id}` | 更新用户设置（本人或管理员） |

## 4. Bot 管理 (Bots)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users/{user_id}/bots` | 列出用户的所有 Bot |
| POST | `/api/users/{user_id}/bots` | 创建 Bot |
| PUT | `/api/users/{user_id}/bots/{bot_id}` | 更新 Bot |
| DELETE | `/api/users/{user_id}/bots/{bot_id}` | 删除 Bot |
| POST | `/api/users/{user_id}/bots/{bot_id}/set-default` | 设为默认 Bot |

## 5. 提示词管理 (Prompts)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/db/prompts` | 列出当前用户创建的 DB Prompt |
| POST | `/api/db/prompts` | 创建 DB Prompt |
| PUT | `/api/db/prompts/{prompt_id}` | 更新 DB Prompt |
| DELETE | `/api/db/prompts/{prompt_id}` | 删除 DB Prompt |
| GET | `/api/prompts` | 列出文件 Prompt |
| GET | `/api/prompts/{filename:path}` | 获取单个文件 Prompt |
| POST | `/api/prompts/{filename:path}` | 保存文件 Prompt |
| DELETE | `/api/prompts/{filename:path}` | 删除文件 Prompt |

## 6. 配置与统计 (Config & Stats)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/config` | 读取当前运行时配置 |
| POST | `/api/config` | 更新 .env 并热重载 |
| GET | `/api/db/stats` | 获取数据库统计信息 |

## 7. AI 处理 (AI Processing)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/analyze` | AI 邮件分析 |
| POST | `/api/ai/summary` | AI 邮件总结 |
| POST | `/api/ai/process` | AI 综合处理流程 |

## 8. 邮件记录 (Email Records)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/email/records` | 列出邮件记录 |
| GET | `/api/email/records/{email_id}` | 获取单条邮件记录详情 |

## 9. Gmail Worker & 操作

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/worker/start` | 启动所有已启用用户的 Worker |
| POST | `/api/worker/stop` | 停止所有 Worker |
| GET | `/api/worker/status` | 获取 Worker 聚合状态 |
| POST | `/api/worker/poll` | 立即触发一次轮询 |
| GET | `/api/worker/logs` | 获取 Worker 运行日志 |
| DELETE | `/api/worker/logs` | 清空 Worker 日志 |
| GET | `/api/gmail/auth/url` | 获取 Google OAuth 授权 URL |
| GET | `/api/gmail/auth` | 跳转 Google OAuth 授权页 |
| GET | `/api/gmail/callback` | OAuth 回调，保存 Token |
| POST | `/api/gmail/compose` | 生成发件邮件草稿 |
| POST | `/api/gmail/fetch` | 主动拉取 Gmail 邮件 |
| POST | `/api/gmail/process` | 触发处理获取到的 Gmail 邮件 |
| GET | `/api/gmail/workstatus` | 获取 Gmail 处理工作状态 |

## 10. Telegram 工具 (Telegram Tools)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/telegram/test` | 发送 Telegram 测试消息 |
| GET | `/api/telegram/chat_id` | 获取 Telegram Chat ID |

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
