from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, Optional

from pydantic import ValidationError

from app.core.llm import call_llm
from app.schemas import EmailReplyDrafts
from app.utils.prompt_loader import load_prompt


logger = logging.getLogger("email.reply_generation")

_MAX_EMAIL_BODY_CHARS = 4000
_MAX_SUBJECT_CHARS = 300
_MAX_SENDER_NAME_CHARS = 120
_MAX_STYLE_PREFERENCE_CHARS = 200
_PROMPT_PATH = "outgoing/email_reply_drafts.txt"


class EmailReplyGenerationValidationError(ValueError):
    def __init__(self, message: str, *, validation_error: str, raw_response: str):
        super().__init__(message)
        self.validation_error = validation_error
        self.raw_response = raw_response


def _truncate(text: str, max_chars: int) -> str:
    value = str(text or "").strip()
    if len(value) <= max_chars:
        return value
    return value[:max_chars]


def _model_validate_reply_drafts(data: Dict[str, Any]) -> EmailReplyDrafts:
    if hasattr(EmailReplyDrafts, "model_validate"):
        return EmailReplyDrafts.model_validate(data)
    return EmailReplyDrafts.parse_obj(data)


def _model_dump(instance: Any) -> Dict[str, Any]:
    if hasattr(instance, "model_dump"):
        return instance.model_dump()
    return instance.dict()


def _normalize_sender_name(sender_name: Optional[str]) -> str:
    value = str(sender_name or "").strip()
    if not value:
        return ""
    match = re.match(r"^(.*?)\s*<[^>]+>$", value)
    if match:
        return match.group(1).strip().strip('"')
    return value


class EmailReplyGenerationService:
    def generate_reply_drafts(
        self,
        *,
        subject: str,
        content: str,
        sender_name: Optional[str] = None,
        user_style_preference: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        prompt_template = load_prompt(_PROMPT_PATH, user_id=user_id)
        prompt = (
            prompt_template
            .replace("{{subject}}", _truncate(subject, _MAX_SUBJECT_CHARS))
            .replace("{{content}}", _truncate(content, _MAX_EMAIL_BODY_CHARS))
            .replace("{{sender_name}}", _truncate(_normalize_sender_name(sender_name), _MAX_SENDER_NAME_CHARS))
            .replace(
                "{{user_style_preference}}",
                _truncate(user_style_preference or "", _MAX_STYLE_PREFERENCE_CHARS),
            )
        )

        raw_response, tokens = call_llm(prompt, max_tokens=900, use_cache=False)
        try:
            parsed = json.loads((raw_response or "").strip())
            if not isinstance(parsed, dict):
                raise ValueError("reply draft output must be a JSON object")
            validated = _model_validate_reply_drafts(parsed)
        except (json.JSONDecodeError, TypeError, ValueError, ValidationError) as exc:
            raw_excerpt = (raw_response or "")[:4000]
            logger.warning(
                "email reply generation validation failed",
                extra={
                    "raw_response": raw_excerpt,
                    "validation_error": str(exc),
                },
            )
            raise EmailReplyGenerationValidationError(
                "Reply generation validation failed",
                validation_error=str(exc),
                raw_response=raw_excerpt,
            ) from exc

        return {
            "reply_drafts": _model_dump(validated),
            "tokens": int(tokens or 0),
            "raw": raw_response,
        }
