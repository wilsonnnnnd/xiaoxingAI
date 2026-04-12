from fastapi import APIRouter, Depends, HTTPException
from app.core import config as app_config
from app.core.telegram.client import test_connection, get_latest_chat_id
from app.core import auth as auth_mod
from app.services.telegram_service import TelegramService

router = APIRouter()

@router.post("/telegram/test")
def telegram_test():
    """发送测试消息验证 Telegram 配置是否正确"""
    try:
        ok = test_connection()
        return {"ok": ok}
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"发送失败: {str(e)}")


@router.get("/telegram/chat_id")
def telegram_get_chat_id(token: str = ""):
    """
    使用给定的 Bot Token 调用 getUpdates，返回最新一条消息的 chat_id。
    前端轮询此接口以自动获取 TELEGRAM_CHAT_ID。
    """
    use_token = token.strip() or app_config.TELEGRAM_BOT_TOKEN
    if not use_token:
        raise HTTPException(status_code=400, detail="请先填写 TELEGRAM_BOT_TOKEN")
    try:
        chat_id = get_latest_chat_id(use_token)
        return {"chat_id": chat_id}   # None 表示暂无消息
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


@router.post("/telegram/bot/clear_history")
def tg_bot_clear_history(user: dict = Depends(auth_mod.current_user)):
    """清空对话历史记录（内存 + Redis + 日志DB）"""
    service = TelegramService()
    return service.clear_history(user)


@router.get("/telegram/bot/profile")
def tg_bot_profile_get():
    """获取当前默认 Bot 的用户画像"""
    service = TelegramService()
    return service.get_profile()


@router.delete("/telegram/bot/profile")
def tg_bot_profile_delete():
    """删除当前默认 Bot 的用户画像"""
    service = TelegramService()
    return service.delete_profile()


@router.post("/telegram/bot/generate_profile")
def tg_bot_generate_profile():
    """手动触发用户画像生成"""
    service = TelegramService()
    return service.generate_profile()
