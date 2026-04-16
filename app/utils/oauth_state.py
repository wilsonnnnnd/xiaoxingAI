import base64
import hmac
import hashlib
from typing import Optional


def encode_oauth_state(*, user_id: int, secret: str) -> str:
    uid = str(int(user_id))
    mac = hmac.new(secret.encode("utf-8"), uid.encode("utf-8"), hashlib.sha256).digest()
    sig = base64.urlsafe_b64encode(mac[:16]).decode("utf-8").rstrip("=")
    return f"{uid}.{sig}"


def decode_oauth_state(state: str, secret: str) -> Optional[int]:
    s = (state or "").strip()
    if not s:
        return None
    if "." not in s:
        return None
    uid_str, sig = s.split(".", 1)
    try:
        uid = int(uid_str)
    except Exception:
        return None
    expected = encode_oauth_state(user_id=uid, secret=secret)
    _, expected_sig = expected.split(".", 1)
    if not hmac.compare_digest(sig, expected_sig):
        return None
    return uid
