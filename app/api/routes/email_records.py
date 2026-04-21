from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException

from app import db
from app.core import auth as auth_mod
from app.schemas import ProcessedEmailDetail, ProcessedEmailListItem, ProcessedEmailListResponse, ProcessedEmailStats

router = APIRouter()


def _extract_summary_text(record: Dict[str, Any]) -> str:
    summary = record.get("summary") or {}
    if isinstance(summary, dict):
        value = str(summary.get("summary") or "").strip()
        if value:
            return value
    analysis = record.get("analysis") or {}
    if isinstance(analysis, dict):
        return str(analysis.get("summary") or "").strip()
    return ""


def _extract_processing_result(record: Dict[str, Any]) -> Dict[str, Any]:
    value = record.get("processing_result") or {}
    return value if isinstance(value, dict) else {}


def _has_reply_drafts(record: Dict[str, Any]) -> bool:
    reply_drafts = record.get("reply_drafts") or {}
    options = reply_drafts.get("options") if isinstance(reply_drafts, dict) else None
    return bool(options if isinstance(options, list) else [])


def _to_processed_email_list_item(record: Dict[str, Any]) -> ProcessedEmailListItem:
    analysis = record.get("analysis") or {}
    return ProcessedEmailListItem(
        id=int(record.get("id") or 0),
        subject=str(record.get("subject") or ""),
        sender=str(record.get("sender") or ""),
        summary=_extract_summary_text(record),
        category=str(analysis.get("category") or "other"),
        priority=str(analysis.get("priority") or "low"),
        suggested_action=str(analysis.get("action") or "review"),
        processing_status=str(record.get("final_status") or ""),
        processed_at=str(record.get("processed_at") or ""),
        has_reply_drafts=_has_reply_drafts(record),
    )


def _to_processed_email_detail(record: Dict[str, Any]) -> ProcessedEmailDetail:
    processing_result = _extract_processing_result(record)
    return ProcessedEmailDetail(
        id=int(record.get("id") or 0),
        subject=str(record.get("subject") or ""),
        sender=str(record.get("sender") or ""),
        processed_at=str(record.get("processed_at") or ""),
        processing_status=str(record.get("final_status") or ""),
        original_email_content=str(record.get("body") or ""),
        analysis=dict(record.get("analysis") or {}),
        matched_rules=list(processing_result.get("matched_rules") or []),
        executed_actions=list(processing_result.get("executed_actions") or []),
        reply_drafts=dict(record.get("reply_drafts") or {}),
        summary=_extract_summary_text(record) or None,
    )


@router.get("/emails/processed", response_model=ProcessedEmailListResponse)
def processed_emails_list(
    page: int = 1,
    page_size: int = 20,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    has_reply_drafts: Optional[bool] = None,
    q: Optional[str] = None,
    user: dict = Depends(auth_mod.current_user),
):
    page = max(1, int(page))
    page_size = max(1, min(100, int(page_size)))
    offset = (page - 1) * page_size
    records = db.get_email_records(
        limit=page_size,
        offset=offset,
        priority=priority,
        category=category,
        has_reply_drafts=has_reply_drafts,
        q=q,
        user_id=int(user["id"]),
    )
    return ProcessedEmailListResponse(
        count=db.count_email_records(
            user_id=int(user["id"]),
            priority=priority,
            category=category,
            has_reply_drafts=has_reply_drafts,
            q=q,
        ),
        page=page,
        page_size=page_size,
        emails=[_to_processed_email_list_item(record) for record in records],
    )


@router.get("/emails/processed/stats", response_model=ProcessedEmailStats)
def processed_emails_stats(user: dict = Depends(auth_mod.current_user)):
    user_id = int(user["id"])
    email_stats = db.get_processed_email_overview_stats(user_id=user_id)
    return ProcessedEmailStats(
        processed_today=int(email_stats.get("processed_today") or 0),
        high_priority=int(email_stats.get("high_priority") or 0),
        with_reply_drafts=int(email_stats.get("with_reply_drafts") or 0),
        active_rules=int(db.count_enabled_email_automation_rules(user_id)),
    )


@router.get("/emails/processed/{id}", response_model=ProcessedEmailDetail)
def processed_email_detail(id: int, user: dict = Depends(auth_mod.current_user)):
    record = db.get_email_record_by_id(int(id), user_id=int(user["id"]))
    if record is None:
        raise HTTPException(status_code=404, detail="Processed email not found")
    return _to_processed_email_detail(record)


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
