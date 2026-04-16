from typing import Any, Dict, Optional, Tuple

from app import db
from app.skills.gmail.client import send_email_raw
from app.utils.crypto import decrypt_draft_body
from app.utils.email_mime import build_gmail_raw_message
from app.utils.outgoing_placeholders import fill_sender_name, resolve_sender_name


def send_outgoing_draft(
    *,
    draft: Dict[str, Any],
    source: str,
    meta: Optional[dict] = None,
    resend: bool = False,
) -> Tuple[bool, Optional[str], Optional[str]]:
    draft_id = int(draft.get("id") or 0)
    user_id = int(draft.get("user_id") or 0)
    if not draft_id or not user_id:
        return False, None, "draft missing id/user_id"

    if not draft.get("body_ciphertext") or not draft.get("body_nonce"):
        return False, None, "draft body missing"

    try:
        body_plain = decrypt_draft_body(
            ciphertext=draft["body_ciphertext"],
            nonce=draft["body_nonce"],
            user_id=user_id,
            draft_id=draft_id,
        )
        body_plain = fill_sender_name(body_plain, sender_name=resolve_sender_name(user_id=user_id))
        raw = build_gmail_raw_message(
            to_email=str(draft.get("to_email") or ""),
            subject=str(draft.get("subject") or ""),
            body_plain=body_plain,
        )
        resp = send_email_raw(raw=raw, user_id=user_id)
        gmail_message_id = str(resp.get("id") or "")
        if not gmail_message_id:
            raise RuntimeError("missing gmail message id")

        db.set_send_result_success(draft_id=draft_id, user_id=user_id, gmail_message_id=gmail_message_id)
        action_meta = dict(meta or {})
        action_meta["gmail_message_id"] = gmail_message_id
        if resend:
            action_meta["resend"] = True
        db.insert_action(
            draft_id=draft_id,
            user_id=user_id,
            action="send_success",
            actor_type="system",
            source=source,
            result="ok",
            meta=action_meta,
        )
        return True, gmail_message_id, None
    except Exception as e:
        db.set_send_result_failed(
            draft_id=draft_id,
            user_id=user_id,
            error_code="gmail_send_error",
            error_message=str(e)[:400],
        )
        action_meta = dict(meta or {})
        if resend:
            action_meta["resend"] = True
        db.insert_action(
            draft_id=draft_id,
            user_id=user_id,
            action="send_failed",
            actor_type="system",
            source=source,
            result="error",
            error_code="gmail_send_error",
            error_message=str(e)[:400],
            meta=action_meta or None,
        )
        return False, None, str(e)
