"""
Redis 工具层
  1. LLM 结果缓存     llm:cache:<sha256>          TTL 1h
  2. 防重复处理       dedup:tg:<update_id>        TTL 10min
  3. 邮件通知引用     email:notify:<bot_id>:<message_id>  TTL 2d
  4. Telegram 消息缓存 tg:msg:<bot_id>:<chat_id>:<message_id> TTL 2d
  5. JWT 吊销版本号   jwt:version:<user_id>

当 Redis 不可达时，所有操作静默降级（返回 None / False / 空列表），
不影响主流程正常运行。
"""
import hashlib
import json
import logging
from typing import Optional

import redis

from app.core import config

logger = logging.getLogger("redis_client")

# ── 连接池（懒初始化） ────────────────────────────────────────────
_sync_pool:  Optional[redis.ConnectionPool]        = None


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


def is_available() -> bool:
    """快速探测 Redis 是否可达。"""
    return _sync() is not None


def incr_with_ttl(key: str, ttl_secs: int) -> Optional[int]:
    r = _sync()
    if r is None:
        return None
    try:
        n = int(r.incr(str(key)))
        if n == 1:
            r.expire(str(key), int(ttl_secs))
        return n
    except Exception:
        return None


def delete_key(key: str) -> None:
    r = _sync()
    if r is None:
        return
    try:
        r.delete(str(key))
    except Exception:
        return


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


# ── 2. JWT 版本号（主动吊销） ─────────────────────────────────────
def get_jwt_version(user_id: int) -> int:
    r = _sync()
    if r is None:
        return 0
    key = f"jwt:version:{int(user_id)}"
    try:
        val = r.get(key)
        if val is None:
            r.set(key, "0")
            return 0
        return int(val)
    except Exception:
        return 0


def bump_jwt_version(user_id: int) -> None:
    r = _sync()
    if r is None:
        return
    key = f"jwt:version:{int(user_id)}"
    try:
        r.incr(key)
    except Exception:
        return


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
