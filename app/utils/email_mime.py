import base64
from email.message import EmailMessage
from typing import Optional


def build_gmail_raw_message(
    *,
    to_email: str,
    subject: str,
    body_plain: str,
    body_html: Optional[str] = None,
) -> str:
    msg = EmailMessage()
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body_plain or "")
    if body_html:
        msg.add_alternative(body_html, subtype="html")
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii")
    return raw

