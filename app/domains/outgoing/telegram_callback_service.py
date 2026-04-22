from datetime import datetime, timezone

from app import db
from app.domains.telegram.client import send_message
from app.domains.outgoing.draft_sender import send_outgoing_draft
from app.utils.callback_signer import build_callback_data
from app.utils.callback_signer import parse_callback_data, verify_callback_data


class TelegramOutgoingCallbackService:
    def handle(
        self,
        *,
        bot_id: int,
        chat_id: str,
        callback_query_id: str,
        data: str,
    ) -> str:
        try:
            parsed = parse_callback_data(data)
        except Exception:
            return "Invalid action."

        draft = db.get_draft_any(draft_id=int(parsed.draft_id))
        if not draft:
            return "Draft does not exist or has been deleted."

        if str(draft.get("telegram_chat_id") or "") != str(chat_id):
            return "Unauthorized session."
        if int(draft.get("telegram_bot_id") or 0) != int(bot_id):
            return "Unauthorized bot."

        if str(draft.get("callback_nonce") or "") != str(parsed.nonce):
            return "Action expired."

        expires_at = draft.get("expires_at")
        if not expires_at:
            return "Action expired."

        ok = False
        try:
            ok = verify_callback_data(
                parsed=parsed,
                user_id=int(draft["user_id"]),
                chat_id=str(chat_id),
                bot_id=int(bot_id),
                expires_at=expires_at,
                now=datetime.now(tz=timezone.utc),
            )
        except Exception:
            ok = False

        if not ok:
            return "Action verification failed."

        inserted = db.insert_action(
            draft_id=int(draft["id"]),
            user_id=int(draft["user_id"]),
            action={"c": "confirm", "x": "cancel", "r": "resend"}.get(parsed.action, "unknown"),
            actor_type="user",
            source="telegram_callback",
            telegram_update_id=str(callback_query_id),
            result="ok",
            meta={"bot_id": int(bot_id)},
        )
        if not inserted:
            return "Processed."

        if parsed.action == "c":
            changed = db.confirm_draft(draft_id=int(draft["id"]), user_id=int(draft["user_id"]))
            if not changed and str(draft.get("status")) in ("sent", "sending"):
                return "Already sent or currently sending."

            sending = db.start_sending(draft_id=int(draft["id"]), user_id=int(draft["user_id"]))
            if not sending:
                return "Confirmed (duplicate click ignored)."

            db.insert_action(
                draft_id=int(draft["id"]),
                user_id=int(draft["user_id"]),
                action="send_attempt",
                actor_type="system",
                source="telegram_callback",
                result="ok",
            )
            ok, _, _ = send_outgoing_draft(draft=draft, source="telegram_callback")
            if ok:
                return "Email sent."

            try:
                bot = db.get_bot(int(bot_id))
                if bot and bot.get("token"):
                    cb_resend = build_callback_data(
                        action="r",
                        draft_id=int(draft["id"]),
                        expires_at=expires_at,
                        nonce=str(draft.get("callback_nonce") or parsed.nonce),
                        user_id=int(draft["user_id"]),
                        chat_id=str(chat_id),
                        bot_id=int(bot_id),
                    )
                    reply_markup = {"inline_keyboard": [[{"text": "Resend", "callback_data": cb_resend}]]}
                    send_message(
                        "Email send failed. You can click the button below to resend.",
                        chat_id=str(chat_id),
                        token=str(bot["token"]),
                        parse_mode=None,
                        reply_markup=reply_markup,
                    )
            except Exception:
                pass
            return "Send failed. You can click Resend later to retry."

        if parsed.action == "x":
            changed = db.cancel_draft(draft_id=int(draft["id"]), user_id=int(draft["user_id"]))
            return "Cancelled. This email will not be sent." if changed else "Cancelled (duplicate click ignored)."

        if parsed.action == "r":
            if str(draft.get("status")) != "failed":
                return "Retry not needed."
            sending = db.start_sending(draft_id=int(draft["id"]), user_id=int(draft["user_id"]))
            if not sending:
                return "Sending in progress or status has changed."
            try:
                db.insert_action(
                    draft_id=int(draft["id"]),
                    user_id=int(draft["user_id"]),
                    action="send_attempt",
                    actor_type="system",
                    source="telegram_callback",
                    result="ok",
                    meta={"resend": True},
                )
                ok, _, _ = send_outgoing_draft(draft=draft, source="telegram_callback", resend=True)
                if not ok:
                    raise RuntimeError("send failed")
                return "Email resent."
            except Exception:
                return "Resend failed, please try again later."

        return "This action is not supported."
