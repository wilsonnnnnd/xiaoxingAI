import base64
import re
from typing import Any, Dict, List, Optional

from googleapiclient.discovery import build

from app.skills.gmail.auth import get_credentials


def _get_service():
    creds = get_credentials()
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


def _parse_message(msg: Dict[str, Any]) -> Dict[str, Any]:
    """将 Gmail API 原始消息解析为标准字段"""
    headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
    body = _decode_body(msg.get("payload", {}))

    return {
        "id":      msg.get("id", ""),
        "subject": headers.get("subject", "(无主题)"),
        "from":    headers.get("from", ""),
        "date":    headers.get("date", ""),
        "snippet": msg.get("snippet", ""),
        "body":    body.strip(),
    }


def fetch_unread_emails(max_results: int = 10) -> List[Dict[str, Any]]:
    """
    拉取收件箱中未读邮件，返回解析后的邮件列表。
    max_results: 最多返回条数（默认 10）
    """
    service = _get_service()

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


def fetch_emails(query: str = "in:inbox", max_results: int = 10) -> List[Dict[str, Any]]:
    """
    用自定义 Gmail 搜索语法拉取邮件。
    例：query="is:unread from:noreply@github.com"
    """
    service = _get_service()

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


def mark_as_read(message_id: str) -> None:
    """将指定邮件标记为已读"""
    service = _get_service()
    service.users().messages().modify(
        userId="me",
        id=message_id,
        body={"removeLabelIds": ["UNREAD"]}
    ).execute()
