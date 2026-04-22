import logging

logger = logging.getLogger("tools")

_EXTRACT_QUERY_PROMPT = """\
根据用户消息，提取两件事：
1. Gmail 搜索查询字符串（Gmail 搜索语法）
2. 用户想查看的邮件数量（默认 3，最多 10）

只输出 JSON，格式：{"query": "...", "count": N}
不要任何额外文字。

用户消息：{message}

常用 Gmail 语法：
- from:someone@example.com
- subject:关键词
- is:unread
- 直接写关键词模糊搜索

输出示例：
{{"query": "from:github.com is:unread", "count": 3}}
{{"query": "is:unread in:inbox", "count": 5}}
"""


def fetch_email(message: str, user_id=None) -> str:
    import json

    from app.core.llm import call_router
    from app.domains.gmail.client import fetch_emails
    from app.domains.gmail.pipeline import process_email

    extract_prompt = _EXTRACT_QUERY_PROMPT.format(message=message)
    query = "is:unread in:inbox"
    count = 3
    try:
        raw, _ = call_router(
            extract_prompt,
            max_tokens=80,
            user_id=int(user_id) if user_id is not None else None,
            purpose="tool_fetch_email_query",
            source="tools",
        )
        raw = raw.strip()
        import re as _re

        m = _re.search(r"\{.*?\}", raw, _re.DOTALL)
        if m:
            parsed = json.loads(m.group())
            query = str(parsed.get("query") or query).strip().strip("'\"") or query
            count = min(max(int(parsed.get("count") or 3), 1), 10)
    except Exception:
        pass

    logger.info(f"[tools] fetch_email query={query!r} count={count}")

    try:
        emails = fetch_emails(query=query, max_results=count, user_id=user_id)
    except Exception as e:
        raise RuntimeError(f"Gmail fetch failed: {e}")

    if not emails:
        return f"No matching emails found for query: {query}"

    parts: list[str] = [f"Fetched {len(emails)} emails:\n"]

    for i, email in enumerate(emails, 1):
        subj = email.get("subject", "(No Subject)")
        try:
            result = process_email(
                subj,
                email.get("body", ""),
                snippet=email.get("snippet", ""),
                sender=email.get("from", ""),
                date=email.get("date", ""),
                email_id=email.get("id", ""),
                user_id=int(user_id) if user_id is not None else None,
            )
            analysis = result.get("analysis", {})
            summary = result.get("summary", {})
            brief = summary.get("summary", "") or result.get("telegram_message", "")[:200]
            priority = analysis.get("priority", "unknown")
            parts.append(
                f"{i}. [{priority}] {subj}\n"
                f"   Sender: {email.get('from', 'Unknown')}  Time: {email.get('date', '')}\n"
                f"   Brief: {brief}"
            )
        except Exception as e:
            parts.append(f"{i}. {subj} — Processing failed: {e}")

    return "\n".join(parts)
