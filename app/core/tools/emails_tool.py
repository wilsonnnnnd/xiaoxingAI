"""Tool: get_emails — 查询最近已处理的邮件记录。"""
import logging

from app.core.tools import register

logger = logging.getLogger("tools")


@register(
    "get_emails",
    "查询本地数据库中已处理的邮件记录和统计数据（非实时拉取）",
    keywords=[
        "邮件记录", "邮件统计", "邮件摘要", "邮件总结",
        "历史邮件", "已处理邮件", "邮件历史",
        "高优先级邮件", "紧急邮件",
    ],
    takes_user_id=True,
)
def get_emails(user_id=None) -> str:
    from app import db
    try:
        records = db.get_email_records(limit=5, user_id=user_id)
        stats = db.get_stats()
        if not records:
            return f"Email records count: {stats.get('email_records_count', 0)}. No records available."
        lines = [f"Email records count: {stats.get('email_records_count', 0)}. Last {len(records)} records:\n"]
        for i, r in enumerate(records, 1):
            summary = r.get("summary", {})
            brief = summary.get("brief", "") or r.get("telegram_msg", "")[:100]
            lines.append(
                f"{i}. [{r.get('priority', '')}] {r.get('subject', 'No subject')}\n"
                f"   Sender:{r.get('sender', 'Unknown')}  Time:{r.get('date', '')}\n"
                f"   Brief:{brief}"
            )
        return "\n".join(lines)
    except Exception as e:
        logger.warning(f"[tools] get_emails failed: {e}")
        raise
