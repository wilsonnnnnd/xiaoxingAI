from typing import Optional
from pydantic import BaseModel

class UserCreate(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None


class UserUpdate(BaseModel):
    worker_enabled: Optional[bool] = None
    min_priority: Optional[str] = None
    max_emails_per_run: Optional[int] = None
    poll_interval: Optional[int] = None
