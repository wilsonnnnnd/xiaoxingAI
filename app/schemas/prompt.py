from typing import Optional
from pydantic import BaseModel

class PromptCreate(BaseModel):
    name: str
    type: str
    content: str
    is_default: bool = False


class PromptUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    is_default: Optional[bool] = None
