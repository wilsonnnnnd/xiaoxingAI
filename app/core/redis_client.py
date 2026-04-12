"""
Redis 工具层 — 四项功能
  1. LLM 结果缓存     llm:cache:<sha256>          TTL 1h
  2. 会话状态持久化   chat:history:<chat_id>      TTL 7d
                       chat:history_today:<chat_id> TTL 25h
  3. 防重复处理       dedup:tg:<update_id>        TTL 10min
  4. 任务队列         queue:chat  (LPUSH / BRPOP)

当 Redis 不可达时，所有操作静默降级（返回 None / False / 空列表），
不影响主流程正常运行。
"""
import hashlib
import json
import logging
from typing import Optional

import redis
import redis.asyncio as aioredis

from app.core import config

logger = logging.getLogger("redis_client")

# ── 连接池（懒初始化） ────────────────────────────────────────────
_sync_pool:  Optional[redis.ConnectionPool]        = None
_async_pool: Optional[aioredis.ConnectionPool]     = None


def _sync() -> Optional[redis.Redis]:
    """返回可用的同步客户端；连接失败时返回 None 并重置连接池以便下次重试。"""
    global _sync_pool
    try:
        if _sync_pool is None:
            _sync_pool = redis.ConnectionPool.from_url(
                config.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
        r = redis.Redis(connection_pool=_sync_pool)
        r.ping()
        return r
    except Exception as e:
        logger.debug(f"[redis] 同步连接不可用（降级）: {e}")
        _sync_pool = None
        return None


def _async() -> Optional[aioredis.Redis]:
    """返回异步客户端实例（连接池懒初始化）；失败时返回 None。"""
    global _async_pool
    try:
        if _async_pool is None:
            _async_pool = aioredis.ConnectionPool.from_url(
                config.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
        return aioredis.Redis(connection_pool=_async_pool)
    except Exception as e:
        logger.debug(f"[redis] 异步连接不可用（降级）: {e}")
        _async_pool = None
        return None


def is_available() -> bool:
    """快速探测 Redis 是否可达。"""
    return _sync() is not None


# ── 1. LLM 结果缓存 ───────────────────────────────────────────────
_LLM_TTL = 3600  # 1 小时


def _llm_key(prompt: str, max_tokens: int) -> str:
    h = hashlib.sha256(f"{prompt}|{max_tokens}".encode()).hexdigest()[:24]
    return f"llm:cache:{h}"


def get_llm_cache(prompt: str, max_tokens: int) -> Optional[tuple]:
    """命中缓存时返回 (reply, tokens)，未命中或出错时返回 None。"""
    r = _sync()
    if r is None:
        return None
    try:
        raw = r.get(_llm_key(prompt, max_tokens))
        if raw:
            data = json.loads(raw)
            return data["reply"], data["tokens"]
    except Exception as e:
        logger.debug(f"[redis] llm cache get 失败: {e}")
    return None


def set_llm_cache(prompt: str, max_tokens: int, reply: str, tokens: int) -> None:
    r = _sync()
    if r is None:
        return
    try:
        r.setex(
            _llm_key(prompt, max_tokens),
            _LLM_TTL,
            json.dumps({"reply": reply, "tokens": tokens}, ensure_ascii=False),
        )
    except Exception as e:
        logger.debug(f"[redis] llm cache set 失败: {e}")


# ── 2. 会话状态持久化 ─────────────────────────────────────────────
_HISTORY_TTL = 7 * 24 * 3600   # 7 天
_TODAY_TTL   = 25 * 3600        # 25 小时（跨天安全余量）


def load_history(bot_id: int) -> list:
    """从 Redis 加载对话窗口历史，不可达则返回空列表。"""
    r = _sync()
    if r is None:
        return []
    try:
        raw = r.get(f"chat:history:{bot_id}")
        return json.loads(raw) if raw else []
    except Exception:
        return []


def save_history(bot_id: int, history: list) -> None:
    r = _sync()
    if r is None:
        return
    try:
        r.setex(
            f"chat:history:{bot_id}",
            _HISTORY_TTL,
            json.dumps(history, ensure_ascii=False),
        )
    except Exception as e:
        logger.debug(f"[redis] save_history 失败: {e}")


def delete_history(bot_id: int) -> None:
    """同时删除该 bot 的窗口历史和今日历史。"""
    r = _sync()
    if r is None:
        return
    try:
        r.delete(f"chat:history:{bot_id}", f"chat:history_today:{bot_id}")
    except Exception:
        pass


def load_history_today(bot_id: int) -> list:
    r = _sync()
    if r is None:
        return []
    try:
        raw = r.get(f"chat:history_today:{bot_id}")
        return json.loads(raw) if raw else []
    except Exception:
        return []


def save_history_today(bot_id: int, history: list) -> None:
    r = _sync()
    if r is None:
        return
    try:
        r.setex(
            f"chat:history_today:{bot_id}",
            _TODAY_TTL,
            json.dumps(history, ensure_ascii=False),
        )
    except Exception as e:
        logger.debug(f"[redis] save_history_today 失败: {e}")


def get_today_bot_ids() -> list:
    """返回 Redis 中所有有今日历史的 bot_id 列表（int）。"""
    r = _sync()
    if r is None:
        return []
    try:
        ids = []
        for k in r.keys("chat:history_today:*"):
            suffix = k.removeprefix("chat:history_today:")
            try:
                ids.append(int(suffix))
            except ValueError:
                pass
        return ids
    except Exception:
        return []


def clear_today_histories() -> None:
    """批量删除全部今日历史键（画像更新后调用）。"""
    r = _sync()
    if r is None:
        return
    try:
        keys = r.keys("chat:history_today:*")
        if keys:
            r.delete(*keys)
    except Exception:
        pass


# ── 3. 防重复处理 ─────────────────────────────────────────────────
_DEDUP_TTL = 600  # 10 分钟


def mark_update(update_id: int) -> bool:
    """
    用 SET NX 标记 update_id 已处理。
    返回 True 表示"首次处理（可继续）"，False 表示"重复，应跳过"。
    Redis 不可达时返回 True（不阻断处理）。
    """
    r = _sync()
    if r is None:
        return True
    try:
        result = r.set(f"dedup:tg:{update_id}", "1", nx=True, ex=_DEDUP_TTL)
        return result is not None   # None = 键已存在 = 重复
    except Exception:
        return True


# ── 4. 任务队列 ───────────────────────────────────────────────────
_QUEUE_KEY = "queue:chat"


_EMAIL_REF_TTL = 2 * 24 * 3600

_TG_MSG_TTL = 2 * 24 * 3600


def set_email_notify_ref(*, bot_id: int, message_id: int, user_id: int, email_id: str) -> None:
    r = _sync()
    if r is None:
        return
    try:
        r.setex(
            f"email:notify:{bot_id}:{message_id}",
            _EMAIL_REF_TTL,
            json.dumps({"user_id": int(user_id), "email_id": str(email_id)}, ensure_ascii=False),
        )
    except Exception:
        return


def get_email_notify_ref(*, bot_id: int, message_id: int) -> Optional[dict]:
    r = _sync()
    if r is None:
        return None
    try:
        raw = r.get(f"email:notify:{int(bot_id)}:{int(message_id)}")
        return json.loads(raw) if raw else None
    except Exception:
        return None


def set_tg_message_cache(*, bot_id: int, chat_id: str, message_id: int, payload: dict) -> None:
    r = _sync()
    if r is None:
        return
    try:
        r.setex(
            f"tg:msg:{bot_id}:{chat_id}:{message_id}",
            _TG_MSG_TTL,
            json.dumps(payload, ensure_ascii=False),
        )
    except Exception:
        return


def get_tg_message_cache(*, bot_id: int, chat_id: str, message_id: int) -> Optional[dict]:
    r = _sync()
    if r is None:
        return None
    try:
        raw = r.get(f"tg:msg:{bot_id}:{chat_id}:{message_id}")
        return json.loads(raw) if raw else None
    except Exception:
        return None


def clear_debug_cache(*, bot_id: int | None = None, chat_id: str | None = None) -> dict:
    r = _sync()
    if r is None:
        return {"ok": False, "deleted": 0}

    patterns: list[str] = [
        "dedup:tg:*",
        "email:notify:*",
        "tg:msg:*",
    ]
    if bot_id is not None and chat_id is not None:
        patterns.append(f"tg:msg:{int(bot_id)}:{chat_id}:*")
        patterns.append(f"email:notify:{int(bot_id)}:*")

    deleted = 0
    for pat in patterns:
        try:
            for k in r.scan_iter(match=pat, count=500):
                try:
                    r.delete(k)
                    deleted += 1
                except Exception:
                    continue
        except Exception:
            continue

    return {"ok": True, "deleted": deleted}


def enqueue(update_id: int, bot_id: int, chat_id: str, text: str,
            from_user: Optional[dict] = None) -> bool:
    """
    将消息入队（LPUSH）。
    返回 True 表示成功，False 表示 Redis 不可达（调用方应降级为直接处理）。
    """
    r = _sync()
    if r is None:
        return False
    try:
        payload = json.dumps(
            {"update_id": update_id, "bot_id": bot_id, "chat_id": chat_id, "text": text,
             "from_user": from_user or {}},
            ensure_ascii=False,
        )
        r.lpush(_QUEUE_KEY, payload)
        return True
    except Exception as e:
        logger.debug(f"[redis] enqueue 失败: {e}")
        return False


async def dequeue(timeout: int = 2) -> Optional[dict]:
    """
    异步 BRPOP，超时或出错返回 None。
    timeout=0 为永久阻塞，不推荐在 while _running 循环中使用。
    """
    r = _async()
    if r is None:
        return None
    try:
        result = await r.brpop(_QUEUE_KEY, timeout=timeout)
        if result:
            _, raw = result
            return json.loads(raw)
    except Exception as e:
        logger.debug(f"[redis] dequeue 失败: {e}")
    return None
