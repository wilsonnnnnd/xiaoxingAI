from typing import Optional
from pydantic import BaseModel

class ChatPersonaRequest(BaseModel):
    keywords: str
    zodiac: Optional[str] = None
    chinese_zodiac: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[str] = None
