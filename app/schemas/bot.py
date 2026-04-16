from typing import Optional
from pydantic import BaseModel

class BotCreate(BaseModel):
    name: str
    token: str
    chat_id: str
    is_default: bool = False
    bot_mode: str = "all"


class BotUpdate(BaseModel):
    name: Optional[str] = None
    token: Optional[str] = None
    chat_id: Optional[str] = None
    is_default: Optional[bool] = None
    bot_mode: Optional[str] = None
