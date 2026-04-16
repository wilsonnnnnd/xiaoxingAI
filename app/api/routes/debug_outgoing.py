import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import db
from app.core.auth import require_admin
from app.core import redis_client as rc
from app.core import telegram_debug, outgoing_debug
from app.utils.crypto import decrypt_draft_body
from app.utils.outgoing_json import extract_json_from_llm
from app.utils.outgoing_placeholders import fill_sender_name, resolve_sender_name
from app.utils.prompt_loader import load_prompt
from app.core.llm import call_llm
from app.utils.reply_format import apply_reply_format


router = APIRouter(dependencies=[Depends(require_admin)])


@router.get("/debug/telegram/events")
def debug_telegram_events(limit: int = 100):
    return {"events": telegram_debug.list_events(limit=limit)}


@router.get("/debug/outgoing/trace")
def debug_outgoing_trace(limit: int = 200):
    return {"events": outgoing_debug.list_events(limit=limit)}


@router.get("/debug/outgoing/actions")
def debug_outgoing_actions(limit: int = 200):
    return {"actions": db.list_outgoing_actions(limit=limit)}


@router.get("/debug/outgoing/drafts")
def debug_outgoing_drafts(limit: int = 30, include_body: bool = True):
    drafts = db.list_outgoing_drafts(limit=limit)
    results: list[Dict[str, Any]] = []
    for d in drafts:
        out = dict(d)
        if include_body:
            try:
                if d.get("body_ciphertext") and d.get("body_nonce"):
                    body_plain = decrypt_draft_body(
                        ciphertext=d["body_ciphertext"],
                        nonce=d["body_nonce"],
                        user_id=int(d["user_id"]),
                        draft_id=int(d["id"]),
                    )
                    out["body_plain"] = body_plain
            except Exception as e:
                out["body_plain_error"] = str(e)[:200]
        results.append(out)
    return {"drafts": results}


@router.get("/debug/telegram/message")
def debug_telegram_message(bot_id: int, chat_id: str, message_id: int):
    cached = rc.get_tg_message_cache(bot_id=int(bot_id), chat_id=str(chat_id), message_id=int(message_id))

    in_memory: Optional[dict] = None
    if cached is None:
        for ev in reversed(telegram_debug.list_events(limit=200)):
            if (
                str(ev.get("bot_id")) == str(bot_id)
                and str(ev.get("chat_id")) == str(chat_id)
                and int(ev.get("message_id") or 0) == int(message_id)
            ):
                in_memory = ev
                break

    ref = rc.get_email_notify_ref(bot_id=int(bot_id), message_id=int(message_id))
    draft = db.get_draft_by_preview_message(
        telegram_bot_id=int(bot_id),
        telegram_chat_id=str(chat_id),
        telegram_message_id=int(message_id),
    )

    return {
        "message": cached or in_memory,
        "email_notify_ref": ref,
        "draft": draft,
    }


class ClearCachePayload(BaseModel):
    bot_id: Optional[int] = None
    chat_id: Optional[str] = None
    clear_traces: bool = False


@router.post("/debug/cache/clear")
def debug_clear_cache(payload: ClearCachePayload):
    res = rc.clear_debug_cache(bot_id=payload.bot_id, chat_id=payload.chat_id)
    cleared = False
    if payload.clear_traces:
        telegram_debug.clear()
        outgoing_debug.clear()
        cleared = True
    return {"redis": res, "cleared_traces": cleared}


class SimulateReplyPayload(BaseModel):
    user_id: int
    email_id: str
    user_reply: str


@router.post("/debug/outgoing/simulate_reply")
def debug_simulate_reply(payload: SimulateReplyPayload):
    record = db.get_email_record(str(payload.email_id), user_id=int(payload.user_id))
    if not record:
        try:
            from app.skills.gmail.client import fetch_email_by_id

            msg = fetch_email_by_id(str(payload.email_id), user_id=int(payload.user_id))
            record = {
                "sender": msg.get("from", ""),
                "subject": msg.get("subject", ""),
                "date": msg.get("date", ""),
                "body": msg.get("body") or msg.get("snippet") or "",
            }
        except Exception:
            raise HTTPException(status_code=404, detail="未找到对应邮件记录")

    tpl = load_prompt("outgoing/email_reply_compose.txt")
    prompt = (
        tpl.replace("{{from}}", str(record.get("sender") or ""))
        .replace("{{subject}}", str(record.get("subject") or ""))
        .replace("{{date}}", str(record.get("date") or ""))
        .replace("{{body}}", str(record.get("body") or "")[:2000])
        .replace("{{user_reply}}", str(payload.user_reply or "").strip())
    )

    content, tokens = call_llm(prompt, max_tokens=800)
    data = extract_json_from_llm(content)
    base_subject = str(record.get("subject") or "").strip()
    default_subject = base_subject if base_subject.lower().startswith("re:") else f"Re: {base_subject}" if base_subject else "Re:"
    new_subject = (data.get("subject") or "").strip() or default_subject
    body_plain = (data.get("body_plain") or "").strip()
    if not body_plain:
        raise HTTPException(status_code=500, detail="AI 输出格式错误")

    settings = db.get_reply_format_settings(int(payload.user_id))
    signature = str(settings.get("signature") or "")
    template = None
    default_template_id = settings.get("default_template_id")
    if default_template_id is not None:
        template = db.get_reply_template(int(default_template_id), int(payload.user_id))
    if template is None:
        tpls = db.list_reply_templates(int(payload.user_id))
        for t in tpls:
            if bool(t.get("is_default")):
                template = t
                break

    body_plain = apply_reply_format(
        content=body_plain,
        body_template=str(template.get("body_template")) if template else None,
        signature=signature,
        closing=str(template.get("closing")) if template and template.get("closing") is not None else None,
    )
    body_plain = fill_sender_name(body_plain, sender_name=resolve_sender_name(user_id=int(payload.user_id)))

    return {
        "email_id": str(payload.email_id),
        "subject": new_subject,
        "body_plain": body_plain,
        "tokens": int(tokens or 0),
    }


@router.post("/debug/outgoing/drafts/{draft_id}/send")
def debug_send_draft(draft_id: int, user_id: int):
    from app.core.tools.outgoing_email_tools import outgoing_draft_confirm

    update_id = int(time.time() * 1000)
    result = outgoing_draft_confirm(
        f"__draft_id__={int(draft_id)} __tg_update_id__={update_id} 确认",
        user_id=int(user_id),
    )
    return {"result": result}

