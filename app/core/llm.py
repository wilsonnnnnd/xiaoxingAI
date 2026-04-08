"""
LLM 传输层 — 核心模块
支持本地 llama-server（OpenAI 兼容接口）和 OpenAI API。
相同 prompt + max_tokens 的结果会缓存到 Redis（TTL 1h），命中时直接返回。
"""
import time

import requests

from app import config

MAX_LLM_RETRIES = 3


def _build_headers() -> dict:
    headers = {"Content-Type": "application/json"}
    if config.LLM_BACKEND == "openai" and config.OPENAI_API_KEY:
        headers["Authorization"] = f"Bearer {config.OPENAI_API_KEY}"
    return headers


def call_llm(prompt: str, max_tokens: int = 512) -> tuple:
    """
    调用 LLM（本地 llama-server 或 OpenAI API，由 config.LLM_BACKEND 决定）。
    - 优先命中 Redis 缓存（相同 prompt+max_tokens，TTL 1h）
    - 4xx 错误（如上下文过长）直接抛出，不重试
    - 5xx 或网络错误最多重试 MAX_LLM_RETRIES 次（指数退避）
    返回 (content_str, token_count)。
    """
    # ── Redis 缓存命中 ────────────────────────────────────
    try:
        from app.core.redis_client import get_llm_cache, set_llm_cache
        cached = get_llm_cache(prompt, max_tokens)
        if cached is not None:
            return cached
    except Exception:
        pass  # redis_client 未就绪时不阻断

    url     = config.LLM_API_URL
    model   = config.LLM_MODEL
    timeout = 120

    for attempt in range(MAX_LLM_RETRIES):
        try:
            resp = requests.post(
                url,
                headers=_build_headers(),
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                    "max_tokens": max_tokens
                },
                timeout=timeout
            )

            # 4xx 是永久性错误（如请求体过大），立即抛出不重试
            if 400 <= resp.status_code < 500:
                resp.raise_for_status()

            resp.raise_for_status()
            data = resp.json()

            if "choices" not in data:
                raise ValueError(f"Invalid response: {data}")

            content = data["choices"][0]["message"]["content"]
            tokens  = data.get("usage", {}).get("total_tokens", 0)

            # ── 写入 Redis 缓存 ───────────────────────────
            try:
                set_llm_cache(prompt, max_tokens, content, tokens)
            except Exception:
                pass

            return content, tokens

        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response is not None else 0
            if 400 <= status < 500:
                raise RuntimeError(f"LLM 调用失败: {e}") from None
            if attempt < MAX_LLM_RETRIES - 1:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"LLM 调用失败（已重试{MAX_LLM_RETRIES}次）: {e}") from None

        except requests.exceptions.RequestException as e:
            if attempt < MAX_LLM_RETRIES - 1:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"LLM 调用失败（已重试{MAX_LLM_RETRIES}次）: {e}") from None


# 向后兼容别名
call_local_llm = call_llm
