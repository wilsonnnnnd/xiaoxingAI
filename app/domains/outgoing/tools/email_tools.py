import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from app import db
from app.core import config
from app.core.llm import call_llm
from app.core.debug.outgoing_debug import record as record_outgoing_event
from app.core.step_log import write_step_log
from app.domains.telegram.client import edit_message_text
from app.domains.outgoing.draft_sender import send_outgoing_draft
from app.domains.outgoing.preview_service import send_outgoing_preview
from app.utils.callback_signer import build_callback_data
from app.utils.crypto import decrypt_draft_body, encrypt_draft_body
from app.utils.outgoing_json import extract_json_from_llm
from app.utils.outgoing_placeholders import fill_sender_name, resolve_sender_name
from app.utils.prompt_loader import load_prompt
from app.utils.reply_format import apply_reply_format, strip_reply_footer


def _extract_int(message: str, key: str) -> int | None:
    m = re.search(rf"{re.escape(key)}=(\d+)", message)
    return int(m.group(1)) if m else None


def _extract_str(message: str, key: str) -> str | None:
    m = re.search(rf"{re.escape(key)}=([^\s]+)", message)
    return m.group(1) if m else None


def _email_from_sender(sender: str) -> str:
    m = re.search(r"<([^>]+@[^>]+)>", sender or "")
    if m:
        return m.group(1).strip()
    m = re.search(r"([^\s]+@[^\s]+\.[^\s]+)", sender or "")
    return m.group(1).strip() if m else ""


def _preview_text(*, to_email: str, subject: str, body: str) -> str:
    snippet = body[:1400] + ("…" if len(body) > 1400 else "")
    return (
        "<b>Email Draft Preview</b>\n"
        f"To: <code>{to_email}</code>\n"
        f"Subject: <b>{subject}</b>\n\n"
        f"<pre>{snippet}</pre>\n\n"
        "Reply to this message:\n"
        "- Reply with 'confirm' or 'send' to send\n"
        "- Reply with 'cancel' to cancel\n"
        "- Any other text will be treated as an edit instruction and regenerate the draft"
    )


def _wlog(*, user_id: int, msg: str, level: str = "info", tokens: int = 0) -> None:
    write_step_log(msg=msg, level=level, tokens=tokens, user_id=user_id, log_type=db.LogType.EMAIL)


