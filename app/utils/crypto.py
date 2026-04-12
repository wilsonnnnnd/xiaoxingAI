import base64
import hashlib
import os
from dataclasses import dataclass

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

import os


@dataclass(frozen=True)
class EncryptedBlob:
    ciphertext: bytes
    nonce: bytes
    sha256: bytes
    key_id: str


def _load_key() -> tuple[bytes, str]:
    key_b64 = os.environ.get("OUTGOING_EMAIL_ENCRYPTION_KEY", "").strip()
    if not key_b64:
        raise ValueError("OUTGOING_EMAIL_ENCRYPTION_KEY is not configured")
    key = base64.b64decode(key_b64)
    if len(key) != 32:
        raise ValueError("OUTGOING_EMAIL_ENCRYPTION_KEY must be base64 for 32 bytes")
    return key, "v1"


def encrypt_draft_body(*, plaintext: str, user_id: int, draft_id: int) -> EncryptedBlob:
    key, key_id = _load_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    aad = f"{user_id}:{draft_id}".encode("utf-8")
    pt = plaintext.encode("utf-8")
    sha256 = hashlib.sha256(pt).digest()
    ciphertext = aesgcm.encrypt(nonce, pt, aad)
    return EncryptedBlob(ciphertext=ciphertext, nonce=nonce, sha256=sha256, key_id=key_id)


def decrypt_draft_body(*, ciphertext: bytes, nonce: bytes, user_id: int, draft_id: int) -> str:
    key, _ = _load_key()
    aesgcm = AESGCM(key)
    aad = f"{user_id}:{draft_id}".encode("utf-8")
    pt = aesgcm.decrypt(nonce, ciphertext, aad)
    return pt.decode("utf-8", errors="replace")
