from typing import Optional

from fastapi import APIRouter, HTTPException

from app import db

router = APIRouter()


@router.get("/email/records")
def email_records_list(limit: int = 50, priority: Optional[str] = None):
    """返回邮件处理记录列表（按处理时间倒序）"""
    return {"count": db.count_email_records(), "records": db.get_email_records(limit=limit, priority=priority)}


@router.get("/email/records/{email_id}")
def email_record_detail(email_id: str):
    """返回单条邮件处理记录详情"""
    record = db.get_email_record(email_id)
    if record is None:
        raise HTTPException(status_code=404, detail="邮件记录不存在")
    return record

