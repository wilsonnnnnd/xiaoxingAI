# Prompt 管理

## 概述

小星的 Prompt 以纯文本文件形式存放在 `app/prompts/`。后端在运行时从磁盘读取（`app/utils/prompt_loader.py`），因此编辑后无需重启即可生效。

Web UI 的 Prompt 页面通过 `/prompts` API 直接编辑这些文件。

## Prompt 文件（现状）

常见内置 Prompt：

- `gmail/email_analysis.txt`：邮件分类与优先级判断
- `gmail/email_summary.txt`：邮件摘要生成
- `gmail/telegram_notify.txt`：Telegram 通知消息（HTML）
- `outgoing/email_reply_compose.txt`：生成回复草稿（只输出正文，不含 closing/signature）
- `outgoing/email_edit.txt`：改写草稿（只输出正文，不含 closing/signature）
- `outgoing/email_compose.txt`：生成新邮件草稿

## Web UI 可见性规则

- 普通用户只看到少量白名单 Prompt
- 管理员可查看并编辑所有非 internal 的 Prompt
- `app/prompts/tools/` 目录下的 Prompt 视为 internal，会被 `/prompts` 文件接口隐藏

对应代码位置：

- `app/core/constants.py`（`USER_VISIBLE_PROMPTS`）
- `app/api/routes/prompts.py`（`_is_internal_prompt`）

## 相关文档

- [工具系统 →](tool-system.md)
- [Gmail 流水线 →](gmail.md)
