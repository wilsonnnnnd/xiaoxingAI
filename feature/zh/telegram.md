# Telegram 集成

## 概述

小星使用 Telegram 来做两类事情：

- 邮件处理完成后的通知推送（HTML 消息）
- 发信草稿的交互按钮（确认/取消/修改），通过 `callback_data` 回传到后端

每个用户可绑定一个或多个 Telegram Bot；Gmail Worker 只会向 `all` / `notify` 模式的 Bot 推送通知。

## Bot 模式

| 模式 | 行为 |
|------|------|
| `all` | 接收邮件通知 |
| `notify` | 接收邮件通知（仅通知） |

## 推送通知

### 配置步骤

1. 在 Telegram 找 **@BotFather** → 发送 `/newbot` → 复制 Token
2. 通过 **@userinfobot** 或设置页的 **Get Chat ID** 按钮获取 Chat ID
3. 在设置 → Bot 管理 中添加新 Bot（填入 Token 和 Chat ID）
4. 设置 Bot 模式：`notify` 或 `all`
5. 在技能 → Gmail 页面启动 Gmail Worker

### 通知格式

通知由 LLM 使用 `app/prompts/gmail/telegram_notify.txt` 生成，以 HTML 格式发送。

## 发信草稿回调按钮（callback）

系统在生成发信/回复草稿后，可在 Telegram 预览消息上附带内联按钮（确认/取消）。由于 `callback_data` 可能被伪造，后端会对其进行签名校验。

必需环境变量：

- `TELEGRAM_CALLBACK_SECRET`：用于签名与校验回调 payload 的密钥

## 去重与稳定性

- Telegram update 去重：Redis 基于 `update_id` 做去重，避免重复处理。

## 相关文档

- [Gmail 流水线 →](gmail.md)
- [工具系统 →](tool-system.md)
- [LLM 配置 →](llm-configuration.md)
