from fastapi import APIRouter, Depends, HTTPException

from app.core import auth as auth_mod
from app.domains.gmail.schemas import GmailFetchRequest, GmailProcessRequest
from app.domains.gmail.service import GmailService

router = APIRouter()


@router.post("/gmail/fetch")
def gmail_fetch(payload: GmailFetchRequest, user: dict = Depends(auth_mod.current_user)):
    """从 Gmail 拉取邮件列表（不做 AI 处理）"""
    if user.get("role") != "admin" and not user.get("worker_enabled"):
        raise HTTPException(status_code=403, detail="Email worker is not enabled for this user")
    service = GmailService()
    return service.fetch(payload, user_id=int(user["id"]))


@router.post("/gmail/process")
def gmail_process(payload: GmailProcessRequest, user: dict = Depends(auth_mod.current_user)):
    """从 Gmail 拉取邮件并对每封执行完整 AI 处理流程"""
    if user.get("role") != "admin" and not user.get("worker_enabled"):
        raise HTTPException(status_code=403, detail="Email worker is not enabled for this user")
    service = GmailService()
    return service.process(payload, user_id=int(user["id"]))

