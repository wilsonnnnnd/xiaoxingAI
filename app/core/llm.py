"""
LLM transport layer.

Supports local OpenAI-compatible endpoints and hosted providers. When a call
returns usage metadata, we persist an append-only analytics record for admin
dashboard reporting. Analytics failures never break the main request path.
"""
import hashlib
import json
import logging
import time
from typing import Any

import requests

from app import db
from app.core import config
from app.core.ai_usage import (
    detect_provider,
    estimate_usage_cost_usd,
    normalize_usage_tokens,
    utc_now,
)

logger = logging.getLogger("llm")
MAX_LLM_RETRIES = 2


def _normalize_chat_completions_url(url: str) -> str:
    u = (url or "").strip()
    while u and u[0] in {"`", '"', "'"} and u[-1] == u[0]:
        u = u[1:-1].strip()
    u = u.strip("`").strip()
    if not u:
        return u
    u = u.rstrip("/")
    if "/chat/completions" in u:
        return u
    return f"{u}/chat/completions"


def _api_key_fingerprint(api_key: str) -> str:
    k = (api_key or "").strip()
    if not k:
        return "none"
    h = hashlib.sha256(k.encode("utf-8")).hexdigest()[:10]
    return f"sha256:{h}"


def _record_ai_usage(
    *,
    user_id: int | None,
    url: str,
    source: str,
    purpose: str,
    model_name: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
) -> None:
    if total_tokens <= 0 and prompt_tokens <= 0 and completion_tokens <= 0 and not str(model_name or "").strip():
        return

    try:
        db.insert_ai_usage(
            user_id=user_id,
            recorded_at=utc_now(),
            provider=detect_provider(url=url, explicit_backend=config.LLM_BACKEND),
            source=source,
            purpose=purpose or "unspecified",
            model_name=model_name or "unknown",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=estimate_usage_cost_usd(
                model_name=model_name,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
            ),
        )
    except Exception as exc:
        logger.warning("[llm] ai usage analytics write failed: %s", exc)


def call_llm(
    prompt: str = "",
    max_tokens: int = 512,
    use_cache: bool = True,
    messages: list[dict[str, Any]] | None = None,
    *,
    user_id: int | None = None,
    purpose: str = "main",
    source: str = "main",
) -> tuple:
    main_key = config.LLM_API_KEY or config.OPENAI_API_KEY
    main_key_src = "LLM_API_KEY" if config.LLM_API_KEY else ("OPENAI_API_KEY" if config.OPENAI_API_KEY else "none")
    return _call(
        config.LLM_API_URL,
        config.LLM_MODEL,
        prompt,
        max_tokens,
        use_cache=use_cache,
        api_key=main_key,
        purpose=purpose,
        source=source,
        api_key_source=main_key_src,
        messages=messages,
        user_id=user_id,
    )


def call_router(
    prompt: str,
    max_tokens: int = 64,
    *,
    user_id: int | None = None,
    purpose: str = "router",
    source: str = "router",
) -> tuple:
    url = config.ROUTER_API_URL or config.LLM_API_URL
    model = config.ROUTER_MODEL or config.LLM_MODEL
    router_key = config.ROUTER_API_KEY or config.LLM_API_KEY or config.OPENAI_API_KEY
    router_key_src = "ROUTER_API_KEY" if config.ROUTER_API_KEY else ("LLM_API_KEY" if config.LLM_API_KEY else ("OPENAI_API_KEY" if config.OPENAI_API_KEY else "none"))
    return _call(
        url,
        model,
        prompt,
        max_tokens,
        use_cache=False,
        api_key=router_key,
        purpose=purpose,
        source=source,
        api_key_source=router_key_src,
        user_id=user_id,
    )


