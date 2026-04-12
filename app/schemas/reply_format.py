from typing import Optional

from pydantic import BaseModel


class ReplyTemplateCreate(BaseModel):
    name: str
    body_template: str
    closing: Optional[str] = None
    is_default: bool = False


class ReplyTemplateUpdate(BaseModel):
    name: Optional[str] = None
    body_template: Optional[str] = None
    closing: Optional[str] = None
    is_default: Optional[bool] = None


class ReplyTemplate(BaseModel):
    id: int
    user_id: int
    name: str
    body_template: str
    closing: Optional[str] = None
    is_default: bool
    created_at: str
    updated_at: str


class ReplyFormatUpdate(BaseModel):
    signature: Optional[str] = None
    default_template_id: Optional[int] = None


class ReplyFormatState(BaseModel):
    signature: str
    default_template_id: Optional[int] = None
    templates: list[ReplyTemplate]

