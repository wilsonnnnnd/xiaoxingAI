from __future__ import annotations

from typing import Any, Dict


def _tg_category_label(category: str, notify_lang: str) -> str:
    c = (category or "").strip().lower()
    return {
        "job": "Job",
        "finance": "Finance",
        "social": "Social",
        "spam": "Spam",
        "other": "Other",
    }.get(c, "Other")


def _tg_priority_label(priority: str, notify_lang: str) -> str:
    p = (priority or "").strip().lower()
    return {"high": "High", "medium": "Medium", "low": "Low"}.get(p, "Medium")


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

    s = (subject or "").strip() or "(No Subject)"
    from_ = (str(summary.get("sender") or "").strip() or sender or "").strip() or (
        "(none)"
    )
    dt = (str(summary.get("date") or "").strip() or date or "").strip() or (
        "(none)"
    )

    category = str(summary.get("category") or "").strip().lower()
    priority = str(summary.get("priority") or "").strip().lower()
    category_label = _tg_category_label(category, notify_lang)
    priority_label = _tg_priority_label(priority, notify_lang)


    brief = str(summary.get("summary") or "").strip() or "(none)"
    key_points = summary.get("key_points")
    if not isinstance(key_points, list):
        key_points = []
    items = [str(x).strip() for x in key_points if str(x).strip()]
    if not items:
        items = ["(none)"]

    lines = [
        "<b>New Email</b>",
        "",
        f"<b>Subject:</b> {s}",
        f"<b>From:</b> {from_}",
        f"<b>Date:</b> {dt}",
        "",
        f"<b>{category_label}</b> · Priority: <b>{priority_label}</b>",
        "",
        f"<b>Summary:</b> {brief}",
        "",
        "<b>Key Points:</b>",
        *[f"• {x}" for x in items],
    ]
    if bool(summary.get("action_needed")) and brief != "(none)":
        lines.append("<b>Action needed</b>")
    return "\n".join(lines).strip()
