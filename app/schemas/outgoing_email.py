from typing import Optional

from pydantic import BaseModel


class OutgoingComposeRequest(BaseModel):
    to_email: str
    topic: str
    key_points: str
    tone: Optional[str] = None
    language: Optional[str] = None
    body_format: Optional[str] = "plain"
    idempotency_key: Optional[str] = None
    additional_context: Optional[str] = None


class OutgoingComposeResponse(BaseModel):
    draft_id: int
    to_email: str
    subject: str
    body_format: str
    body: str
    expires_at: str
    tokens: int

