# 身份认证与用户管理

## 概述

Xiaoxing 采用 JWT 身份认证，密码使用 bcrypt 哈希存储。首次启动时自动创建管理员账号。管理员可创建额外用户，每个用户拥有独立隔离的资源。

## 认证流程

```
POST /auth/login
  → 验证 bcrypt 密码
  → 签发 JWT（HS256，有效期可配置）
  → 在 Redis 中存储 Token 版本号
```

每个已认证请求均会验证：
1. JWT 签名和过期时间
2. Token 版本号与 Redis 中的记录对比（支持即时吊销）

Redis 不可达时版本号校验会降级处理，即时吊销的保证会减弱。

## JWT 配置

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `JWT_SECRET` | _（必填）_ | 签名密钥 — **生产环境必须修改** |
| `JWT_EXPIRE_MINUTES` | `60` | Token 有效期（分钟） |

## 用户角色

| 角色 | 权限 |
|------|------|
| `admin` | 完全访问：管理所有用户、查看所有日志、编辑所有设置 |
| `user` | 仅管理自己的资源：Gmail Worker、Bot、Prompt、OAuth Token |

## 资源隔离

每个用户独立拥有：
- Gmail OAuth Token（`oauth_tokens` 表，按 `user_id` 隔离）
- Gmail Worker 状态和邮件记录
- Telegram Bot（`bot` 表，`user_id` 外键）
- 每用户设置（`user_settings`，`user_id` 外键）
- Prompt 覆盖（`user_prompts`，`user_id` 外键）
- 发信草稿（`outgoing_email_drafts`，按 `user_id` 隔离）
- 回复格式设置与模板（`reply_format_settings`、`reply_templates`）

## 密码管理

- 密码使用 **bcrypt** 哈希（cost factor 12）
- 管理员密码通过 `.env` 中的 `ADMIN_PASSWORD` 在首次启动时设置
- 普通用户密码由管理员在用户管理页面设置
- 无自助找回密码流程，由管理员在 UI 中直接重置

## 注册（邀请码模式）

默认情况下系统禁止公开注册：

- 管理员在「用户管理」页面（`/users`）生成一次性邀请码
- 用户注册时调用 `POST /auth/register` 必须携带 `invite_code`
- 每个邀请码有有效期、可撤销，并记录使用信息（used_email / used_ip / used_at）

`.env` 配置说明：

- `ALLOW_PUBLIC_REGISTER=true` 可开启公开注册（不建议小规模私有部署使用）
- `REGISTER_INVITE_CODE`（可选）：`.env` 中配置的“主邀请码”。设置后该邀请码可直接注册且不会消耗数据库邀请码。推荐留空，使用每码可追踪的邀请码。

## Token 吊销

修改密码或注销登录时，Redis 中该用户的 Token 版本号自增，所有已签发的旧 Token 立即失效。

## 相关文档

- [Web 界面 →](ui.md)
