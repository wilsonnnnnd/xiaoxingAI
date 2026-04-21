from typing import Literal, Optional

from pydantic import BaseModel, Field


class EmailAnalysis(BaseModel):
    category: Literal["job", "finance", "social", "spam", "other"] = "other"
    priority: Literal["high", "medium", "low"] = "low"
    summary: str = Field(default="", max_length=200)
    action: Literal["reply", "ignore", "archive", "notify", "review"] = "review"
    reason: str = ""
    deadline: Optional[str] = None
