# Telegram 多 Bot 推送通知

## 概述

每个用户绑定自己的 Telegram Bot。AI 分析完邮件后，系统向用户指定的 Telegram 对话发送 HTML 格式的通知。

## 配置步骤

1. 在 Telegram 找 **@BotFather** → 发送 `/newbot` → 复制 Token
2. 通过 **@userinfobot** 或设置页的 **Get Chat ID** 按钮获取 Chat ID
3. 在设置 → Bot 管理 中添加新 Bot（填入 Token 和 Chat ID）
4. 设置 Bot 模式：`notify`（仅推送）或 `all`（聊天 + 推送）
5. 在技能 → Gmail 页面启动 Gmail Worker

## 多 Bot 架构

- 每个用户可绑定多个不同 Token 的 Bot
- 所有 Bot 以独立 asyncio 任务并发运行
- 每个 Bot 维护独立的 Telegram API 连接和 Chat ID 白名单
- 共享 Redis 任务队列防止多 Bot 并发时重复处理

## 通知格式

通知由 LLM 使用 `telegram_notify.txt` Prompt 生成，以 HTML 格式发送：

```
📧 <b>[优先级] 邮件主题</b>
From: sender@example.com

AI 生成的邮件摘要内容...

<i>处理时间：HH:MM:SS</i>
```

## 去重保障

Redis `SET NX` 基于 `update_id` 确保每条 Telegram 更新仅处理一次，服务重启后依然有效。

## 相关文档

- [Gmail 流水线 →](gmail.md)
- [Telegram 聊天 →](telegram-chat.md)
