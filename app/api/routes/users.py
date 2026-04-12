from fastapi import APIRouter, Depends, HTTPException

from app import db
from app.core import auth as auth_mod
from app.schemas import UserCreate, UserUpdate

router = APIRouter()


@router.get("/users")
def users_list(user: dict = Depends(auth_mod.require_admin)):
    """列出所有用户（仅限管理员）"""
    rows = db.list_users()
    return {"users": [{k: v for k, v in r.items() if k != "password_hash"} for r in rows]}


@router.post("/users", status_code=201)
def user_create(payload: UserCreate, user: dict = Depends(auth_mod.require_admin)):
    """创建普通用户（仅限管理员）"""
    if db.get_user_by_email(payload.email):
        raise HTTPException(status_code=409, detail="该邮箱已被注册")
    new_user = db.create_user(
        email=payload.email,
        display_name=payload.display_name,
        role="user",
        password_hash=auth_mod.hash_password(payload.password),
    )
    return {k: v for k, v in new_user.items() if k != "password_hash"}


@router.get("/users/{user_id}")
def user_get(user_id: int, user: dict = Depends(auth_mod.current_user)):
    """获取用户详情（本人或管理员）"""
    auth_mod.assert_self_or_admin(user, user_id)
    row = db.get_user_by_id(user_id)
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")
    return {k: v for k, v in row.items() if k != "password_hash"}


@router.put("/users/{user_id}")
def user_update(user_id: int, payload: UserUpdate, user: dict = Depends(auth_mod.current_user)):
    """更新用户设置（本人或管理员）"""
    auth_mod.assert_self_or_admin(user, user_id)
    if not db.get_user_by_id(user_id):
        raise HTTPException(status_code=404, detail="用户不存在")
    updates = payload.model_dump(exclude_unset=True)
    if updates:
        db.update_user(user_id, **updates)
    row = db.get_user_by_id(user_id)
    return {k: v for k, v in row.items() if k != "password_hash"}

