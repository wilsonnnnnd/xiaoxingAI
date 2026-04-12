import json
import re

from app.core.tools import register


def _extract_email_id(message: str) -> str:
    m = re.search(r"\b([a-f0-9]{16,})\b", message or "")
    return m.group(1) if m else ""


@register(
    "classify_reply_to",
    "识别 reply_to_message 指向的消息类型（邮件通知/草稿预览/未知）",
    keywords=["判断回复对象", "识别回复对象", "reply_to"],
    takes_message=True,
)
def classify_reply_to(message: str) -> str:
    text = (message or "").strip()

    if "draft_id" in text or "草稿预览" in text or "邮件预览" in text:
        return json.dumps({"target_type": "draft_preview", "reason": "matched draft markers"}, ensure_ascii=False)

    if "新邮件通知" in text or "📬" in text or "📨" in text:
        email_id = _extract_email_id(text)
        return json.dumps({"target_type": "email_notify", "email_id": email_id or None, "reason": "matched notify markers"}, ensure_ascii=False)

    email_id = _extract_email_id(text)
    if email_id:
        return json.dumps({"target_type": "email_notify", "email_id": email_id, "reason": "email_id detected"}, ensure_ascii=False)

    return json.dumps({"target_type": "unknown", "reason": "no markers"}, ensure_ascii=False)

