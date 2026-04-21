from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class ProcessedEmailListItem(BaseModel):
    id: int
    subject: str = ""
    sender: str = ""
    summary: str = ""
    category: Literal["job", "finance", "social", "spam", "other"] = "other"
    priority: Literal["high", "medium", "low"] = "low"
    suggested_action: Literal["reply", "ignore", "archive", "notify", "review"] = "review"
    processing_status: str = ""
    processed_at: str = ""
    has_reply_drafts: bool = False


class ProcessedEmailListResponse(BaseModel):
    count: int
    page: int
    page_size: int
    emails: List[ProcessedEmailListItem] = Field(default_factory=list)


class ProcessedEmailStats(BaseModel):
    processed_today: int = 0
    high_priority: int = 0
    with_reply_drafts: int = 0
    active_rules: int = 0


class ProcessedEmailMatchedRule(BaseModel):
    rule: str
    detail: str = ""
    action: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ProcessedEmailExecutedAction(BaseModel):
    action: str
    success: bool
    optional: bool = False
    message: str = ""
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ProcessedEmailDetail(BaseModel):
    id: int
    subject: str = ""
    sender: str = ""
    processed_at: str = ""
    processing_status: str = ""
    original_email_content: str = ""
    analysis: Dict[str, Any] = Field(default_factory=dict)
    matched_rules: List[ProcessedEmailMatchedRule] = Field(default_factory=list)
    executed_actions: List[ProcessedEmailExecutedAction] = Field(default_factory=list)
    reply_drafts: Dict[str, Any] = Field(default_factory=dict)
    summary: Optional[str] = None
