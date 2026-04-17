"""
Gmail AI 处理流水线 — Gmail Skill
分析邮件 → 提取摘要 → 生成 Telegram 通知（3 步 LLM 调用）
"""
import json
import re
from typing import Any, Dict, Tuple

from app.core import config
from app.core.llm import call_llm
from app.utils.json_parser import extract_json_with_repair
from app.utils.prompt_loader import load_prompt


MAX_BODY_CHARS = 6000   # 超出此长度截断，避免 LLM 上下文溢出
SUMMARY_BODY_CHARS = 1200
MAX_SNIPPET_CHARS = 400


def _truncate(text: str, max_chars: int, suffix: str = "") -> Tuple[str, bool]:
    t = (text or "").strip()
    if not t:
        return "", False
    if len(t) <= max_chars:
        return t, False
    return t[:max_chars] + suffix, True


def analyze_email(subject: str, body_excerpt: str, snippet: str = "") -> Dict[str, Any]:
    """步骤 1：分析邮件分类、优先级、关键词等"""
    body_excerpt, _ = _truncate(body_excerpt, MAX_BODY_CHARS, suffix="\n...[内容过长，已截断]")
    snippet, _ = _truncate(snippet, MAX_SNIPPET_CHARS)
    template = load_prompt(config.PROMPT_ANALYZE)
    prompt = template.format(subject=subject, body_excerpt=body_excerpt, snippet=snippet)

    raw_result, tokens = call_llm(prompt, max_tokens=256, use_cache=False)
    schema_hint = """{
  "category": "other",
  "priority": "low",
  "summary": "",
  "action_needed": false
}"""
    parsed = extract_json_with_repair(raw_result, schema_hint=schema_hint, max_repair_tokens=128)

    return {
        "type":   "analysis",
        "result": parsed,
        "raw":    raw_result,
        "tokens": tokens,
    }


def summarize_email(
    subject: str,
    analysis: Dict[str, Any],
    sender: str = "",
    date: str = "",
    snippet: str = "",
    body_excerpt: str = "",
) -> Dict[str, Any]:
    """步骤 2：基于邮件原文和分析结果，提取结构化摘要"""
    snippet, _ = _truncate(snippet, MAX_SNIPPET_CHARS)
    body_excerpt, _ = _truncate(body_excerpt, SUMMARY_BODY_CHARS, suffix="\n...[已截断]")
    template = load_prompt(config.PROMPT_SUMMARY)
    prompt = template.format(
        subject=subject,
        sender=sender,
        date=date,
        analysis=json.dumps(analysis, ensure_ascii=False, indent=2),
        snippet=snippet,
        body_excerpt=body_excerpt,
    )
    raw, tokens = call_llm(prompt, max_tokens=256, use_cache=False)
    schema_defaults = {
        "category": str(analysis.get("category") or "other"),
        "priority": str(analysis.get("priority") or "low"),
        "category_zh": "",
        "priority_zh": "",
        "summary": "",
        "key_points": [],
        "action_needed": bool(analysis.get("action_needed") or False),
        "sender": "",
        "date": "",
    }
    parsed = extract_json_with_repair(
        raw,
        schema_hint=json.dumps(schema_defaults, ensure_ascii=False, indent=2),
        max_repair_tokens=192,
    )
    return {"type": "summary", "result": parsed, "raw": raw, "tokens": tokens}


_TG_VALID_TAG = re.compile(
    r'^</?(?:b|strong|i|em|u|ins|s|strike|del|code|pre|tg-spoiler)>$'
    r'|^<a(?:\s[^>]*)?>$'
    r'|^</a>$',
    re.IGNORECASE,
)


def _sanitize_tg_html(text: str) -> str:
    """将 LLM 可能生成的不支持的 HTML 标签处理为 Telegram 可接受的格式"""
    # <br> / <br/> → 换行
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    # <p> 开合标签 → 换行 / 删除
    text = re.sub(r"<p(?:\s[^>]*)?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "", text, flags=re.IGNORECASE)
    # 其他已知块级/内联标签 → 删除指令，保留内容
    text = re.sub(
        r"</?(?:div|span|h[1-6]|ul|ol|li|hr|table|tr|td|th|img|header|footer|section|article)(?:\s[^>]*)?>",
        "", text, flags=re.IGNORECASE,
    )

    # 最终兜底：将所有不在白名单里的 <...> 转义为 &lt;...&gt;
    def _escape_unknown(m: re.Match) -> str:
        tag = m.group(0)
        if _TG_VALID_TAG.match(tag):
            return tag
        return "&lt;" + tag[1:-1] + "&gt;"

    text = re.sub(r"<[^>]+>", _escape_unknown, text)
    # 去除连续空行超过 3 行
    text = re.sub(r"\n{4,}", "\n\n\n", text)
    return text.strip()


def write_telegram_message(
    subject: str,
    summary: Dict[str, Any],
    sender: str = "",
    date: str = "",
    email_id: str = "",
) -> tuple[str, int]:
    """步骤 3：让 AI 根据摘要数据撰写 Telegram 消息文案（HTML 格式）"""
    template = load_prompt(config.PROMPT_TELEGRAM)
    prompt = template.format(
        subject=subject,
        sender=sender,
        date=date,
        summary=json.dumps(summary, ensure_ascii=False, indent=2),
    )
    raw_msg, tg_tokens = call_llm(prompt, max_tokens=800, use_cache=False)
    message = _sanitize_tg_html(raw_msg.strip())
    if email_id:
        gmail_url = f"https://mail.google.com/mail/u/0/#inbox/{email_id}"
        message += f'\n\n<a href="{gmail_url}">📧 在 Gmail 中查看</a>'
    return message, tg_tokens


def process_email(
    subject: str,
    body: str,
    snippet: str = "",
    sender: str = "",
    date: str = "",
    email_id: str = "",
) -> Dict[str, Any]:
    """
    完整邮件处理流程：分析 → 摘要 → AI 撰写 Telegram 文案（3 次 LLM 调用）
    """
    snippet_short, _ = _truncate(snippet, MAX_SNIPPET_CHARS)
    effective_body = (body or "").strip() or snippet_short
    body_excerpt, _ = _truncate(effective_body, MAX_BODY_CHARS, suffix="\n...[内容过长，已截断]")
    summary_excerpt, _ = _truncate(body_excerpt, SUMMARY_BODY_CHARS, suffix="\n...[已截断]")

    try:
        analysis = analyze_email(subject, body_excerpt, snippet=snippet_short)
    except Exception as e:
        raise RuntimeError(f"[步骤1-分析] {str(e)}")

    try:
        summary = summarize_email(
            subject,
            analysis["result"],
            sender=sender,
            date=date,
            snippet=snippet_short,
            body_excerpt=summary_excerpt,
        )
    except Exception as e:
        raise RuntimeError(f"[步骤2-摘要] {str(e)}")

    try:
        telegram_message, tg_tokens = write_telegram_message(
            subject, summary["result"],
            sender=sender, date=date, email_id=email_id,
        )
    except Exception as e:
        raise RuntimeError(f"[步骤3-Telegram文案] {str(e)}")

    total_tokens = (
        analysis.get("tokens", 0)
        + summary.get("tokens", 0)
        + tg_tokens
    )
    return {
        "subject":          subject,
        "analysis":         analysis["result"],
        "summary":          summary["result"],
        "telegram_message": telegram_message,
        "tokens":           total_tokens,
    }
