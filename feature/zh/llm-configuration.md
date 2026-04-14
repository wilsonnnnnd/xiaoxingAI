# LLM 配置

## 概述

小星支持两种方式运行主模型（Main LLM）：

- **本地**：启动一个 OpenAI 兼容接口的服务（例如 llama.cpp 的 `llama-server`）
- **云端**：使用 OpenAI API（或其他兼容 OpenAI 的服务，只需调整 endpoint）

此外系统还支持可选的 **Router LLM**：用于在 Telegram 聊天中识别用户意图并选择调用哪些工具。

## 主模型（Main LLM）

### 环境变量

| 变量 | 说明 | 示例 |
|---|---|---|
| `LLM_BACKEND` | `local` 或 `openai` | `local` |
| `LLM_API_URL` | OpenAI 兼容 chat-completions 地址 | `http://127.0.0.1:8001/v1/chat/completions` |
| `LLM_MODEL` | 传给接口的模型名 | `local-model` / `gpt-4o-mini` |
| `OPENAI_API_KEY` | 当 `LLM_BACKEND=openai` 时必填 | `sk-...` |

### 本地（推荐自托管）

1. 启动本地 OpenAI 兼容服务。
2. 配置：

```ini
LLM_BACKEND=local
LLM_API_URL=http://127.0.0.1:8001/v1/chat/completions
LLM_MODEL=local-model
```

### OpenAI API

```ini
LLM_BACKEND=openai
LLM_API_URL=https://api.openai.com/v1/chat/completions
LLM_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-...
```

## Router LLM（可选）

Router LLM 用于 Telegram 聊天的“工具意图识别”。如果 Router 不可达，系统会自动降级为关键词匹配。

### 环境变量

| 变量 | 说明 | 示例 |
|---|---|---|
| `ROUTER_API_URL` | Router 模型接口地址（OpenAI 兼容） | `http://127.0.0.1:8002/v1/chat/completions` |
| `ROUTER_MODEL` | Router 模型名 | `local-router` |

```ini
ROUTER_API_URL=http://127.0.0.1:8002/v1/chat/completions
ROUTER_MODEL=local-router
```

## Prompt

- 主对话 Prompt：`app/prompts/chat.txt`
- Router Prompt：`app/prompts/tools/router.txt`

Prompt 从磁盘读取，设计目标是修改后可以快速生效。

## 缓存与稳定性

- Redis 可用时：会对部分 LLM 结果做 TTL 缓存，降低重复调用。
- Redis 不可用时：自动降级（不缓存）。

## 常见问题

- **401/未授权**：`LLM_BACKEND=openai` 时检查 `OPENAI_API_KEY`。
- **连接失败**：检查 `LLM_API_URL` / `ROUTER_API_URL` 的 host/port 是否正确。
- **工具路由不工作**：Router 不可达会走关键词降级，属于预期行为。

## 相关文档

- [工具系统 →](tool-system.md)
- [Telegram 集成 →](telegram.md)
