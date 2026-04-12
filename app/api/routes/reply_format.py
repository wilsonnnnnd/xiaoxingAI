from fastapi import APIRouter, Depends, HTTPException

from app import db
from app.core import auth as auth_mod
from app.schemas.reply_format import (
    ReplyFormatState,
    ReplyFormatUpdate,
    ReplyTemplate,
    ReplyTemplateCreate,
    ReplyTemplateUpdate,
)


router = APIRouter(tags=["reply-format"])


@router.get("/reply-format", response_model=ReplyFormatState)
def get_reply_format(user: dict = Depends(auth_mod.current_user)):
    user_id = int(user["id"])
    templates = db.list_reply_templates(user_id)
    if not templates:
        db.create_reply_template(
            user_id=user_id,
            name="默认模板",
            body_template="{{content}}\n\n{{closing}}\n\n{{signature}}",
            closing="谢谢，",
            is_default=True,
        )
        settings = db.get_reply_format_settings(user_id)
        if not str(settings.get("signature") or "").strip():
            db.upsert_reply_format_settings(user_id=user_id, signature="{{sender_name}}")

    settings = db.get_reply_format_settings(user_id)
    templates = db.list_reply_templates(user_id)
    return {
        "signature": str(settings.get("signature") or ""),
        "default_template_id": settings.get("default_template_id"),
        "templates": templates,
    }


@router.put("/reply-format", response_model=ReplyFormatState)
def update_reply_format(payload: ReplyFormatUpdate, user: dict = Depends(auth_mod.current_user)):
    user_id = int(user["id"])
    if payload.default_template_id is not None:
        tpl = db.get_reply_template(int(payload.default_template_id), user_id)
        if not tpl:
            raise HTTPException(status_code=404, detail="默认模板不存在")
    db.upsert_reply_format_settings(
        user_id=user_id,
        signature=payload.signature,
        default_template_id=payload.default_template_id,
    )
    settings = db.get_reply_format_settings(user_id)
    templates = db.list_reply_templates(user_id)
    return {
        "signature": str(settings.get("signature") or ""),
        "default_template_id": settings.get("default_template_id"),
        "templates": templates,
    }


@router.get("/reply-templates", response_model=list[ReplyTemplate])
def list_templates(user: dict = Depends(auth_mod.current_user)):
    return db.list_reply_templates(int(user["id"]))


@router.post("/reply-templates", status_code=201, response_model=ReplyTemplate)
def create_template(payload: ReplyTemplateCreate, user: dict = Depends(auth_mod.current_user)):
    user_id = int(user["id"])
    tpl = db.create_reply_template(
        user_id=user_id,
        name=payload.name,
        body_template=payload.body_template,
        closing=payload.closing,
        is_default=bool(payload.is_default),
    )
    if tpl.get("is_default"):
        db.upsert_reply_format_settings(user_id=user_id, default_template_id=int(tpl["id"]))
    return tpl


@router.put("/reply-templates/{template_id}", response_model=ReplyTemplate)
def update_template(template_id: int, payload: ReplyTemplateUpdate, user: dict = Depends(auth_mod.current_user)):
    user_id = int(user["id"])
    updates = payload.model_dump(exclude_unset=True)
    tpl = db.update_reply_template(int(template_id), user_id, **updates)
    if not tpl:
        raise HTTPException(status_code=404, detail="模板不存在")
    if tpl.get("is_default"):
        db.upsert_reply_format_settings(user_id=user_id, default_template_id=int(tpl["id"]))
    return tpl


@router.delete("/reply-templates/{template_id}")
def delete_template(template_id: int, user: dict = Depends(auth_mod.current_user)):
    ok = db.delete_reply_template(int(template_id), int(user["id"]))
    if not ok:
        raise HTTPException(status_code=404, detail="模板不存在")
    return {"ok": True}
