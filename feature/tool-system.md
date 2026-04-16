# AI Tool System

## Overview

Xiaoxing exposes a small set of “tools” that the LLM can call to fetch real data (DB, Gmail) or perform controlled actions (outgoing draft workflow). A lightweight Router LLM decides which tools to call; a keyword-based fallback handles cases where the router is unavailable.

## Available Tools

| Tool | Trigger example | What it returns |
|------|-----------------|-----------------|
| `get_time` | "What time is it?" / "现在几点" | Current local date and time |
| `get_emails` | "Any new emails?" / "有什么邮件" | List of recent email subjects + senders |
| `fetch_email` | "Show me that email" / "看看这封邮件" | Full content of a specific email |
| `reply_email` | Reply to an email notification in Telegram | Generates a reply draft preview (requires email context) |
| `outgoing_draft_confirm` | Reply “confirm/send” under a draft preview | Confirms and sends the outgoing draft |
| `outgoing_draft_cancel` | Reply “cancel” under a draft preview | Cancels the outgoing draft |
| `outgoing_draft_modify` | Reply with instructions under a draft preview | Regenerates the draft body |

Tool results are injected into the LLM context under a clearly labelled section:

```
【系统实时数据 — 必须以此为准，禁止用自己的知识替代】
...tool output...
【以上数据来自系统工具，请直接基于此回答】
```

## Routing

### Primary: Router LLM

A second, smaller LLM reads the user message and decides which tools to invoke.

Configuration via `.env`:

```
ROUTER_API_URL=http://127.0.0.1:8002/v1/chat/completions
ROUTER_MODEL=local-router
```

The router prompt is treated as internal (recommended location: `app/prompts/tools/router.txt`). If the file is missing, the system still works via the fallback strategy below.

### Fallback: Keyword Matching

If the Router LLM is unreachable, the system falls back to keyword matching:

| Keywords (any match) | Tool invoked |
|---------------------|--------------|
| 时间 / 几点 / 日期 / 今天 / what time / date | `get_time` |
| 邮件 / email / mail / inbox | `get_emails` |

The outgoing-email tools (`reply_email`, `outgoing_draft_*`) are generally routed only when the message contains the required context (draft id / email id) and may also be executed via an allowlist in the Telegram worker.

### Logging

Every routing decision is logged:
```
[tools] LLM路由: msg='现在几点' → [get_time]
[tools] 关键词降级: msg='...' → []
```

## Adding a New Tool

1. Create a file in `app/core/tools/` (e.g. `my_tool.py`) implementing a function
2. Register it via the `@register(...)` decorator (imported by `load_tools()`)
3. (Optional) Update the router prompt if you use Router LLM routing

## Related

- [Telegram →](telegram.md)
- [Prompt Editor →](prompts.md)
- [LLM Configuration →](llm-configuration.md)
