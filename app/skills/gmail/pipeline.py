"""
Gmail AI 处理流水线 — Gmail Skill
分析邮件 → 提取摘要 → 生成 Telegram 通知（3 步 LLM 调用）
"""
import json
import re
from typing import Any, Dict

from app.core import config
from app.core.llm import call_llm
from app.utils.json_parser import extract_json_from_text
from app.utils.prompt_loader import load_prompt


MAX_BODY_CHARS = 4000   # 超出此长度截断，避免 LLM 上下文溢出


def analyze_email(subject: str, body: str) -> Dict[str, Any]:
    """步骤 1：分析邮件分类、优先级、关键词等"""
    template = load_prompt(config.PROMPT_ANALYZE)
    prompt = template.format(subject=subject, body=body)

    raw_result, tokens = call_llm(prompt, use_cache=False)
    parsed = extract_json_from_text(raw_result)

    return {
        "type":   "analysis",
        "result": parsed,
        "raw":    raw_result,
        "tokens": tokens,
    }


def summarize_email(
    subject: str,
    body: str,
    analysis: Dict[str, Any],
    sender: str = "",
    date: str = "",
) -> Dict[str, Any]:
    """步骤 2：基于邮件原文和分析结果，提取结构化摘要"""
    template = load_prompt(config.PROMPT_SUMMARY)
    prompt = template.format(
        subject=subject,
        body=body,
        sender=sender,
        date=date,
        analysis=json.dumps(analysis, ensure_ascii=False, indent=2),
    )
    raw, tokens = call_llm(prompt, max_tokens=512, use_cache=False)
    parsed = extract_json_from_text(raw)
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
    sender: str = "",
    date: str = "",
    email_id: str = "",
) -> Dict[str, Any]:
    """
    完整邮件处理流程：分析 → 摘要 → AI 撰写 Telegram 文案（3 次 LLM 调用）
    """
    # 截断过长正文，避免超出 LLM 上下文窗口
    if len(body) > MAX_BODY_CHARS:
        body = body[:MAX_BODY_CHARS] + "\n...[内容过长，已截断]"

    try:
        analysis = analyze_email(subject, body)
    except Exception as e:
        raise RuntimeError(f"[步骤1-分析] {str(e)}")

    try:
        summary = summarize_email(subject, body, analysis["result"], sender=sender, date=date)
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
