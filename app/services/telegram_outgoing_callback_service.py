from datetime import datetime, timezone

from app import db
from app.core.telegram.client import send_message
from app.utils.callback_signer import parse_callback_data, verify_callback_data
from app.utils.callback_signer import build_callback_data
from app.services.outgoing_draft_sender import send_outgoing_draft


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
            return "⚠️ 无效操作。"

        draft = db.get_draft_any(draft_id=int(parsed.draft_id))
        if not draft:
            return "⚠️ 草稿不存在或已被删除。"

        if str(draft.get("telegram_chat_id") or "") != str(chat_id):
            return "⚠️ 未授权的会话。"
        if int(draft.get("telegram_bot_id") or 0) != int(bot_id):
            return "⚠️ 未授权的 Bot。"

        if str(draft.get("callback_nonce") or "") != str(parsed.nonce):
            return "⚠️ 操作已失效。"

        expires_at = draft.get("expires_at")
        if not expires_at:
            return "⚠️ 操作已失效。"

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
            return "⚠️ 操作校验失败。"

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
            return "✅ 已处理。"

        if parsed.action == "c":
            changed = db.confirm_draft(draft_id=int(draft["id"]), user_id=int(draft["user_id"]))
            if not changed and str(draft.get("status")) in ("sent", "sending"):
                return "✅ 已发送或正在发送。"

            sending = db.start_sending(draft_id=int(draft["id"]), user_id=int(draft["user_id"]))
            if not sending:
                return "✅ 已确认（重复点击无效）。"

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
                return "✅ 已发送邮件。"

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
                    reply_markup = {
                        "inline_keyboard": [[{"text": "🔁 Resend", "callback_data": cb_resend}]]
                    }
                    send_message(
                        "⚠️ 邮件发送失败。你可以点击下方按钮重新发送。",
                        chat_id=str(chat_id),
                        token=str(bot["token"]),
                        parse_mode=None,
                        reply_markup=reply_markup,
                    )
            except Exception:
                pass
            return "⚠️ 发送失败，稍后可点击 Resend 重试。"

        if parsed.action == "x":
            changed = db.cancel_draft(draft_id=int(draft["id"]), user_id=int(draft["user_id"]))
            return "❌ 已取消，本次不会发送邮件。" if changed else "❌ 已取消（重复点击无效）。"

        if parsed.action == "r":
            if str(draft.get("status")) != "failed":
                return "ℹ️ 当前无需重试。"
            sending = db.start_sending(draft_id=int(draft["id"]), user_id=int(draft["user_id"]))
            if not sending:
                return "ℹ️ 正在发送或状态已变化。"
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
                return "✅ 已重新发送邮件。"
            except Exception:
                return "⚠️ 重新发送失败，请稍后再试。"

        return "ℹ️ 当前暂不支持此操作。"

