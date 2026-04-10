# Prompt 管理

## 概述

Xiaoxing 所有 LLM Prompt 均可在 Web UI 中编辑。分为两类：系统内置 Prompt（所有用户共享）和每用户自定义 Prompt。

## Prompt 类型

| 类型键 | 用途 |
|--------|------|
| `chat` | Bot 对话人格（可按 Bot 独立分配） |
| `email_analysis` | Gmail 邮件分类和优先级判断 |
| `email_summary` | 邮件摘要生成 |
| `telegram_notify` | Telegram 通知消息撰写 |
| `user_profile` | 从聊天历史提炼记忆 |
| `router` _（隐藏）_ | 工具调度路由 — 不在 UI 编辑器中显示 |

## 内置 Prompt

位于 `app/prompts/`，首次启动时自动导入数据库。可在 **Prompt** 页面编辑（仅管理员）。

修改**即时生效** — 所有 Prompt 在每次 LLM 调用时热重载，无需重启服务。

## 自定义 Prompt（聊天人格）

用户可通过人格生成器（技能 → 聊天）创建自己的聊天人格 Prompt，以 `type = 'chat'` 存入 `user_prompts`，按用户隔离。

每个 Bot 可绑定一个自定义 Prompt：
- 技能 → 聊天 → Prompt 管理 → 选择 Bot → 分配
- 绑定后，该 Prompt 替换系统默认的 Xiaoxing 人格描述进入聊天系统提示词
- 如包含 `[身份设定]` 头部，会被解析为明确的身份陈述句注入

## `router.txt` 特殊说明

`router.txt` 驱动工具路由系统，它：
- 存放在 `app/prompts/tools/router.txt`
- 不在 UI Prompt 编辑器中展示（非用户可见配置）
- 每次工具路由调用时热重载

## Prompt 变量

Prompt 使用 Python `str.format()` 替换变量，各 Prompt 支持的变量如下：

| Prompt | 可用变量 |
|--------|---------|
| `chat.txt` | `{persona_section}`, `{profile_section}`, `{db_context_section}`, `{history}`, `{message}` |
| `user_profile.txt` | `{existing_profile}`, `{chat_history}` |
| `email_analysis.txt` | `{email_body}` |
| `email_summary.txt` | `{email_body}` |
| `telegram_notify.txt` | `{analysis}`, `{summary}` |

## 相关文档

- [聊天人格 →](persona.md)
- [工具系统 →](tool-system.md)
