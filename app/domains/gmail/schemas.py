from typing import Optional

from pydantic import BaseModel


class EmailRequest(BaseModel):
    subject: str
    body: str


class GmailFetchRequest(BaseModel):
    query: Optional[str] = "is:unread in:inbox"
    max_results: Optional[int] = 10


class GmailProcessRequest(BaseModel):
    query: Optional[str] = "is:unread in:inbox"
    max_results: Optional[int] = 5
    mark_read: Optional[bool] = False
    send_telegram: Optional[bool] = False

