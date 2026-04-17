from __future__ import annotations

from typing import Any, Dict


def _tg_category_label(category: str, notify_lang: str) -> str:
    c = (category or "").strip().lower()
    if notify_lang == "zh":
        return {
            "job": "求职招聘",
            "finance": "财务账单",
            "social": "社交沟通",
            "spam": "广告垃圾",
            "other": "其他",
        }.get(c, "其他")
    return {
        "job": "Job",
        "finance": "Finance",
        "social": "Social",
        "spam": "Spam",
        "other": "Other",
    }.get(c, "Other")


def _tg_priority_label(priority: str, notify_lang: str) -> str:
    p = (priority or "").strip().lower()
    if notify_lang == "zh":
        return {"high": "高", "medium": "中", "low": "低"}.get(p, "中")
    return {"high": "High", "medium": "Medium", "low": "Low"}.get(p, "Medium")


def _tg_category_emoji(category: str) -> str:
    c = (category or "").strip().lower()
    return {"job": "💼", "finance": "💰", "social": "💬", "spam": "🗑️", "other": "📌"}.get(c, "📌")


def _tg_priority_emoji(priority: str) -> str:
    p = (priority or "").strip().lower()
    return {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(p, "🟡")


def render_telegram_message(
    *,
    subject: str,
    sender: str,
    date: str,
    summary: Dict[str, Any],
    notify_lang: str,
) -> str:
    notify_lang = (notify_lang or "").strip().lower()
    if notify_lang not in {"en", "zh"}:
        notify_lang = "en"

    s = (subject or "").strip() or ("(No subject)" if notify_lang == "en" else "（无主题）")
    from_ = (str(summary.get("sender") or "").strip() or sender or "").strip() or ("(none)" if notify_lang == "en" else "（无）")
    dt = (str(summary.get("date") or "").strip() or date or "").strip() or ("(none)" if notify_lang == "en" else "（无）")

    category = str(summary.get("category") or "").strip().lower()
    priority = str(summary.get("priority") or "").strip().lower()
    category_label = _tg_category_label(category, notify_lang)
    priority_label = _tg_priority_label(priority, notify_lang)
    category_emoji = _tg_category_emoji(category)
    priority_emoji = _tg_priority_emoji(priority)

    brief = str(summary.get("summary") or "").strip() or ("(none)" if notify_lang == "en" else "（无）")
    key_points = summary.get("key_points")
    if not isinstance(key_points, list):
        key_points = []
    items = [str(x).strip() for x in key_points if str(x).strip()]
    if not items:
        items = ["(none)" if notify_lang == "en" else "暂无要点"]

    if notify_lang == "zh":
        lines = [
            "📬 <b>新邮件通知</b>",
            "",
            f"✉️ <b>主题：</b>{s}",
            f"👤 <b>发件人：</b>{from_}",
            f"🕐 <b>时间：</b>{dt}",
            "",
            f"{category_emoji} <b>{category_label}</b> · {priority_emoji} 优先级：<b>{priority_label}</b>",
            "",
            f"📋 <b>摘要：</b>{brief}",
            "",
            "📌 <b>关键要点：</b>",
            *[f"• {x}" for x in items],
        ]
        if bool(summary.get("action_needed")) and brief != "（无）":
            lines.append("✅ <b>需要处理</b>")
        return "\n".join(lines).strip()

    lines = [
        "📬 <b>New Email</b>",
        "",
        f"✉️ <b>Subject:</b> {s}",
        f"👤 <b>From:</b> {from_}",
        f"🕐 <b>Date:</b> {dt}",
        "",
        f"{category_emoji} <b>{category_label}</b> · {priority_emoji} Priority: <b>{priority_label}</b>",
        "",
        f"📋 <b>Summary:</b> {brief}",
        "",
        "📌 <b>Key Points:</b>",
        *[f"• {x}" for x in items],
    ]
    if bool(summary.get("action_needed")) and brief != "(none)":
        lines.append("✅ <b>Action needed</b>")
    return "\n".join(lines).strip()

