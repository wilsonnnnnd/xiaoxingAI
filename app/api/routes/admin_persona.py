from fastapi import APIRouter, Depends, HTTPException

from app import db
from app.core import auth as auth_mod
from app.core.constants import VALID_PERSONA_CATS
from app.schemas import PersonaConfigSave

router = APIRouter()

_VALID_PERSONA_CATS = VALID_PERSONA_CATS


@router.get("/admin/persona-config")
def admin_persona_config_get(user: dict = Depends(auth_mod.require_admin)):
    """返回所有人设配置 Prompt（星座 / 属相 / 性别），按分类分组。"""
    return db.get_persona_configs()


@router.put("/admin/persona-config")
def admin_persona_config_save(payload: PersonaConfigSave, user: dict = Depends(auth_mod.require_admin)):
    """保存单条人设配置 Prompt（管理员专用）。"""
    if payload.category not in _VALID_PERSONA_CATS:
        raise HTTPException(status_code=422, detail=f"无效的分类：{payload.category}")
    db.upsert_persona_config(payload.category, payload.key, payload.content)
    return {"ok": True}

