import logging

from fastapi import APIRouter, Depends, HTTPException

from app import db
from app.core import auth as auth_mod
from app.schemas import AdminLoginRequest, ChangePasswordRequest

router = APIRouter()

logger = logging.getLogger("main")


@router.post("/auth/login")
def admin_login(payload: AdminLoginRequest):
    """账号密码登录，返回 JWT（admin 和普通用户均可登录）"""
    user = db.get_user_by_email(payload.email)
    if not user or not user.get("password_hash"):
        logger.warning("[auth] 登录失败 (user not found): %s", payload.email)
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if not auth_mod.verify_password(payload.password, user["password_hash"]):
        logger.warning("[auth] 登录失败 (wrong password): %s", payload.email)
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = auth_mod.create_access_token(user)
    logger.info("[auth] 登录成功: %s (role=%s)", payload.email, user["role"])
    return {"access_token": token, "token_type": "bearer"}


@router.get("/auth/me")
def auth_me(user: dict = Depends(auth_mod.current_user)):
    """返回当前登录用户信息"""
    safe = {k: v for k, v in user.items() if k != "password_hash"}
    return safe


@router.post("/auth/change-password")
def change_password(payload: ChangePasswordRequest, user: dict = Depends(auth_mod.current_user)):
    password_hash = user.get("password_hash")
    if not password_hash:
        raise HTTPException(status_code=400, detail="该账号未设置密码")
    if not auth_mod.verify_password(payload.old_password, password_hash):
        raise HTTPException(status_code=401, detail="旧密码错误")
    if not payload.new_password or len(payload.new_password) < 4:
        raise HTTPException(status_code=400, detail="新密码至少 4 个字符")
    if payload.new_password == payload.old_password:
        raise HTTPException(status_code=400, detail="新密码不能与旧密码相同")
    db.update_user(user["id"], password_hash=auth_mod.hash_password(payload.new_password))
    auth_mod.invalidate_user_tokens(user["id"])
    token = auth_mod.create_access_token(db.get_user_by_id(user["id"]) or user)
    return {"ok": True, "access_token": token, "token_type": "bearer"}
