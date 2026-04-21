from typing import Literal, Optional

from pydantic import BaseModel


class EmailAutomationRuleCreate(BaseModel):
    category: Optional[Literal["job", "finance", "social", "spam", "other"]] = None
    priority: Optional[Literal["high", "medium", "low"]] = None
    action: Literal["notify", "mark_read"]
    enabled: bool = True


class EmailAutomationRuleUpdate(BaseModel):
    category: Optional[Literal["job", "finance", "social", "spam", "other"]] = None
    priority: Optional[Literal["high", "medium", "low"]] = None
    action: Optional[Literal["notify", "mark_read"]] = None
    enabled: Optional[bool] = None


class EmailAutomationRule(BaseModel):
    id: int
    user_id: int
    category: Optional[Literal["job", "finance", "social", "spam", "other"]] = None
    priority: Optional[Literal["high", "medium", "low"]] = None
    action: Literal["notify", "mark_read"]
    enabled: bool
    created_at: str
    updated_at: str
