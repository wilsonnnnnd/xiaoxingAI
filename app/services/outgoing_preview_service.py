from typing import Any, Dict, Optional

from app import db
from app.core.telegram.client import send_message
from app.utils.callback_signer import build_callback_data


def send_outgoing_preview(
    *,
    draft_id: int,
    user_id: int,
    bot_id: int,
    chat_id: str,
    token: str,
    text: str,
    expires_at,
    nonce: str,
    source: str,
    record_action: bool = False,
    action_meta: Optional[dict] = None,
    cache_payload: Optional[dict] = None,
) -> int:
    cb_confirm = build_callback_data(
        action="c",
        draft_id=int(draft_id),
        expires_at=expires_at,
        nonce=str(nonce),
        user_id=int(user_id),
        chat_id=str(chat_id),
        bot_id=int(bot_id),
    )
    cb_cancel = build_callback_data(
        action="x",
        draft_id=int(draft_id),
        expires_at=expires_at,
        nonce=str(nonce),
        user_id=int(user_id),
        chat_id=str(chat_id),
        bot_id=int(bot_id),
    )
    reply_markup = {
        "inline_keyboard": [
            [{"text": "✅ Confirm", "callback_data": cb_confirm}, {"text": "❌ Cancel", "callback_data": cb_cancel}]
        ]
    }

    resp = send_message(
        text,
        chat_id=str(chat_id),
        token=str(token),
        parse_mode="HTML",
        reply_markup=reply_markup,
    )
    message_id = int(resp.get("result", {}).get("message_id") or 0)
    if message_id:
        db.set_preview_delivery(
            draft_id=int(draft_id),
            user_id=int(user_id),
            telegram_bot_id=int(bot_id),
            telegram_chat_id=str(chat_id),
            telegram_message_id=int(message_id),
        )
        if cache_payload is not None:
            try:
                from app.core import redis_client as rc

                payload = dict(cache_payload)
                payload["message_id"] = int(message_id)
                rc.set_tg_message_cache(
                    bot_id=int(bot_id),
                    chat_id=str(chat_id),
                    message_id=int(message_id),
                    payload=payload,
                )
            except Exception:
                pass
        if record_action:
            meta = dict(action_meta or {})
            meta.update({"bot_id": int(bot_id), "message_id": int(message_id)})
            db.insert_action(
                draft_id=int(draft_id),
                user_id=int(user_id),
                action="preview_sent",
                actor_type="system",
                source=source,
                result="ok",
                meta=meta,
            )
    return int(message_id)
