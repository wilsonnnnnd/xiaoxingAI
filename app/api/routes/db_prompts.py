from fastapi import APIRouter, Depends, HTTPException

from app import db
from app.core import auth as auth_mod
from app.schemas import PromptCreate, PromptUpdate

router = APIRouter()


@router.get("/db/prompts")
def db_prompts_list(user: dict = Depends(auth_mod.current_user)):
    """列出当前用户可见的所有 Prompt（系统级 + 本人创建）"""
    rows = db.get_prompts(user_id=user["id"])
    return {"prompts": rows}


@router.post("/db/prompts", status_code=201)
def db_prompt_create(payload: PromptCreate, user: dict = Depends(auth_mod.current_user)):
    """为当前用户创建自定义 Prompt"""
    row = db.create_prompt(
        user_id=user["id"],
        name=payload.name,
        ptype=payload.type,
        content=payload.content,
        is_default=payload.is_default,
    )
    return row


@router.put("/db/prompts/{prompt_id}")
def db_prompt_update(prompt_id: int, payload: PromptUpdate, user: dict = Depends(auth_mod.current_user)):
    """更新 Prompt（本人创建的 or 管理员）"""
    existing = db.get_prompt(prompt_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Prompt not found")
    owner_id = existing.get("user_id")
    if owner_id is None and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="System Prompt can only be updated by admin")
    if owner_id is not None and owner_id != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="No permission to update")
    updates = payload.model_dump(exclude_unset=True)
    if updates:
        db.update_prompt(prompt_id, **updates)
    return db.get_prompt(prompt_id)


@router.delete("/db/prompts/{prompt_id}")
def db_prompt_delete(prompt_id: int, user: dict = Depends(auth_mod.current_user)):
    """删除 Prompt（本人创建的 or 管理员）"""
    existing = db.get_prompt(prompt_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Prompt not found")
    owner_id = existing.get("user_id")
    if owner_id is None and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="System Prompt can only be deleted by admin")
    if owner_id is not None and owner_id != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="No permission to delete")
    db.delete_prompt(prompt_id)
    return {"ok": True}

