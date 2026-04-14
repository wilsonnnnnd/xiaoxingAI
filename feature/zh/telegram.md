# Telegram 集成

## 概述

小星与 Telegram 的集成包含两部分：

- **推送通知**：邮件处理完成后，将 HTML 格式通知推送到 Telegram。
- **多 Bot 实时对话**：每个 Bot 可作为对话式 AI 助手运行，支持记忆、人设与工具。

每个用户可绑定自己的 Telegram Bot，并通过 bot mode 控制行为。

## Bot 模式

| 模式 | 行为 |
|------|------|
| `all` | 全功能：聊天 + 邮件推送 |
| `chat` | 仅聊天，不接收邮件推送 |
| `notify` | 仅邮件推送，忽略聊天消息 |

## 推送通知

### 配置步骤

1. 在 Telegram 找 **@BotFather** → 发送 `/newbot` → 复制 Token
2. 通过 **@userinfobot** 或设置页的 **Get Chat ID** 按钮获取 Chat ID
3. 在设置 → Bot 管理 中添加新 Bot（填入 Token 和 Chat ID）
4. 设置 Bot 模式：`notify`（仅推送）或 `all`（聊天 + 推送）
5. 在技能 → Gmail 页面启动 Gmail Worker

### 通知格式

通知由 LLM 使用 `telegram_notify.txt` 生成，以 HTML 格式发送：

```
📧 <b>[优先级] 邮件主题</b>
From: sender@example.com

AI 生成的邮件摘要内容...

<i>处理时间：HH:MM:SS</i>
```

## 多 Bot 实时对话

### 对话历史

- 每个 Bot 在内存中保留最近 **40 条消息**（20 轮对话）
- 历史持久化于 Redis（7 天 TTL），服务重启后自动恢复
- `/clear` 命令清空该 Bot 的所有对话历史
- 每个 Bot 独立一把 `threading.Lock`，防止并发消息时的竞争条件

### 自定义人格

每个 Bot 可绑定自定义聊天 Prompt，用于定义其个性、沟通风格和身份。

- 生成人格：技能 → 聊天 → 人格生成器
- 保存并分配给 Bot：技能 → 聊天 → Prompt 管理 → 分配

详见 [聊天人格生成器 →](persona.md)

### 内置命令

| 命令 | 功能 |
|------|------|
| `/start`, `/hi` | 打招呼 |
| `/clear` | 清空对话历史 |
| `/help` | 显示可用命令 |

### 工具集成

Bot 可根据消息意图调用内置工具：

- **get_time** — 返回当前时间
- **get_emails** — 列出最近邮件
- **fetch_email** — 获取邮件完整内容

轻量 Router LLM（端口 8002）负责调度；不可达时自动降级为关键词匹配。

详见 [工具系统 →](tool-system.md)

## 长期记忆

每天凌晨，Bot 将当天对话提炼为结构化记忆并按相关性注入未来对话。

详见 [记忆系统 →](memory.md)

## 去重与稳定性

- Telegram update 去重：Redis `SET NX` 基于 `update_id` 避免重复处理。
- 多 Bot 并发：所有 Bot 以独立 asyncio 任务并发运行。

## 相关文档

- [Gmail 流水线 →](gmail.md)
- [工具系统 →](tool-system.md)
- [LLM 配置 →](llm-configuration.md)