def reply_email(message: str, user_id: int | None = None) -> str:
    if user_id is None:
        return "Not logged in."
    bot_id = _extract_int(message, "__bot_id__")
    chat_id = _extract_str(message, "__chat_id__")
    email_id = _extract_str(message, "__email_id__")
    tg_update_id = _extract_int(message, "__tg_update_id__")
    if not bot_id or not chat_id or not email_id:
        return "Missing required fields: bot_id, chat_id, email_id"

    record = db.get_email_record(email_id, user_id=user_id)
    if not record or not str(record.get("body") or "").strip():
        try:
            from app.domains.gmail.client import fetch_email_by_id

            msg = fetch_email_by_id(str(email_id), user_id=int(user_id))
            record = {
                "sender": msg.get("from", ""),
                "subject": msg.get("subject", ""),
                "date": msg.get("date", ""),
                "body": msg.get("body") or msg.get("snippet") or "",
            }
        except Exception:
            return "No corresponding email record found (and unable to retrieve the original text from Gmail), therefore a draft reply could not be generated."

    user_reply = ""
    m = re.search(r"User reply intent:\s*(.*)$", message, re.DOTALL)
    if m:
        user_reply = m.group(1).strip()
    else:
        user_reply = message.strip()

    record_outgoing_event(
        {
            "type": "reply_email_intent",
            "user_id": int(user_id),
            "update_id": int(tg_update_id) if tg_update_id is not None else None,
            "email_id": str(email_id),
            "reply": user_reply[:500],
            "email": {
                "sender": str(record.get("sender") or ""),
                "subject": str(record.get("subject") or ""),
                "date": str(record.get("date") or ""),
                "body_preview": str(record.get("body") or "")[:400],
            },
        }
    )

    _wlog(user_id=int(user_id), msg=f"[reply_email] start | email_id={email_id}")

    to_email = _email_from_sender(record.get("sender") or "")
    if not to_email:
        return "Failed to parse recipient email from sender."

    now = datetime.now(tz=timezone.utc)
    ttl_minutes = int(getattr(config, "OUTGOING_DRAFT_TTL_MINUTES", 30) or 30)
    expires_at = now + timedelta(minutes=ttl_minutes)
    callback_nonce = secrets.token_urlsafe(9)[:12]
    idem = secrets.token_urlsafe(24)[:32]

    base_subject = str(record.get("subject") or "").strip()
    subject = base_subject if base_subject.lower().startswith("re:") else f"Re: {base_subject}" if base_subject else "Re:"

    draft_id = db.create_draft_stub(
        user_id=int(user_id),
        to_email=to_email,
        subject=subject,
        body_format="plain",
        idempotency_key=idem,
        expires_at=expires_at,
        prompt_snapshot={"prompt": "outgoing/email_reply_compose.txt", "email_id": email_id},
        llm_tokens=0,
        telegram_bot_id=int(bot_id),
        telegram_chat_id=str(chat_id),
        callback_nonce=callback_nonce,
    )

    try:
        tpl = load_prompt("outgoing/email_reply_compose.txt", user_id=int(user_id))
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=f"Prompt template not found: {e}")

    prompt = (
        tpl.replace("{{from}}", str(record.get("sender") or ""))
        .replace("{{subject}}", str(record.get("subject") or ""))
        .replace("{{date}}", str(record.get("date") or ""))
        .replace("{{body}}", str(record.get("body") or "")[:2000])
        .replace("{{user_reply}}", user_reply)
    )

    content, tokens = call_llm(
        prompt,
        max_tokens=800,
        use_cache=False,
        user_id=int(user_id) if user_id is not None else None,
        purpose="reply_email_compose",
        source="outgoing",
    )
    data = extract_json_from_llm(content)
    new_subject = (data.get("subject") or "").strip() or subject
    body_plain = (data.get("body_plain") or "").strip()
    if not body_plain:
        return "AI output format error, draft reply could not be generated."

    sender_name = resolve_sender_name(user_id=int(user_id))

    settings = db.get_reply_format_settings(int(user_id))
    signature = str(settings.get("signature") or "")
    template = None
    default_template_id = settings.get("default_template_id")
    if default_template_id is not None:
        template = db.get_reply_template(int(default_template_id), int(user_id))
    if template is None:
        tpls = db.list_reply_templates(int(user_id))
        for t in tpls:
            if bool(t.get("is_default")):
                template = t
                break

    body_plain = apply_reply_format(
        content=strip_reply_footer(
            content=body_plain,
            signature=signature,
            closing=str(template.get("closing")) if template and template.get("closing") is not None else None,
        ),
        body_template=str(template.get("body_template")) if template else None,
        signature=signature,
        closing=str(template.get("closing")) if template and template.get("closing") is not None else None,
    )
    body_plain = fill_sender_name(body_plain, sender_name=sender_name)

    blob = encrypt_draft_body(plaintext=body_plain, user_id=int(user_id), draft_id=int(draft_id))
    db.set_draft_body_encrypted(
        draft_id=int(draft_id),
        user_id=int(user_id),
        ciphertext=blob.ciphertext,
        nonce=blob.nonce,
        key_id=blob.key_id,
        sha256=blob.sha256,
    )
    db.insert_action(
        draft_id=int(draft_id),
        user_id=int(user_id),
        action="compose_reply",
        actor_type="user",
        source="telegram_message",
        result="ok",
        meta={"email_id": email_id, "tokens": int(tokens or 0)},
    )

    _wlog(user_id=int(user_id), msg=f"[reply_email] draft#{draft_id} generated", tokens=int(tokens or 0))
    record_outgoing_event(
        {
            "type": "reply_email_draft_generated",
            "user_id": int(user_id),
            "update_id": int(tg_update_id) if tg_update_id is not None else None,
            "email_id": str(email_id),
            "draft_id": int(draft_id),
            "to_email": to_email,
            "subject": new_subject,
            "body_preview": body_plain[:400],
            "tokens": int(tokens or 0),
        }
    )

    bot = db.get_bot(int(bot_id))
    if not bot or not bot.get("token"):
        return "Bot does not exist or token is missing."

    msg_id = send_outgoing_preview(
        draft_id=int(draft_id),
        user_id=int(user_id),
        bot_id=int(bot_id),
        chat_id=str(chat_id),
        token=str(bot["token"]),
        text=_preview_text(to_email=to_email, subject=new_subject, body=body_plain),
        expires_at=expires_at,
        nonce=str(callback_nonce),
        source="telegram_message",
        record_action=False,
    )

    _wlog(user_id=int(user_id), msg=f"[reply_email] preview sent | draft#{draft_id}")
    if msg_id:
        record_outgoing_event(
            {
                "type": "reply_email_preview_sent",
                "user_id": int(user_id),
                "update_id": int(tg_update_id) if tg_update_id is not None else None,
                "email_id": str(email_id),
                "draft_id": int(draft_id),
                "preview_message_id": int(msg_id),
                "bot_id": int(bot_id),
                "chat_id": str(chat_id),
            }
        )

    return "Draft reply generated. Please confirm in the preview message."