def _call(
    url: str,
    model: str,
    prompt: str,
    max_tokens: int,
    *,
    use_cache: bool = True,
    api_key: str = "",
    purpose: str = "",
    source: str = "",
    api_key_source: str = "",
    messages: list[dict[str, Any]] | None = None,
    user_id: int | None = None,
) -> tuple:
    cache_key_text = prompt
    if messages is not None and not cache_key_text:
        try:
            cache_key_text = json.dumps(messages, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        except Exception:
            cache_key_text = str(messages)

    if use_cache:
        try:
            from app.core.redis_client import get_llm_cache, set_llm_cache

            cached = get_llm_cache(cache_key_text, max_tokens)
            if cached is not None:
                logger.debug("[llm] cache hit | model=%s tokens=%d", model, cached[1])
                return cached
        except Exception:
            pass

    timeout = 120
    raw_url = url
    url = _normalize_chat_completions_url(url)
    if raw_url and url != raw_url:
        logger.info("[llm] normalize url | %s -> %s", raw_url, url)
    logger.info(
        "[llm] request | purpose=%s source=%s model=%s url=%s key=%s keysrc=%s user=%s",
        purpose or "-",
        source or "-",
        model,
        url,
        _api_key_fingerprint(api_key),
        api_key_source or "-",
        user_id if user_id is not None else "-",
    )

    for attempt in range(MAX_LLM_RETRIES):
        try:
            t0 = time.perf_counter()
            payload_messages = messages if messages is not None else [{"role": "user", "content": prompt}]
            resp = requests.post(
                url,
                headers={
                    "Content-Type": "application/json",
                    **({"Authorization": f"Bearer {api_key}"} if api_key else {}),
                },
                json={
                    "model": model,
                    "messages": payload_messages,
                    "temperature": 0.2,
                    "max_tokens": max_tokens,
                },
                timeout=timeout,
            )

            try:
                body_text = (resp.text or "").strip()
            except Exception:
                body_text = ""

            if resp.status_code >= 500 and body_text:
                lower = body_text.lower()
                if "exceed_context_size_error" in lower or "maximum context length" in lower or "context length" in lower:
                    body_limit = 4096
                    body_short = body_text[:body_limit]
                    if len(body_text) > body_limit:
                        body_short = body_short + "...(truncated)"
                    ctype = str(resp.headers.get("content-type") or "").strip()
                    logger.error(
                        "[llm] context overflow | purpose=%s model=%s url=%s | status=%s ctype=%s | body=%s",
                        purpose or "-",
                        model,
                        url,
                        resp.status_code,
                        ctype,
                        body_short,
                    )
                    raise RuntimeError("LLM context overflow") from None

            if 400 <= resp.status_code < 500:
                body_limit = 4096
                body_short = body_text[:body_limit]
                if len(body_text) > body_limit:
                    body_short = body_short + "...(truncated)"
                ctype = str(resp.headers.get("content-type") or "").strip()
                logger.error(
                    "[llm] 4xx response | purpose=%s model=%s url=%s | status=%s ctype=%s | body=%s",
                    purpose or "-",
                    model,
                    url,
                    resp.status_code,
                    ctype,
                    body_short,
                )
                resp.raise_for_status()

            resp.raise_for_status()
            data = resp.json()

            if "choices" not in data:
                raise ValueError(f"Invalid response: {data}")

            content = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {}) or {}
            prompt_tokens, completion_tokens, total_tokens = normalize_usage_tokens(
                prompt_tokens=usage.get("prompt_tokens"),
                completion_tokens=usage.get("completion_tokens"),
                total_tokens=usage.get("total_tokens"),
            )
            response_model = str(data.get("model") or model or "").strip()
            ms = (time.perf_counter() - t0) * 1000
            logger.info("[llm] %s | %.0fms | %dt", response_model or model, ms, total_tokens)

            _record_ai_usage(
                user_id=user_id,
                url=url,
                source=source or "main",
                purpose=purpose or "main",
                model_name=response_model or model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
            )

            if use_cache:
                try:
                    set_llm_cache(cache_key_text, max_tokens, content, total_tokens)
                except Exception:
                    pass

            return content, total_tokens

        except requests.exceptions.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else 0
            if 400 <= status < 500:
                logger.error("[llm] 4xx error, not retrying: %s", exc)
                raise RuntimeError(f"LLM request failed: {exc}") from None
            if attempt < MAX_LLM_RETRIES - 1:
                logger.warning("[llm] retry %d (HTTP %d): %s", attempt + 1, status, url)
                time.sleep(2**attempt)
                continue
            logger.error("[llm] failed after %d retries: %s", MAX_LLM_RETRIES, exc)
            raise RuntimeError(f"LLM request failed (retried {MAX_LLM_RETRIES} times): {exc}") from None

        except requests.exceptions.RequestException as exc:
            if attempt < MAX_LLM_RETRIES - 1:
                logger.warning("[llm] retry %d (network error): %s", attempt + 1, exc)
                time.sleep(2**attempt)
                continue
            logger.error("[llm] failed after %d retries: %s", MAX_LLM_RETRIES, exc)
            raise RuntimeError(f"LLM request failed (retried {MAX_LLM_RETRIES} times): {exc}") from None


call_local_llm = call_llm
