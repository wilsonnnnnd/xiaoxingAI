from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple

from fastapi import APIRouter, Depends

from app import db
from app.core import auth as auth_mod
from app.domains import worker

router = APIRouter()


def _utc_now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _utc_now_iso() -> str:
    return _utc_now().strftime("%Y-%m-%dT%H:%M:%S")


def _days_back_keys(*, days: int) -> List[str]:
    today = _utc_now().date()
    start = today - timedelta(days=max(days - 1, 0))
    out: List[str] = []
    cur = start
    while cur <= today:
        out.append(cur.strftime("%Y-%m-%d"))
        cur = cur + timedelta(days=1)
    return out


def _fill_day_series(keys: List[str], rows: List[Tuple[str, int]]) -> List[Dict[str, Any]]:
    m = {k: 0 for k in keys}
    for day, value in rows:
        if day in m:
            m[day] = int(value or 0)
    return [{"date": day, "value": int(m[day])} for day in keys]


def _fill_day_float_series(keys: List[str], rows: List[Tuple[str, float]]) -> List[Dict[str, Any]]:
    m = {k: 0.0 for k in keys}
    for day, value in rows:
        if day in m:
            m[day] = round(float(value or 0.0), 6)
    return [{"date": day, "value": round(float(m[day]), 6)} for day in keys]


