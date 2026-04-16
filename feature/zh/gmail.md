# Gmail 邮件处理流水线

## 概述

每个注册用户独立运行一个 Gmail 轮询 Worker。新邮件到达后经过 3 阶段 AI 流水线处理，并推送到 Telegram。

```
Gmail (OAuth2) → AI 分析 → Telegram 推送
```

## 工作原理

### 1. Gmail 轮询

- 每个用户在设置页面通过 Google OAuth2 授权自己的 Gmail 账号（设置 → "Authorize via Google"）
- 后台 Worker 按配置的时间间隔（默认 300 秒）轮询收件箱
- 只获取符合搜索语法的邮件（默认：`is:unread in:inbox category:primary`）
- OAuth Token 加密存储于 PostgreSQL，按用户隔离

### 2. AI 分析流水线

每封邮件依次经过 3 个 LLM 调用：

| 步骤 | 使用的 Prompt | 输出 |
|------|--------------|------|
| 1. 分类 | `email_analysis.txt` | 优先级（紧急/正常/低）+ 类别 |
| 2. 摘要 | `email_summary.txt` | 2–4 句简短摘要 |
| 3. Telegram 消息 | `telegram_notify.txt` | HTML 格式的通知文本 |

Telegram 聊天的工具路由属于独立子系统（见“工具系统”），不属于单封邮件处理流水线。

分析结果在 Redis 中缓存 1 小时（以邮件 ID 为键）。Redis 不可达时流水线照常运行，不使用缓存。

### 3. 优先级过滤

每个用户可设置最低推送优先级阈值。低于阈值的邮件仍会分析处理，但不推送 Telegram。

配置位置：设置 → Gmail → 最低优先级

### 4. 去重保障

- 已处理邮件 ID 按 `(user_id, email_id)` 组合存入 `email_records` 表
- 每封处理邮件的完整记录（正文、AI 分析、摘要、Telegram 消息、token 数量）均持久化

## 环境变量配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `GMAIL_POLL_INTERVAL` | `300` | 轮询间隔（秒） |
| `GMAIL_POLL_QUERY` | `is:unread in:inbox category:primary` | Gmail 搜索语法（兜底值） |
| `GMAIL_POLL_MAX` | `5` | 每次最多处理邮件数 |
| `GMAIL_MARK_READ` | `true` | 处理后标记已读 |
| `NOTIFY_MIN_PRIORITY` | _（空）_ | 推送的最低优先级，留空则全部推送 |

设置页也提供每用户独立的配置覆盖。

---

## 邮件发送（草稿 + 确认）

发信采用“先生成草稿、再确认发送”的流程，用来避免误发：

1. 生成草稿（新发/回复）。
2. 发送 Telegram 预览。
3. 用户在 Telegram 中确认/取消（按钮），或回复文字修改草稿。
4. 仅在确认后才调用 Gmail API 真发送。

### 数据模型

- `outgoing_email_drafts`：保存发信草稿（正文加密）、绑定 Telegram 预览消息、维护状态。
- `outgoing_email_actions`：动作审计 + 幂等（`telegram_update_id` 唯一）防重复发送。

### 安全

- 草稿正文使用 AES-GCM 加密。
- Telegram inline button 的 callback_data 使用签名校验。

### 关键环境变量

| 变量 | 说明 |
|---|---|
| `OUTGOING_EMAIL_ENCRYPTION_KEY` | 发信草稿正文加密密钥（base64(32 bytes)） |
| `OUTGOING_DRAFT_TTL_MINUTES` | 草稿有效期（分钟），过期后不允许确认发送 |
| `TELEGRAM_CALLBACK_SECRET` | callback_data HMAC 签名密钥 |

---

## 回复格式设置

系统支持按用户配置“邮件回复格式”，用于统一 AI 生成的回复草稿排版。

### 占位符

- `{{content}}`：AI 生成的回复正文
- `{{signature}}`：用户配置的署名
- `{{closing}}`：模板可选结尾语
- `{{sender_name}}`：发件人名称占位符（生成/发送草稿时会替换）

### Web 页面

- 路由：`/settings/reply-format`
- 支持：模板增删改查、设置默认模板、编辑署名、实时预览。

## 前提条件

- 项目根目录放置 `credentials.json`（Google Cloud Console → OAuth 2.0 客户端 ID → 桌面应用）
- 每个用户启动 Worker 前须先点击设置页的 **Authorize via Google** 完成授权

## 相关文档

- [Telegram 集成 →](telegram.md)
- [Prompt 管理 →](prompts.md)
