from typing import Optional
from pydantic import BaseModel

class AdminLoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
