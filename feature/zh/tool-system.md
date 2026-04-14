# AI 工具系统

## 概述

Telegram Bot 可根据用户消息的意图调用内置工具。轻量 Router LLM 负责决定调用哪些工具；Router 不可达时自动降级为关键词匹配。

## 可用工具

| 工具 | 触发示例 | 返回内容 |
|------|---------|---------|
| `get_time` | "现在几点？"/ "What time is it?" | 当前本地日期和时间 |
| `get_emails` | "有什么新邮件？"/ "Any emails?" | 最近邮件的主题和发件人列表 |
| `fetch_email` | "看看这封邮件"/ "Show me that email" | 某封邮件的完整内容 |
| `reply_email` | 在 Telegram 中回复某条“邮件通知” | 生成回复草稿预览（需要邮件上下文） |
| `outgoing_draft_confirm` | 在草稿预览下回复“确认/发送” | 确认并发送该草稿 |
| `outgoing_draft_cancel` | 在草稿预览下回复“取消” | 取消该草稿 |
| `outgoing_draft_modify` | 在草稿预览下回复修改指令 | 重新生成草稿正文 |

工具返回结果以带标签的格式注入 LLM 上下文：

```
【系统实时数据 — 必须以此为准，禁止用自己的知识或猜测替代】
...工具输出...
【以上数据来自系统工具，请直接基于此回答用户问题】
```

## 路由机制

### 主路由：Router LLM

第二个较小的 LLM（推荐 Qwen2.5-1.5B，端口 8002）读取用户消息并决定调用哪些工具。路由 Prompt 从 `app/prompts/tools/router.txt` 热重载，修改即时生效，无需重启。

`.env` 配置：
```
ROUTER_API_URL=http://127.0.0.1:8002/v1/chat/completions
ROUTER_MODEL=local-router
```

### 备用路由：关键词匹配

Router LLM 不可达时自动降级：

| 匹配关键词 | 调用工具 |
|-----------|---------|
| 时间 / 几点 / 日期 / 今天 / what time / date | `get_time` |
| 邮件 / email / mail / inbox | `get_emails` |

发信相关工具（`reply_email`、`outgoing_draft_*`）通常需要带上草稿/邮件上下文才能执行，Telegram worker 也会使用 allowlist 方式分步调用以避免误触发。

### 日志输出

每次路由决策均有日志记录：
```
[tools] LLM路由: msg='现在几点' → [get_time]
[tools] 关键词降级: msg='...' → []
```

## 添加新工具

1. 在 `app/core/tools/` 中创建新文件（如 `my_tool.py`），实现返回 `(result_str, token_count)` 的函数
2. 在 `app/core/tools/__init__.py` 中注册该工具
3. 更新 `app/prompts/tools/router.txt`，描述何时调用新工具

## 相关文档

- [Telegram 集成 →](telegram.md)
- [Prompt 管理 →](prompts.md)
- [LLM 配置 →](llm-configuration.md)
