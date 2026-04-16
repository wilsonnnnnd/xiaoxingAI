import asyncio
import logging
from typing import Any, Dict, Optional

import requests

from app import db
from app.core import redis_client as rc
from app.core.telegram.client import send_message
from app.core.tools.outgoing_email_tools import (
    outgoing_draft_cancel,
    outgoing_draft_confirm,
    outgoing_draft_modify,
    reply_email,
)
from app.services.telegram_outgoing_callback_service import TelegramOutgoingCallbackService


logger = logging.getLogger("tg_updates")

_running: bool = False
_task: Optional[asyncio.Task] = None
_offsets: Dict[int, int] = {}


def _get_updates(token: str, offset: int, timeout: int = 25) -> list:
    url = f"https://api.telegram.org/bot{token}/getUpdates"
    try:
        resp = requests.get(
            url,
            params={
                "offset": offset,
                "timeout": timeout,
                "allowed_updates": '["message","edited_message","callback_query"]',
            },
            timeout=timeout + 5,
        )
        data = resp.json()
        if data.get("ok"):
            return data.get("result", [])
    except Exception as e:
        logger.warning("[tg] getUpdates failed: %s", e)
    return []


def _is_confirm(text: str) -> bool:
    t = (text or "").strip().lower()
    return t in {"确认", "发送", "confirm", "send"} or "确认" in t or "发送" in t


def _is_cancel(text: str) -> bool:
    t = (text or "").strip().lower()
    return t in {"取消", "不发", "cancel"} or "取消" in t


def _handle_reply_message(*, bot_id: int, user_id: int, chat_id: str, token: str, update_id: int, message: dict) -> None:
    reply_to = message.get("reply_to_message") or {}
    reply_mid = int(reply_to.get("message_id") or 0)
    text = str(message.get("text") or "").strip()
    if not reply_mid or not text:
        return

    draft = db.get_draft_by_preview_message(
        telegram_bot_id=int(bot_id),
        telegram_chat_id=str(chat_id),
        telegram_message_id=int(reply_mid),
    )
    if draft:
        draft_id = int(draft.get("id") or 0)
        if not draft_id:
            return
        if _is_confirm(text):
            result = outgoing_draft_confirm(f"__draft_id__={draft_id} __tg_update_id__={update_id} 确认", user_id=int(user_id))
        elif _is_cancel(text):
            result = outgoing_draft_cancel(f"__draft_id__={draft_id} __tg_update_id__={update_id} 取消", user_id=int(user_id))
        else:
            result = outgoing_draft_modify(
                f"__draft_id__={draft_id} __tg_update_id__={update_id} __instruction__={text}",
                user_id=int(user_id),
            )
        if result:
            send_message(result, chat_id=str(chat_id), token=str(token), parse_mode=None, reply_markup=None)
        return

    email_id = None
    cached = rc.get_tg_message_cache(bot_id=int(bot_id), chat_id=str(chat_id), message_id=int(reply_mid))
    if isinstance(cached, dict):
        v = cached.get("email_id") or cached.get("emailId")
        if v:
            email_id = str(v)
    if not email_id:
        ref = rc.get_email_notify_ref(bot_id=int(bot_id), message_id=int(reply_mid))
        if isinstance(ref, dict) and ref.get("email_id"):
            email_id = str(ref["email_id"])
    if not email_id:
        return

    msg = f"__bot_id__={int(bot_id)} __chat_id__={str(chat_id)} __email_id__={str(email_id)} __tg_update_id__={int(update_id)} 用户回复意图: {text}"
    result = reply_email(msg, user_id=int(user_id))
    if result:
        send_message(result, chat_id=str(chat_id), token=str(token), parse_mode=None, reply_markup=None)


def _handle_update(*, bot_row: Dict[str, Any], update: dict) -> None:
    bot_id = int(bot_row["id"])
    user_id = int(bot_row["user_id"])
    token = str(bot_row.get("token") or "").strip()
    if not token:
        return

    update_id = int(update.get("update_id") or 0)
    if update_id and not rc.mark_update(update_id):
        return

    if update.get("callback_query"):
        cq = update["callback_query"] or {}
        cq_id = str(cq.get("id") or "")
        data = str(cq.get("data") or "")
        chat_id = str(((cq.get("message") or {}).get("chat") or {}).get("id") or "")
        if not cq_id or not data or not chat_id:
            return
        svc = TelegramOutgoingCallbackService()
        text = svc.handle(bot_id=bot_id, chat_id=chat_id, callback_query_id=cq_id, data=data)
        if text:
            send_message(text, chat_id=str(chat_id), token=str(token), parse_mode=None, reply_markup=None)
        return

    msg = update.get("message") or update.get("edited_message") or None
    if not msg:
        return
    chat_id = str(((msg.get("chat") or {}).get("id")) or "")
    if not chat_id:
        return
    if msg.get("reply_to_message"):
        _handle_reply_message(
            bot_id=bot_id,
            user_id=user_id,
            chat_id=chat_id,
            token=token,
            update_id=update_id,
            message=msg,
        )


async def _loop() -> None:
    global _offsets
    while _running:
        bots = [b for b in db.get_all_bots() if str(b.get("bot_mode") or "all") in ("all", "notify", "chat")]
        if not bots:
            await asyncio.sleep(2)
            continue
        for b in bots:
            token = str(b.get("token") or "").strip()
            if not token:
                continue
            offset = int(_offsets.get(int(b["id"]), 0) or 0)
            updates = _get_updates(token, offset, timeout=25)
            for u in updates:
                uid = int(u.get("update_id") or 0)
                if uid:
                    _offsets[int(b["id"])] = max(int(_offsets.get(int(b["id"]), 0) or 0), uid + 1)
                try:
                    _handle_update(bot_row=b, update=u)
                except Exception as e:
                    logger.warning("[tg] handle update failed: %s", e)
        await asyncio.sleep(0.2)


async def start() -> bool:
    global _running, _task
    if _running and _task and not _task.done():
        return False
    _running = True
    _task = asyncio.create_task(_loop())
    return True


async def stop() -> None:
    global _running, _task
    _running = False
    if _task and not _task.done():
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
    _task = None


def stop_now() -> None:
    global _running, _task
    _running = False
    if _task and not _task.done():
        _task.cancel()
    _task = None


def is_running() -> bool:
    return bool(_running and _task and not _task.done())
