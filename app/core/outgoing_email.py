from __future__ import annotations

from enum import Enum


class OutgoingDraftStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SENDING = "sending"
    SENT = "sent"
    FAILED = "failed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


_ALLOWED_TRANSITIONS: dict[OutgoingDraftStatus, set[OutgoingDraftStatus]] = {
    OutgoingDraftStatus.PENDING: {OutgoingDraftStatus.CONFIRMED, OutgoingDraftStatus.CANCELLED, OutgoingDraftStatus.EXPIRED},
    OutgoingDraftStatus.CONFIRMED: {OutgoingDraftStatus.SENDING},
    OutgoingDraftStatus.SENDING: {OutgoingDraftStatus.SENT, OutgoingDraftStatus.FAILED},
    OutgoingDraftStatus.FAILED: {OutgoingDraftStatus.SENDING},
    OutgoingDraftStatus.SENT: set(),
    OutgoingDraftStatus.CANCELLED: set(),
    OutgoingDraftStatus.EXPIRED: set(),
}


def is_valid_transition(frm: str, to: str) -> bool:
    try:
        f = OutgoingDraftStatus(frm)
        t = OutgoingDraftStatus(to)
    except Exception:
        return False
    return t in _ALLOWED_TRANSITIONS.get(f, set())

