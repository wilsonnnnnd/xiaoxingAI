from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from app.api.http import run_http
from app.core import config as app_config
from app.domains.gmail import telegram_updates
from app.domains.telegram.client import get_latest_chat_id, test_connection

router = APIRouter()


@router.post("/telegram/test")
def telegram_test():
    return run_http(
        lambda: {"ok": test_connection()},
        runtime_error_status=400,
        error_prefix="Send failed",
    )


@router.get("/telegram/chat_id")
def telegram_get_chat_id(token: str = ""):
    use_token = token.strip() or app_config.TELEGRAM_BOT_TOKEN
    if not use_token:
        raise HTTPException(status_code=400, detail="Please fill in TELEGRAM_BOT_TOKEN first")
    return run_http(
        lambda: {"chat_id": get_latest_chat_id(use_token)},
        runtime_error_status=400,
        error_prefix="Failed to get latest chat ID",
    )


@router.post("/telegram/webhook/{bot_id}")
async def telegram_webhook(bot_id: int, request: Request, background_tasks: BackgroundTasks):
    if app_config.TELEGRAM_WEBHOOK_SECRET:
        got = request.headers.get("x-telegram-bot-api-secret-token", "")
        if got != app_config.TELEGRAM_WEBHOOK_SECRET:
            raise HTTPException(status_code=403, detail="Invalid Telegram webhook secret")

    update = await request.json()
    background_tasks.add_task(telegram_updates.handle_webhook_update, bot_id, update)
    return {"ok": True}


@router.get("/telegram/updates/status")
def telegram_updates_status():
    return telegram_updates.status()

