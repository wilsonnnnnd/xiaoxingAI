import base64
import hmac
import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone

import os


_B36 = "0123456789abcdefghijklmnopqrstuvwxyz"


def _b36_encode(n: int) -> str:
    if n < 0:
        raise ValueError("negative")
    if n == 0:
        return "0"
    s = []
    while n:
        n, r = divmod(n, 36)
        s.append(_B36[r])
    return "".join(reversed(s))


def _b36_decode(s: str) -> int:
    if not s:
        raise ValueError("empty")
    n = 0
    for ch in s.lower():
        n = n * 36 + _B36.index(ch)
    return n


def _secret() -> bytes:
    raw = os.environ.get("TELEGRAM_CALLBACK_SECRET", "").strip()
    if not raw:
        raise ValueError("TELEGRAM_CALLBACK_SECRET is not configured")
    return raw.encode("utf-8")


def _sig(payload: str) -> str:
    mac = hmac.new(_secret(), payload.encode("utf-8"), hashlib.sha256).digest()[:9]
    return base64.urlsafe_b64encode(mac).decode("ascii").rstrip("=")


@dataclass(frozen=True)
class CallbackPayload:
    action: str
    draft_id: int
    exp_min: int
    nonce: str
    sig: str


def build_callback_data(
    *,
    action: str,
    draft_id: int,
    expires_at,
    nonce: str,
    user_id: int,
    chat_id: str,
    bot_id: int,
) -> str:
    a = action
    if a not in ("c", "x", "r"):
        raise ValueError("invalid action")

    exp_min = int(int(expires_at.timestamp()) // 60)
    id36 = _b36_encode(int(draft_id))
    e36 = _b36_encode(exp_min)
    n = (nonce or "").strip()
    if not n:
        raise ValueError("nonce required")

    payload = f"{a}.{id36}.{e36}.{n}.{user_id}.{chat_id}.{bot_id}"
    s = _sig(payload)
    return f"od.{a}.{id36}.{e36}.{n}.{s}"


def parse_callback_data(data: str) -> CallbackPayload:
    parts = (data or "").split(".")
    if len(parts) != 6:
        raise ValueError("invalid callback_data")
    if parts[0] != "od":
        raise ValueError("invalid prefix")
    a = parts[1]
    if a not in ("c", "x", "r"):
        raise ValueError("invalid action")
    draft_id = _b36_decode(parts[2])
    exp_min = _b36_decode(parts[3])
    nonce = parts[4]
    sig = parts[5]
    return CallbackPayload(action=a, draft_id=draft_id, exp_min=exp_min, nonce=nonce, sig=sig)


def verify_callback_data(
    *,
    parsed: CallbackPayload,
    user_id: int,
    chat_id: str,
    bot_id: int,
    expires_at,
    now: datetime | None = None,
) -> bool:
    now = now or datetime.now(tz=timezone.utc)
    exp_min_expected = int(int(expires_at.timestamp()) // 60)
    if parsed.exp_min != exp_min_expected:
        return False
    if int(now.timestamp() // 60) > parsed.exp_min:
        return False
    payload = f"{parsed.action}.{_b36_encode(parsed.draft_id)}.{_b36_encode(parsed.exp_min)}.{parsed.nonce}.{user_id}.{chat_id}.{bot_id}"
    expected = _sig(payload)
    return hmac.compare_digest(expected, parsed.sig)

