from typing import List, Literal, Optional

from pydantic import BaseModel, Field, root_validator


class EmailReplyOption(BaseModel):
    label: str = Field(min_length=1, max_length=40)
    tone: Literal["formal", "friendly", "concise"]
    content: str = Field(min_length=1, max_length=2000)


class EmailReplyDrafts(BaseModel):
    options: List[EmailReplyOption] = Field(min_length=2, max_length=3)
    style_preference: Optional[str] = Field(default=None, max_length=200)

    @root_validator(skip_on_failure=True)
    def validate_unique_tones(cls, values: dict) -> dict:
        options = values.get("options") or []
        tones = [item.tone for item in options]
        if len(set(tones)) != len(tones):
            raise ValueError("reply tones must be unique")
        return values
