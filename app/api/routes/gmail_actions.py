from fastapi import APIRouter
from app.services.gmail_service import GmailService
from app.skills.gmail.schemas import GmailFetchRequest, GmailProcessRequest

router = APIRouter()

@router.post("/gmail/fetch")
def gmail_fetch(payload: GmailFetchRequest):
    """从 Gmail 拉取邮件列表（不做 AI 处理）"""
    service = GmailService()
    return service.fetch(payload)


@router.post("/gmail/process")
def gmail_process(payload: GmailProcessRequest):
    """从 Gmail 拉取邮件并对每封执行完整 AI 处理流程"""
    service = GmailService()
    return service.process(payload)