def _fill_model_series(keys: List[str], series: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    filled: List[Dict[str, Any]] = []
    for item in series:
        values = {str(point["date"]): int(point["value"] or 0) for point in (item.get("data") or [])}
        filled.append(
            {
                "name": str(item.get("name") or ""),
                "data": [{"date": day, "value": int(values.get(day, 0))} for day in keys],
            }
        )
    return filled


def _normalize_days(days: int) -> int:
    days = int(days or 30)
    if days < 7:
        days = 7
    if days > 90:
        days = 90
    return days


@router.get("/admin/dashboard")
def admin_dashboard(days: int = 30, user: dict = Depends(auth_mod.require_admin)):
    days = _normalize_days(days)

    now_iso = _utc_now_iso()
    keys = _days_back_keys(days=days)
    from_ts_text = f"{keys[0]}T00:00:00"
    from_ts = datetime.strptime(from_ts_text, "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    from_7d = (_utc_now() - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%S")
    from_24h = (_utc_now() - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%S")

    with db._cur() as cur:
        cur.execute('SELECT COUNT(*) FROM "user"')
        total_users = int(cur.fetchone()[0] or 0)

        cur.execute('SELECT COUNT(*) FROM "user" WHERE created_at >= NOW() - (%s)::interval', ("7 days",))
        new_users_7d = int(cur.fetchone()[0] or 0)

        cur.execute(
            "SELECT COUNT(DISTINCT user_id) FROM log WHERE user_id IS NOT NULL AND ts >= %s",
            (from_7d,),
        )
        active_users_7d = int(cur.fetchone()[0] or 0)

        cur.execute("SELECT COUNT(*) FROM user_settings WHERE worker_enabled = TRUE")
        worker_enabled_users = int(cur.fetchone()[0] or 0)

        cur.execute("SELECT COUNT(*) FROM log WHERE ts >= %s", (from_24h,))
        total_logs_24h = int(cur.fetchone()[0] or 0)
        cur.execute("SELECT COUNT(*) FROM log WHERE ts >= %s AND level = 'error'", (from_24h,))
        error_logs_24h = int(cur.fetchone()[0] or 0)

        cur.execute(
            'SELECT to_char(created_at::date, %s) AS d, COUNT(*)'
            ' FROM "user"'
            " WHERE created_at::date >= CURRENT_DATE - %s"
            " GROUP BY created_at::date"
            " ORDER BY d",
            ("YYYY-MM-DD", max(days - 1, 0)),
        )
        user_growth_rows = [(str(row[0]), int(row[1] or 0)) for row in (cur.fetchall() or [])]

        cur.execute(
            "SELECT left(processed_at, 10) AS d, COUNT(*)"
            " FROM email_records"
            " WHERE processed_at >= %s"
            " GROUP BY left(processed_at, 10)"
            " ORDER BY d",
            (from_ts_text,),
        )
        processed_rows = [(str(row[0]), int(row[1] or 0)) for row in (cur.fetchall() or [])]

        cur.execute(
            "SELECT left(ts, 10) AS d, COUNT(*)"
            " FROM log"
            " WHERE ts >= %s AND level = 'error'"
            " GROUP BY left(ts, 10)"
            " ORDER BY d",
            (from_ts_text,),
        )
        error_rows = [(str(row[0]), int(row[1] or 0)) for row in (cur.fetchall() or [])]

    usage_summary = db.get_ai_usage_summary()
    usage_daily = db.get_ai_usage_daily_totals(from_ts=from_ts)
    usage_model_series = db.get_ai_usage_model_series(from_ts=from_ts, top_n=4)
    top_users_by_cost = db.get_ai_usage_top_users(limit=5, sort_by="cost")
    top_users_by_tokens = db.get_ai_usage_top_users(limit=5, sort_by="tokens")
    cost_by_model = db.get_ai_usage_cost_breakdown(dimension="model_name", limit=6)
    cost_by_purpose = db.get_ai_usage_cost_breakdown(dimension="purpose", limit=6)

    token_rows = [(str(row["date"]), int(row["total_tokens"])) for row in usage_daily]
    cost_rows = [(str(row["date"]), float(row["estimated_cost_usd"])) for row in usage_daily]

    total_emails_processed = int(db.count_email_records(user_id=None) or 0)
    worker_status = worker.get_status()
    recent_logs = db.get_recent_logs(limit=12)

    analytics_ready = usage_summary["request_count"] > 0
    analytics_note = (
        "Estimated from tracked AI usage records using the built-in model rate table."
        if analytics_ready
        else "AI usage analytics will appear after the next tracked model request."
    )
    model_note = (
        "Tracked models ranked by token usage over the selected window."
        if usage_model_series
        else "Model usage will appear after tracked model requests are recorded."
    )

    return {
        "generated_at": now_iso,
        "range_days": days,
        "summary": {
            "total_users": total_users,
            "active_users_7d": active_users_7d,
            "new_users_7d": new_users_7d,
            "total_emails_processed": total_emails_processed,
            "total_tokens_used": int(usage_summary["total_tokens"]),
            "estimated_cost_usd": float(usage_summary["estimated_cost_usd"]),
            "paid_members": None,
        },
        "series": {
            "user_growth": _fill_day_series(keys, user_growth_rows),
            "token_usage": _fill_day_series(keys, token_rows) if analytics_ready else [],
            "emails_processed": _fill_day_series(keys, processed_rows),
            "error_count": _fill_day_series(keys, error_rows),
            "estimated_cost": _fill_day_float_series(keys, cost_rows) if analytics_ready else [],
            "model_usage": _fill_model_series(keys, usage_model_series),
        },
        "operational": {
            "worker_enabled_users": worker_enabled_users,
            "worker_system_status": worker_status,
            "error_count_24h": error_logs_24h,
            "error_rate_24h": (float(error_logs_24h) / float(total_logs_24h)) if total_logs_24h else 0.0,
            "last_activity_ts": (recent_logs[-1]["ts"] if recent_logs else None),
        },
        "membership": {
            "paid_members": None,
            "free_members": None,
            "note": "Membership data is not available yet",
        },
        "analytics": {
            "top_users": {
                "by_cost": top_users_by_cost,
                "by_tokens": top_users_by_tokens,
            },
            "cost_breakdown": {
                "by_model": cost_by_model,
                "by_purpose": cost_by_purpose,
            },
        },
        "recent_logs": recent_logs,
        "notes": {
            "estimated_cost": analytics_note,
            "model_usage": model_note,
        },
    }


@router.get("/dashboard")
def user_dashboard(days: int = 30, user: dict = Depends(auth_mod.current_user)):
    days = _normalize_days(days)
    user_id = int(user["id"])
    now_iso = _utc_now_iso()
    keys = _days_back_keys(days=days)
    from_ts_text = f"{keys[0]}T00:00:00"
    from_ts = datetime.strptime(from_ts_text, "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)

    with db._cur() as cur:
        cur.execute(
            "SELECT left(processed_at, 10) AS d, COUNT(*)"
            " FROM email_records"
            " WHERE user_id = %s AND processed_at >= %s"
            " GROUP BY left(processed_at, 10)"
            " ORDER BY d",
            (user_id, from_ts_text),
        )
        processed_rows = [(str(row[0]), int(row[1] or 0)) for row in (cur.fetchall() or [])]

    usage_summary = db.get_ai_usage_summary(user_id=user_id)
    usage_daily = db.get_ai_usage_daily_totals(from_ts=from_ts, user_id=user_id)
    recent_logs = db.get_recent_logs(limit=8, user_id=user_id)
    email_stats = db.get_processed_email_overview_stats(user_id=user_id)
    total_emails_processed = int(db.count_email_records(user_id=user_id) or 0)
    active_rules = int(db.count_enabled_email_automation_rules(user_id) or 0)
    worker_status = worker.get_user_status(user_id=user_id)

    analytics_ready = usage_summary["request_count"] > 0
    analytics_note = (
        "Estimated from your tracked AI usage records using the configured pricing table."
        if analytics_ready
        else "Estimated AI cost will appear after your next tracked model request."
    )

    token_rows = [(str(row["date"]), int(row["total_tokens"])) for row in usage_daily]
    cost_rows = [(str(row["date"]), float(row["estimated_cost_usd"])) for row in usage_daily]

    return {
        "generated_at": now_iso,
        "range_days": days,
        "summary": {
            "total_emails_processed": total_emails_processed,
            "processed_today": int(email_stats.get("processed_today") or 0),
            "with_reply_drafts": int(email_stats.get("with_reply_drafts") or 0),
            "active_rules": active_rules,
            "total_tokens_used": int(usage_summary["total_tokens"]),
            "estimated_cost_usd": float(usage_summary["estimated_cost_usd"]),
        },
        "series": {
            "token_usage": _fill_day_series(keys, token_rows) if analytics_ready else [],
            "emails_processed": _fill_day_series(keys, processed_rows),
            "estimated_cost": _fill_day_float_series(keys, cost_rows) if analytics_ready else [],
        },
        "operational": {
            "worker_status": worker_status,
            "last_activity_ts": (recent_logs[-1]["ts"] if recent_logs else None),
        },
        "membership": {
            "plan_name": None,
            "note": "Membership data is not available yet",
        },
        "recent_logs": recent_logs,
        "notes": {
            "estimated_cost": analytics_note,
        },
    }
