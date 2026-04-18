from typing import Optional

from pydantic import BaseModel


class InviteCreateRequest(BaseModel):
    ttl_seconds: Optional[int] = None
    note: Optional[str] = None

