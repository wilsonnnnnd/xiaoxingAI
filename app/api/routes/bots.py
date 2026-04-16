from fastapi import APIRouter, Depends, HTTPException

from app import db
from app.core import auth as auth_mod
from app.core.constants import VALID_BOT_MODES
from app.schemas import BotCreate, BotUpdate

router = APIRouter()

_VALID_BOT_MODES = VALID_BOT_MODES


@router.get("/users/{user_id}/bots")
def bots_list(user_id: int, user: dict = Depends(auth_mod.current_user)):
    """列出某用户的所有 Bot"""
    auth_mod.assert_self_or_admin(user, user_id)
    return {"bots": db.get_bots_by_user(user_id)}


@router.post("/users/{user_id}/bots", status_code=201)
def bot_create(user_id: int, payload: BotCreate, user: dict = Depends(auth_mod.current_user)):
    """为某用户创建 Bot"""
    auth_mod.assert_self_or_admin(user, user_id)
    if not db.get_user_by_id(user_id):
        raise HTTPException(status_code=404, detail="用户不存在")
    if payload.bot_mode not in _VALID_BOT_MODES:
        raise HTTPException(status_code=422, detail="bot_mode 必须为 'all' 或 'notify'")
    bot = db.create_bot(
        user_id=user_id,
        name=payload.name,
        token=payload.token,
        chat_id=payload.chat_id,
        is_default=payload.is_default,
        bot_mode=payload.bot_mode,
    )
    return bot


@router.put("/users/{user_id}/bots/{bot_id}")
def bot_update(user_id: int, bot_id: int, payload: BotUpdate, user: dict = Depends(auth_mod.current_user)):
    """更新 Bot 配置"""
    auth_mod.assert_self_or_admin(user, user_id)
    existing = db.get_bot(bot_id)
    if not existing or existing["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Bot 不存在")
    updates = payload.model_dump(exclude_unset=True)
    if "bot_mode" in updates and updates["bot_mode"] not in _VALID_BOT_MODES:
        raise HTTPException(status_code=422, detail="bot_mode 必须为 'all' 或 'notify'")
    if updates:
        db.update_bot(bot_id, user_id, **updates)
    return db.get_bot(bot_id)


@router.delete("/users/{user_id}/bots/{bot_id}")
def bot_delete(user_id: int, bot_id: int, user: dict = Depends(auth_mod.current_user)):
    """删除 Bot"""
    auth_mod.assert_self_or_admin(user, user_id)
    existing = db.get_bot(bot_id)
    if not existing or existing["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Bot 不存在")
    db.delete_bot(bot_id)
    return {"ok": True}


@router.post("/users/{user_id}/bots/{bot_id}/set-default")
def bot_set_default(user_id: int, bot_id: int, user: dict = Depends(auth_mod.current_user)):
    """将指定 Bot 设为该用户的默认 Bot"""
    auth_mod.assert_self_or_admin(user, user_id)
    existing = db.get_bot(bot_id)
    if not existing or existing["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Bot 不存在")
    db.set_default_bot(user_id, bot_id)
    return {"ok": True}
