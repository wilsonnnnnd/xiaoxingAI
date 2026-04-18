from typing import Optional
from pydantic import BaseModel

class AdminLoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None
    ui_lang: Optional[str] = None
    notify_lang: Optional[str] = None
    invite_code: Optional[str] = None
    website: Optional[str] = None
