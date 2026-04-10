# 小星 AI — API 接口文档

[English](api.md)

Base URL：`http://127.0.0.1:8000`

除 `/auth/login` 外，所有接口均需在请求头中携带 JWT：`Authorization: Bearer <token>`。
交互式文档：http://127.0.0.1:8000/docs

---

## 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/login` | 管理员登录 → JWT |
| GET | `/auth/me` | 当前用户信息 |

---

## 用户管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/users` | 列出所有用户（仅管理员） |
| POST | `/users` | 创建普通用户（仅管理员） |
| GET | `/users/{id}` | 获取用户（本人或管理员） |
| PUT | `/users/{id}` | 更新用户设置（本人或管理员） |

---

## Bot 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/users/{id}/bots` | 列出用户的所有 Bot |
| POST | `/users/{id}/bots` | 创建 Bot |
| PUT | `/users/{id}/bots/{bot_id}` | 更新 Bot |
| DELETE | `/users/{id}/bots/{bot_id}` | 删除 Bot |
| POST | `/users/{id}/bots/{bot_id}/set-default` | 设为默认 Bot |

---

## Prompt 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/db/prompts` | 列出 Prompt（系统内置 + 本人创建） |
| POST | `/db/prompts` | 创建自定义 Prompt |
| PUT | `/db/prompts/{id}` | 更新 Prompt |
| DELETE | `/db/prompts/{id}` | 删除 Prompt |

---

## Gmail Worker

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/worker/start` | 启动所有已启用用户的 Worker |
| POST | `/worker/stop` | 停止所有 Worker |
| GET | `/worker/status` | 聚合状态 |
| POST | `/worker/poll` | 立即触发一次轮询 |
| GET | `/worker/logs` | 获取日志 |
| DELETE | `/worker/logs` | 清空日志 |
| GET | `/gmail/auth` | 跳转 Google OAuth 授权页 |
| GET | `/gmail/callback` | OAuth 回调，保存 token |

---

## Telegram Bot（聊天 Worker）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/telegram/bot/start` | 启动所有已注册 Bot |
| POST | `/telegram/bot/stop` | 停止所有 Bot |
| GET | `/telegram/bot/status` | Bot 运行状态 |
| POST | `/telegram/bot/clear_history` | 清空所有对话历史 |
| GET | `/telegram/bot/profile` | 获取用户记忆画像 |
| DELETE | `/telegram/bot/profile` | 删除用户记忆画像 |
| POST | `/telegram/bot/generate_profile` | 手动触发画像生成 |

---

## 邮件记录 & 配置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/email/records` | 列出邮件记录 |
| GET | `/email/records/{email_id}` | 获取单条邮件记录 |
| GET | `/config` | 读取当前运行时配置 |
| POST | `/config` | 更新 .env 并热重载 |
| GET | `/db/stats` | 数据库统计信息 |
| GET | `/health` | 健康检查 |
| GET | `/ai/ping` | 测试 LLM 连接 |

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
