import json
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException

from app import db
from app.core import config
from app.core.llm import call_llm
from app.schemas import OutgoingComposeRequest
from app.core.telegram.client import send_message
from app.utils.callback_signer import build_callback_data
from app.utils.crypto import decrypt_draft_body, encrypt_draft_body
from app.utils.outgoing_placeholders import fill_sender_name, resolve_sender_name
from app.utils.prompt_loader import load_prompt


class OutgoingEmailService:
    def _extract_json(self, text: str) -> dict:
        text = text.strip()
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
        text = re.sub(r"\s*```\s*$", "", text, flags=re.MULTILINE)
        text = text.strip()
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            text = text[start : end + 1]
        try:
            val = json.loads(text)
            return val if isinstance(val, dict) else {}
        except Exception:
            return {}

    def _validate_email(self, email: str) -> None:
        s = (email or "").strip()
        if not s or "@" not in s:
            raise HTTPException(status_code=422, detail="to_email 无效")
        local, _, domain = s.partition("@")
        if not local or not domain or "." not in domain:
            raise HTTPException(status_code=422, detail="to_email 无效")

    def compose(self, *, payload: OutgoingComposeRequest, user: Dict[str, Any]) -> dict:
        self._validate_email(payload.to_email)
        topic = (payload.topic or "").strip()
        key_points = (payload.key_points or "").strip()
        if not topic:
            raise HTTPException(status_code=422, detail="topic 不能为空")
        if not key_points:
            raise HTTPException(status_code=422, detail="key_points 不能为空")

        body_format = (payload.body_format or "plain").strip().lower()
        if body_format not in ("plain", "html"):
            raise HTTPException(status_code=422, detail="body_format 必须为 plain 或 html")

        if not config.OUTGOING_EMAIL_ENCRYPTION_KEY:
            raise HTTPException(status_code=500, detail="OUTGOING_EMAIL_ENCRYPTION_KEY 未配置")

        now = datetime.now(tz=timezone.utc)
        ttl_minutes = int(getattr(config, "OUTGOING_DRAFT_TTL_MINUTES", 30) or 30)
        expires_at = now + timedelta(minutes=ttl_minutes)

        idem = (payload.idempotency_key or "").strip()
        if not idem:
            idem = secrets.token_urlsafe(24)[:32]

        callback_nonce = secrets.token_urlsafe(9)[:12]

        draft_id = db.create_draft_stub(
            user_id=int(user["id"]),
            to_email=payload.to_email.strip(),
            subject=topic,
            body_format=body_format,
            idempotency_key=idem,
            expires_at=expires_at,
            prompt_snapshot={
                "tone": (payload.tone or "").strip() or None,
                "language": (payload.language or "").strip() or None,
                "prompt": "outgoing/email_compose.txt",
            },
            llm_tokens=0,
            telegram_bot_id=None,
            telegram_chat_id=None,
            callback_nonce=callback_nonce,
        )

        existing = db.get_draft(draft_id=draft_id, user_id=int(user["id"]))
        if existing and existing.get("body_ciphertext") and existing.get("body_nonce"):
            try:
                body_plain = decrypt_draft_body(
                    ciphertext=existing["body_ciphertext"],
                    nonce=existing["body_nonce"],
                    user_id=int(user["id"]),
                    draft_id=draft_id,
                )
            except Exception:
                raise HTTPException(status_code=500, detail="草稿解密失败")
            return {
                "draft_id": draft_id,
                "to_email": existing["to_email"],
                "subject": existing["subject"],
                "body_format": existing["body_format"],
                "body": body_plain,
                "expires_at": existing["expires_at"].isoformat(),
                "tokens": int(existing.get("llm_tokens") or 0),
            }

        try:
            tpl = load_prompt("outgoing/email_compose.txt")
        except FileNotFoundError as e:
            raise HTTPException(status_code=500, detail=f"提示词模板缺失: {e}")

        prompt = (tpl
            .replace("{{to_email}}", payload.to_email.strip())
            .replace("{{topic}}", topic)
            .replace("{{key_points}}", key_points)
            .replace("{{tone}}", (payload.tone or "").strip() or "专业、礼貌")
            .replace("{{language}}", (payload.language or "").strip() or "中文")
            .replace("{{additional_context}}", (payload.additional_context or "").strip() or "")
        )

        total_tokens = 0
        try:
            content, t = call_llm(prompt, max_tokens=800)
            total_tokens += int(t or 0)
            data = self._extract_json(content)
        except Exception as e:
            db.insert_action(
                draft_id=draft_id,
                user_id=int(user["id"]),
                action="compose",
                actor_type="user",
                source="api",
                result="error",
                error_code="llm_error",
                error_message=str(e)[:400],
                meta={"draft_id": draft_id},
            )
            raise HTTPException(status_code=500, detail=f"AI 生成失败: {str(e)}")

        subject = (data.get("subject") or "").strip() or topic
        body_plain = (data.get("body_plain") or "").strip()
        body_html = (data.get("body_html") or "").strip()

        if not body_plain and body_format == "plain":
            raise HTTPException(status_code=500, detail="AI 输出格式错误")
        if not body_plain and body_html:
            body_plain = re.sub(r"<[^>]+>", "", body_html).strip()
        if not body_plain:
            raise HTTPException(status_code=500, detail="AI 输出格式错误")

        sender_name = resolve_sender_name(user_id=int(user["id"]))
        body_plain = fill_sender_name(body_plain, sender_name=sender_name)
        if body_html:
            body_html = fill_sender_name(body_html, sender_name=sender_name)

        blob = encrypt_draft_body(plaintext=body_plain, user_id=int(user["id"]), draft_id=draft_id)
        db.set_draft_body_encrypted(
            draft_id=draft_id,
            user_id=int(user["id"]),
            ciphertext=blob.ciphertext,
            nonce=blob.nonce,
            key_id=blob.key_id,
            sha256=blob.sha256,
        )
        db.insert_action(
            draft_id=draft_id,
            user_id=int(user["id"]),
            action="compose",
            actor_type="user",
            source="api",
            result="ok",
            meta={"draft_id": draft_id, "body_format": body_format},
        )

        try:
            bot = db.get_default_bot(int(user["id"]))
            if bot and bot.get("chat_id") and bot.get("token") and bot.get("bot_mode") in ("all", "chat"):
                text = (
                    "📧 <b>邮件预览</b>\n"
                    f"To: <code>{payload.to_email.strip()}</code>\n"
                    f"Subject: <b>{subject}</b>\n\n"
                    f"<pre>{(body_plain[:1400] + ('…' if len(body_plain) > 1400 else ''))}</pre>\n\n"
                    "请确认是否发送。\n"
                    "（可回复此消息输入新的收件人邮箱以修改 To）"
                )

                cb_confirm = build_callback_data(
                    action="c",
                    draft_id=draft_id,
                    expires_at=expires_at,
                    nonce=callback_nonce,
                    user_id=int(user["id"]),
                    chat_id=str(bot["chat_id"]),
                    bot_id=int(bot["id"]),
                )
                cb_cancel = build_callback_data(
                    action="x",
                    draft_id=draft_id,
                    expires_at=expires_at,
                    nonce=callback_nonce,
                    user_id=int(user["id"]),
                    chat_id=str(bot["chat_id"]),
                    bot_id=int(bot["id"]),
                )

                reply_markup = {
                    "inline_keyboard": [
                        [
                            {"text": "✅ Confirm", "callback_data": cb_confirm},
                            {"text": "❌ Cancel", "callback_data": cb_cancel},
                        ]
                    ]
                }

                resp = send_message(
                    text,
                    chat_id=str(bot["chat_id"]),
                    token=str(bot["token"]),
                    parse_mode="HTML",
                    reply_markup=reply_markup,
                )
                message_id = int(resp.get("result", {}).get("message_id") or 0)
                if message_id:
                    db.set_preview_delivery(
                        draft_id=draft_id,
                        user_id=int(user["id"]),
                        telegram_bot_id=int(bot["id"]),
                        telegram_chat_id=str(bot["chat_id"]),
                        telegram_message_id=message_id,
                    )
                    try:
                        from app.core import redis_client as rc

                        rc.set_tg_message_cache(
                            bot_id=int(bot["id"]),
                            chat_id=str(bot["chat_id"]),
                            message_id=message_id,
                            payload={
                                "type": "sent",
                                "bot_id": int(bot["id"]),
                                "chat_id": str(bot["chat_id"]),
                                "message_id": message_id,
                                "draft_id": int(draft_id),
                                "text": text[:2000],
                            },
                        )
                    except Exception:
                        pass
                    db.insert_action(
                        draft_id=draft_id,
                        user_id=int(user["id"]),
                        action="preview_sent",
                        actor_type="system",
                        source="api",
                        result="ok",
                        meta={"bot_id": int(bot["id"]), "message_id": message_id},
                    )
        except Exception as e:
            db.insert_action(
                draft_id=draft_id,
                user_id=int(user["id"]),
                action="preview_sent",
                actor_type="system",
                source="api",
                result="error",
                error_code="telegram_error",
                error_message=str(e)[:400],
            )

        return {
            "draft_id": draft_id,
            "to_email": payload.to_email.strip(),
            "subject": subject,
            "body_format": body_format,
            "body": body_plain if body_format == "plain" else (body_html or body_plain),
            "expires_at": expires_at.isoformat(),
            "tokens": total_tokens,
        }
