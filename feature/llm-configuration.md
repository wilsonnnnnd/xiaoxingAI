# LLM Configuration

## Overview

Xiaoxing supports two ways to run the main LLM:

- **Local**: an OpenAI-compatible server (e.g. llama.cpp `llama-server`)
- **Cloud**: OpenAI API (or any compatible provider by changing the endpoint)

Separately, the system can use an optional **Router LLM** to decide which tools to call in tool-routing flows.

## Main LLM

### Environment Variables

| Variable | Description | Example |
|---|---|---|
| `LLM_BACKEND` | `local` or `openai` | `local` |
| `LLM_API_URL` | OpenAI-compatible chat-completions endpoint | `http://127.0.0.1:8001/v1/chat/completions` |
| `LLM_MODEL` | Model name passed to the endpoint | `local-model` / `gpt-4o-mini` |
| `LLM_API_KEY` | Required when `LLM_BACKEND=openai` (falls back to `OPENAI_API_KEY`) | `sk-...` |
| `OPENAI_API_KEY` | Legacy alias | `sk-...` |

### Local (Recommended for self-host)

1. Start your local OpenAI-compatible server.
2. Set:

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

## Router LLM (Optional)

The Router LLM is a smaller model used for **tool intent detection**. If the router is unavailable, the system falls back to keyword matching.

### Environment Variables

| Variable | Description | Example |
|---|---|---|
| `ROUTER_API_URL` | Router endpoint (OpenAI-compatible) | `http://127.0.0.1:8002/v1/chat/completions` |
| `ROUTER_MODEL` | Router model name | `local-router` |

```ini
ROUTER_API_URL=http://127.0.0.1:8002/v1/chat/completions
ROUTER_MODEL=local-router
```

## Prompts

Prompts are stored under `app/prompts/` and are loaded from disk at runtime.

- Gmail pipeline prompts: `app/prompts/gmail/*`
- Outgoing draft prompts: `app/prompts/outgoing/*`
- Router prompt (internal, optional): `app/prompts/tools/router.txt`

Prompts are loaded from disk and are intended to take effect without needing a full redeploy.

## Caching and Reliability

- If Redis is available, LLM responses may be cached (TTL-based) to reduce repeated calls.
- If Redis is not available, the system degrades gracefully (no caching).

## Troubleshooting

- **401 / unauthorized**: check `LLM_API_KEY` (or `OPENAI_API_KEY`) when using `LLM_BACKEND=openai`.
- **Connection refused**: verify `LLM_API_URL` / `ROUTER_API_URL` host and port.
- **Tool routing not working**: ensure Router LLM is reachable, otherwise keyword fallback applies.

## Related

- [Tool System →](tool-system.md)
- [Telegram →](telegram.md)
