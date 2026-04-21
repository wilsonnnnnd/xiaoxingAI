import base64
import re
from typing import Any, Dict, List, Optional

from googleapiclient.discovery import build

from app.skills.gmail.auth import get_credentials


def _get_service(user_id: Optional[int] = None):
    creds = get_credentials(user_id)
    return build("gmail", "v1", credentials=creds)


def _decode_body(part: Dict[str, Any]) -> str:
    """递归提取邮件正文，优先 text/plain，其次 text/html 去标签"""
    mime = part.get("mimeType", "")
    body_data = part.get("body", {}).get("data", "")

    if mime == "text/plain" and body_data:
        return base64.urlsafe_b64decode(body_data).decode("utf-8", errors="replace")

    if mime == "text/html" and body_data:
        html = base64.urlsafe_b64decode(body_data).decode("utf-8", errors="replace")
        return re.sub(r"<[^>]+>", "", html).strip()

    # multipart：递归找子 parts
    for sub in part.get("parts", []):
        result = _decode_body(sub)
        if result:
            return result

    return ""


def _extract_attachment_metadata(payload: Dict[str, Any]) -> Dict[str, Any]:
    names: list[str] = []
    count = 0

    def walk(p: Dict[str, Any]) -> None:
        nonlocal count
        if not isinstance(p, dict):
            return
        filename = str(p.get("filename") or "").strip()
        body = p.get("body") or {}
        attachment_id = ""
        if isinstance(body, dict):
            attachment_id = str(body.get("attachmentId") or "").strip()

        if filename or attachment_id:
            mime = str(p.get("mimeType") or "")
            if not (mime.startswith("multipart/") or mime in {"text/plain", "text/html"}):
                count += 1
                if filename:
                    names.append(filename)

        for sub in p.get("parts", []) or []:
            if isinstance(sub, dict):
                walk(sub)

    walk(payload or {})
    uniq_names = []
    seen = set()
    for n in names:
        if n in seen:
            continue
        seen.add(n)
        uniq_names.append(n)

    return {
        "has_attachments": bool(count > 0 or uniq_names),
        "attachment_count": int(count if count > 0 else len(uniq_names)),
        "attachment_names": uniq_names,
    }


def _parse_message(msg: Dict[str, Any]) -> Dict[str, Any]:
    """将 Gmail API 原始消息解析为标准字段"""
    payload = msg.get("payload", {}) or {}
    headers = {h["name"].lower(): h["value"] for h in payload.get("headers", [])}
    body = _decode_body(payload)
    att = _extract_attachment_metadata(payload)

    return {
        "id":      msg.get("id", ""),
        "subject": headers.get("subject", "(无主题)"),
        "from":    headers.get("from", ""),
        "date":    headers.get("date", ""),
        "snippet": msg.get("snippet", ""),
        "body":    body.strip(),
        **att,
    }


def fetch_unread_emails(max_results: int = 10,
                        user_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    拉取收件筱中未读邮件，返回解析后的邮件列表。
    max_results: 最多返回条数（默认 10）
    """
    service = _get_service(user_id)

    response = service.users().messages().list(
        userId="me",
        q="is:unread in:inbox",
        maxResults=max_results
    ).execute()

    messages = response.get("messages", [])
    if not messages:
        return []

    result = []
    for msg_ref in messages:
        msg = service.users().messages().get(
            userId="me",
            id=msg_ref["id"],
            format="full"
        ).execute()
        result.append(_parse_message(msg))

    return result


def fetch_emails(query: str = "in:inbox", max_results: int = 10,
                 user_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    用自定义 Gmail 搜索语法拉取邮件。
    例：query="is:unread from:noreply@github.com"
    """
    service = _get_service(user_id)

    response = service.users().messages().list(
        userId="me",
        q=query,
        maxResults=max_results
    ).execute()

    messages = response.get("messages", [])
    if not messages:
        return []

    result = []
    for msg_ref in messages:
        msg = service.users().messages().get(
            userId="me",
            id=msg_ref["id"],
            format="full"
        ).execute()
        result.append(_parse_message(msg))

    return result


def fetch_email_by_id(message_id: str, user_id: int) -> Dict[str, Any]:
    """按 message id 拉取单封邮件（format=full）。必须指定 user_id 以隔离 token。"""
    if user_id is None:
        raise ValueError("user_id is required")
    service = _get_service(user_id)
    msg = service.users().messages().get(userId="me", id=message_id, format="full").execute()
    return _parse_message(msg)


def mark_as_read(message_id: str, user_id: Optional[int] = None) -> None:
    """将指定邮件标记为已读"""
    service = _get_service(user_id)
    service.users().messages().modify(
        userId="me",
        id=message_id,
        body={"removeLabelIds": ["UNREAD"]}
    ).execute()


def send_email_raw(*, raw: str, user_id: int) -> Dict[str, Any]:
    """发送邮件（Gmail users.messages.send）。必须指定 user_id 以隔离 token。"""
    if user_id is None:
        raise ValueError("user_id is required")
    service = _get_service(user_id)
    return service.users().messages().send(userId="me", body={"raw": raw}).execute()
