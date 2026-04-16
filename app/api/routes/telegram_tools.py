from fastapi import APIRouter, HTTPException
from app.api.http import run_http
from app.core import config as app_config
from app.core.telegram.client import test_connection, get_latest_chat_id

router = APIRouter()

@router.post("/telegram/test")
def telegram_test():
    """发送测试消息验证 Telegram 配置是否正确"""
    return run_http(lambda: {"ok": test_connection()}, runtime_error_status=400, error_prefix="发送失败")


@router.get("/telegram/chat_id")
def telegram_get_chat_id(token: str = ""):
    """
    使用给定的 Bot Token 调用 getUpdates，返回最新一条消息的 chat_id。
    前端轮询此接口以自动获取 TELEGRAM_CHAT_ID。
    """
    use_token = token.strip() or app_config.TELEGRAM_BOT_TOKEN
    if not use_token:
        raise HTTPException(status_code=400, detail="请先填写 TELEGRAM_BOT_TOKEN")
    return run_http(lambda: {"chat_id": get_latest_chat_id(use_token)}, runtime_error_status=400, error_prefix="获取失败")


 
