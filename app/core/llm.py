"""
LLM 传输层 — 核心模块
支持本地 llama-server（OpenAI 兼容接口）和 OpenAI API。
相同 prompt + max_tokens 的结果会缓存到 Redis（TTL 1h），命中时直接返回。
"""
import logging
import time
import hashlib

import requests

from app.core import config

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


def _build_headers() -> dict:
    headers = {"Content-Type": "application/json"}
    api_key = config.LLM_API_KEY or config.OPENAI_API_KEY
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


def call_llm(prompt: str, max_tokens: int = 512) -> tuple:
    """调用主 LLM（chat/email 等场景）。"""
    main_key = config.LLM_API_KEY or config.OPENAI_API_KEY
    main_key_src = "LLM_API_KEY" if config.LLM_API_KEY else ("OPENAI_API_KEY" if config.OPENAI_API_KEY else "none")
    return _call(
        config.LLM_API_URL,
        config.LLM_MODEL,
        prompt,
        max_tokens,
        api_key=main_key,
        purpose="main",
        api_key_source=main_key_src,
    )


def call_router(prompt: str, max_tokens: int = 64) -> tuple:
    """调用 Router 小模型（工具意图识别）。若未配置则回退到主模型。"""
    url = config.ROUTER_API_URL or config.LLM_API_URL
    model = config.ROUTER_MODEL or config.LLM_MODEL
    router_key = config.ROUTER_API_KEY or config.LLM_API_KEY or config.OPENAI_API_KEY
    router_key_src = "ROUTER_API_KEY" if config.ROUTER_API_KEY else ("LLM_API_KEY" if config.LLM_API_KEY else ("OPENAI_API_KEY" if config.OPENAI_API_KEY else "none"))
    return _call(url, model, prompt, max_tokens, use_cache=False, api_key=router_key, purpose="router", api_key_source=router_key_src)


def _call(url: str, model: str, prompt: str, max_tokens: int,
          use_cache: bool = True, api_key: str = "", purpose: str = "", api_key_source: str = "") -> tuple:
    """
    调用指定端点的 LLM。
    - use_cache=True 时优先命中 Redis 缓存（TTL 1h）
    - 4xx 直接抛出，5xx/网络错误最多重试 MAX_LLM_RETRIES 次（指数退避）
    返回 (content_str, token_count)。
    """
    # ── Redis 缓存命中 ────────────────────────────────────
    if use_cache:
        try:
            from app.core.redis_client import get_llm_cache, set_llm_cache
            cached = get_llm_cache(prompt, max_tokens)
            if cached is not None:
                logger.debug(
                    "[llm] cache hit | model=%s tokens=%d", model, cached[1])
                return cached
        except Exception:
            pass  # redis_client 未就绪时不阻断

    timeout = 120
    raw_url = url
    url = _normalize_chat_completions_url(url)
    if raw_url and url != raw_url:
        logger.info("[llm] normalize url | %s -> %s", raw_url, url)
    logger.info(
        "[llm] request | purpose=%s model=%s url=%s key=%s keysrc=%s",
        purpose or "-",
        model,
        url,
        _api_key_fingerprint(api_key),
        api_key_source or "-",
    )

    for attempt in range(MAX_LLM_RETRIES):
        try:
            t0 = time.perf_counter()
            resp = requests.post(
                url,
                headers={"Content-Type": "application/json", **
                         ({"Authorization": f"Bearer {api_key}"} if api_key else {})},
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
            tokens = data.get("usage", {}).get("total_tokens", 0)
            ms = (time.perf_counter() - t0) * 1000
            logger.info("[llm] %s | %.0fms | %dt", model, ms, tokens)

            # ── 写入 Redis 缓存 ───────────────────────────
            if use_cache:
                try:
                    set_llm_cache(prompt, max_tokens, content, tokens)
                except Exception:
                    pass

            return content, tokens

        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response is not None else 0
            if 400 <= status < 500:
                logger.error("[llm] 4xx 错误，不重试: %s", e)
                raise RuntimeError(f"LLM 调用失败: {e}") from None
            if attempt < MAX_LLM_RETRIES - 1:
                logger.warning("[llm] 第%d次重试 (HTTP %d): %s",
                               attempt + 1, status, url)
                time.sleep(2 ** attempt)
                continue
            logger.error("[llm] 已重试%d次仍失败: %s", MAX_LLM_RETRIES, e)
            raise RuntimeError(
                f"LLM 调用失败（已重试{MAX_LLM_RETRIES}次）: {e}") from None

        except requests.exceptions.RequestException as e:
            if attempt < MAX_LLM_RETRIES - 1:
                logger.warning("[llm] 第%d次重试 (网络错误): %s", attempt + 1, e)
                time.sleep(2 ** attempt)
                continue
            logger.error("[llm] 已重试%d次仍失败: %s", MAX_LLM_RETRIES, e)
            raise RuntimeError(
                f"LLM 调用失败（已重试{MAX_LLM_RETRIES}次）: {e}") from None


# 向后兼容别名
call_local_llm = call_llm