def outgoing_draft_confirm(message: str, user_id: int | None = None) -> str:
    if user_id is None:
        return "Not logged in."
    draft_id = _extract_int(message, "__draft_id__")
    update_id = _extract_int(message, "__tg_update_id__")
    if not draft_id:
        return ""
    draft = db.get_draft(draft_id=int(draft_id), user_id=int(user_id))
    if not draft:
        return "Draft does not exist."

    if draft.get("expires_at") and datetime.now(tz=timezone.utc) > draft["expires_at"]:
        db.update_draft_status(
            draft_id=int(draft_id),
            user_id=int(user_id),
            from_statuses=("pending",),
            to_status="expired",
        )
        _wlog(user_id=int(user_id), msg=f"[outgoing] draft#{draft_id} expired", level="warn")
        return "Draft expired."

    telegram_update_id = f"tgmsg:{update_id}:confirm" if update_id else None
    inserted = db.insert_action(
        draft_id=int(draft_id),
        user_id=int(user_id),
        action="confirm",
        actor_type="user",
        source="telegram_message",
        telegram_update_id=telegram_update_id,
        result="ok",
    )
    if telegram_update_id and not inserted:
        return "Confirmed."

    db.confirm_draft(draft_id=int(draft_id), user_id=int(user_id))
    if not db.start_sending(draft_id=int(draft_id), user_id=int(user_id)):
        return "Confirmed."

    _wlog(user_id=int(user_id), msg=f"[outgoing] draft#{draft_id} sending")

    ok, gmail_message_id, err = send_outgoing_draft(draft=draft, source="telegram_message")
    if ok and gmail_message_id:
        _wlog(user_id=int(user_id), msg=f"[outgoing] draft#{draft_id} sent | gmail_id={gmail_message_id}")
        return "Email sent."

    _wlog(user_id=int(user_id), msg=f"[outgoing] draft#{draft_id} send_failed", level="error")
    return "Email failed, please try again or click Resend."


def outgoing_draft_cancel(message: str, user_id: int | None = None) -> str:
    if user_id is None:
        return "Not logged in."
    draft_id = _extract_int(message, "__draft_id__")
    update_id = _extract_int(message, "__tg_update_id__")
    if not draft_id:
        return ""
    telegram_update_id = f"tgmsg:{update_id}:cancel" if update_id else None
    inserted = db.insert_action(
        draft_id=int(draft_id),
        user_id=int(user_id),
        action="cancel",
        actor_type="user",
        source="telegram_message",
        telegram_update_id=telegram_update_id,
        result="ok",
    )
    if telegram_update_id and not inserted:
        return "Processed."
    changed = db.cancel_draft(draft_id=int(draft_id), user_id=int(user_id))
    _wlog(user_id=int(user_id), msg=f"[outgoing] draft#{draft_id} cancelled")
    return "Cancelled." if changed else "Cancelled (status changed)."


