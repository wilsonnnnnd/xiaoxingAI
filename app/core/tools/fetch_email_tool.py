"""
Tool: fetch_email — 根据用户描述从 Gmail 拉取邮件，AI 处理后返回摘要给用户。

触发示例：
  "帮我看看 GitHub 的邮件"
  "拉取一下来自 boss 的未读邮件"
  "查一下有没有关于发票的邮件"
"""
import logging

from app.core.tools import register

logger = logging.getLogger("tools")

# 同时提取 Gmail 查询字符串和用户想看的数量
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


@register(
    "fetch_email",
    "从 Gmail 拉取指定邮件并进行 AI 分析处理，返回邮件摘要",
    keywords=[
        "帮我看看", "拉取邮件", "查一下邮件", "fetch email",
        "拉一下", "有没有邮件", "帮我查邮件",
        "最新邮件", "新邮件", "未读邮件",
    ],
    takes_message=True,
    takes_user_id=True,
)
def fetch_email(message: str, user_id=None) -> str:
    import json
    from app.core.llm import call_router
    from app.skills.gmail.client import fetch_emails
    from app.skills.gmail.pipeline import process_email

    # Step 1: 用 Router LLM 同时提取 Gmail 查询字符串 + 数量
    extract_prompt = _EXTRACT_QUERY_PROMPT.format(message=message)
    query = "is:unread in:inbox"
    count = 3
    try:
        raw, _ = call_router(extract_prompt, max_tokens=80)
        raw = raw.strip()
        # 兼容 Router 输出不标准 JSON 的情况
        import re as _re
        m = _re.search(r'\{.*?\}', raw, _re.DOTALL)
        if m:
            parsed = json.loads(m.group())
            query = str(parsed.get("query") or query).strip().strip('\'"') or query
            count = min(max(int(parsed.get("count") or 3), 1), 10)
    except Exception:
        pass

    logger.info(f"[tools] fetch_email query={query!r} count={count}")

    # Step 2: 拉取邮件
    try:
        emails = fetch_emails(query=query, max_results=count, user_id=user_id)
    except Exception as e:
        raise RuntimeError(f"Gmail 拉取失败: {e}")

    if not emails:
        return f"根据你的描述（搜索词：{query}），没有找到匹配的邮件。"

    # Step 3: AI 处理每封邮件，拼接摘要
    parts: list[str] = [f"找到 {len(emails)} 封邮件（搜索词：{query}）：\n"]

    for i, email in enumerate(emails, 1):
        subj = email.get("subject", "(无主题)")
        try:
            result = process_email(
                subj,
                email.get("body") or email.get("snippet", ""),
                sender=email.get("from", ""),
                date=email.get("date", ""),
                email_id=email.get("id", ""),
            )
            analysis = result.get("analysis", {})
            summary  = result.get("summary", {})
            brief    = summary.get("brief", "") or result.get("telegram_message", "")[:200]
            priority = analysis.get("priority", "unknown")
            parts.append(
                f"{i}. [{priority}] {subj}\n"
                f"   发件人：{email.get('from', '未知')}  时间：{email.get('date', '')}\n"
                f"   摘要：{brief}"
            )
        except Exception as e:
            parts.append(f"{i}. {subj} — 处理失败: {e}")

    return "\n".join(parts)