def outgoing_draft_modify(message: str, user_id: int | None = None) -> str:
    if user_id is None:
        return "[Not logged in."
    draft_id = _extract_int(message, "__draft_id__")
    instruction = _extract_str(message, "__instruction__")
    if not draft_id:
        return ""
    draft = db.get_draft(draft_id=int(draft_id), user_id=int(user_id))
    if not draft:
        return "Draft does not exist."
    if str(draft.get("status")) != "pending":
        return "Current draft does not support modification."

    _wlog(user_id=int(user_id), msg=f"[outgoing] draft#{draft_id} modify")

    raw_instruction = (instruction or "").strip()
    if not raw_instruction:
        raw_instruction = re.sub(r".*__draft_id__=\d+\s*", "", message, flags=re.DOTALL).strip()
    if not raw_instruction:
        return "No modification content provided."

    if re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", raw_instruction):
        db.update_draft_recipient(draft_id=int(draft_id), user_id=int(user_id), to_email=raw_instruction)
        db.insert_action(
            draft_id=int(draft_id),
            user_id=int(user_id),
            action="update_recipient",
            actor_type="user",
            source="telegram_message",
            result="ok",
            meta={"to_email": raw_instruction},
        )
        _wlog(user_id=int(user_id), msg=f"[outgoing] draft#{draft_id} to_email updated")
        return f"Recipient updated to {raw_instruction}"

    settings = db.get_reply_format_settings(int(user_id))
    signature = str(settings.get("signature") or "")
    template = None
    default_template_id = settings.get("default_template_id")
    if default_template_id is not None:
        template = db.get_reply_template(int(default_template_id), int(user_id))
    if template is None:
        tpls = db.list_reply_templates(int(user_id))
        for t in tpls:
            if bool(t.get("is_default")):
                template = t
                break
    closing = str(template.get("closing")) if template and template.get("closing") is not None else None

    body_plain = decrypt_draft_body(
        ciphertext=draft["body_ciphertext"],
        nonce=draft["body_nonce"],
        user_id=int(user_id),
        draft_id=int(draft_id),
    )
    body_plain_core = strip_reply_footer(content=body_plain, signature=signature, closing=closing)
    tpl = load_prompt("outgoing/email_edit.txt", user_id=int(user_id))
    prompt = (
        tpl.replace("{{to_email}}", str(draft.get("to_email") or ""))
        .replace("{{subject}}", str(draft.get("subject") or ""))
        .replace("{{body}}", body_plain_core[:2000])
        .replace("{{instruction}}", raw_instruction)
    )
    content, _ = call_llm(
        prompt,
        max_tokens=800,
        use_cache=False,
        user_id=int(user_id) if user_id is not None else None,
        purpose="outgoing_modify",
        source="outgoing",
    )
    data = extract_json_from_llm(content)
    new_subject = (data.get("subject") or "").strip() or str(draft.get("subject") or "")
    new_body = (data.get("body_plain") or "").strip()
    if not new_body:
        return "AI output format error, cannot modify draft."

    sender_name = resolve_sender_name(user_id=int(user_id))

    new_body = apply_reply_format(
        content=strip_reply_footer(content=new_body, signature=signature, closing=closing),
        body_template=str(template.get("body_template")) if template else None,
        signature=signature,
        closing=closing,
    )
    new_body = fill_sender_name(new_body, sender_name=sender_name)

    blob = encrypt_draft_body(plaintext=new_body, user_id=int(user_id), draft_id=int(draft_id))
    db.set_draft_body_encrypted(
        draft_id=int(draft_id),
        user_id=int(user_id),
        ciphertext=blob.ciphertext,
        nonce=blob.nonce,
        key_id=blob.key_id,
        sha256=blob.sha256,
    )
    try:
        from app.db.repositories.outgoing_email_repo import update_draft_subject

        update_draft_subject(draft_id=int(draft_id), user_id=int(user_id), subject=new_subject)
    except Exception:
        pass
    db.insert_action(
        draft_id=int(draft_id),
        user_id=int(user_id),
        action="modify",
        actor_type="user",
        source="telegram_message",
        result="ok",
    )

    _wlog(user_id=int(user_id), msg=f"[outgoing] draft#{draft_id} updated")

    bot_id = int(draft.get("telegram_bot_id") or 0)
    chat_id = str(draft.get("telegram_chat_id") or "")
    msg_id = int(draft.get("telegram_message_id") or 0)
    bot = db.get_bot(bot_id) if bot_id else None
    if bot and bot.get("token") and chat_id and msg_id and draft.get("expires_at") and draft.get("callback_nonce"):
        expires_at = draft["expires_at"]
        cb_confirm = build_callback_data(
            action="c",
            draft_id=int(draft_id),
            expires_at=expires_at,
            nonce=str(draft["callback_nonce"]),
            user_id=int(user_id),
            chat_id=str(chat_id),
            bot_id=int(bot_id),
        )
        cb_cancel = build_callback_data(
            action="x",
            draft_id=int(draft_id),
            expires_at=expires_at,
            nonce=str(draft["callback_nonce"]),
            user_id=int(user_id),
            chat_id=str(chat_id),
            bot_id=int(bot_id),
        )
        reply_markup = {"inline_keyboard": [[{"text": "Confirm", "callback_data": cb_confirm}, {"text": "Cancel", "callback_data": cb_cancel}]]}
        try:
            edit_message_text(
                chat_id=chat_id,
                message_id=msg_id,
                text=_preview_text(to_email=str(draft.get("to_email") or ""), subject=new_subject, body=new_body),
                token=str(bot["token"]),
                parse_mode="HTML",
                reply_markup=reply_markup,
            )
        except Exception:
            pass

    return "Draft preview updated."
