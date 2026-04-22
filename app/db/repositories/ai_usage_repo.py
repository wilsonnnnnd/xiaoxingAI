from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from ..session import _cur


def insert_ai_usage(
    *,
    user_id: Optional[int],
    recorded_at: datetime,
    provider: str,
    source: str,
    purpose: str,
    model_name: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    estimated_cost_usd: Decimal,
) -> None:
    with _cur() as cur:
        cur.execute(
            """
            INSERT INTO ai_usage_analytics (
                user_id,
                recorded_at,
                provider,
                source,
                purpose,
                model_name,
                prompt_tokens,
                completion_tokens,
                total_tokens,
                estimated_cost_usd
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                recorded_at,
                str(provider or ""),
                str(source or ""),
                str(purpose or ""),
                str(model_name or ""),
                int(prompt_tokens or 0),
                int(completion_tokens or 0),
                int(total_tokens or 0),
                estimated_cost_usd,
            ),
        )


def get_ai_usage_summary(*, user_id: Optional[int] = None) -> Dict[str, Any]:
    with _cur() as cur:
        where = "WHERE user_id = %s" if user_id is not None else ""
        params = (int(user_id),) if user_id is not None else ()
        cur.execute(
            f"""
            SELECT
                COUNT(*),
                COALESCE(SUM(prompt_tokens), 0),
                COALESCE(SUM(completion_tokens), 0),
                COALESCE(SUM(total_tokens), 0),
                COALESCE(SUM(estimated_cost_usd), 0),
                MIN(recorded_at),
                MAX(recorded_at)
            FROM ai_usage_analytics
            {where}
            """,
            params,
        )
        row = cur.fetchone() or (0, 0, 0, 0, Decimal("0"), None, None)
    return {
        "request_count": int(row[0] or 0),
        "prompt_tokens": int(row[1] or 0),
        "completion_tokens": int(row[2] or 0),
        "total_tokens": int(row[3] or 0),
        "estimated_cost_usd": float(row[4] or 0),
        "first_recorded_at": row[5],
        "last_recorded_at": row[6],
    }


def get_ai_usage_daily_totals(*, from_ts: datetime, user_id: Optional[int] = None) -> List[Dict[str, Any]]:
    with _cur() as cur:
        conditions = ["recorded_at >= %s"]
        params: List[Any] = [from_ts]
        if user_id is not None:
            conditions.append("user_id = %s")
            params.append(int(user_id))
        where = " AND ".join(conditions)
        cur.execute(
            f"""
            SELECT
                to_char(recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
                COALESCE(SUM(total_tokens), 0) AS total_tokens,
                COALESCE(SUM(estimated_cost_usd), 0) AS estimated_cost_usd
            FROM ai_usage_analytics
            WHERE {where}
            GROUP BY day
            ORDER BY day
            """,
            params,
        )
        rows = cur.fetchall() or []
    return [
        {
            "date": str(row[0]),
            "total_tokens": int(row[1] or 0),
            "estimated_cost_usd": float(row[2] or 0),
        }
        for row in rows
    ]


def get_ai_usage_model_series(
    *,
    from_ts: datetime,
    top_n: int = 4,
    user_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    with _cur() as cur:
        conditions = ["recorded_at >= %s"]
        params: List[Any] = [from_ts]
        if user_id is not None:
            conditions.append("user_id = %s")
            params.append(int(user_id))
        where = " AND ".join(conditions)

        cur.execute(
            f"""
            SELECT model_name
            FROM ai_usage_analytics
            WHERE {where}
            GROUP BY model_name
            ORDER BY COALESCE(SUM(total_tokens), 0) DESC, model_name ASC
            LIMIT %s
            """,
            params + [max(1, int(top_n))],
        )
        top_models = [str(row[0] or "") for row in (cur.fetchall() or []) if str(row[0] or "").strip()]
        if not top_models:
            return []

        cur.execute(
            f"""
            SELECT
                model_name,
                to_char(recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
                COALESCE(SUM(total_tokens), 0) AS total_tokens
            FROM ai_usage_analytics
            WHERE {where}
              AND model_name = ANY(%s)
            GROUP BY model_name, day
            ORDER BY model_name ASC, day ASC
            """,
            params + [top_models],
        )
        rows = cur.fetchall() or []

    grouped: Dict[str, List[Dict[str, Any]]] = {name: [] for name in top_models}
    for model_name, day, total_tokens in rows:
        name = str(model_name or "")
        if name not in grouped:
            continue
        grouped[name].append({"date": str(day), "value": int(total_tokens or 0)})

    return [{"name": name, "data": grouped[name]} for name in top_models]


def get_ai_usage_top_users(*, limit: int = 5, sort_by: str = "cost") -> List[Dict[str, Any]]:
    if sort_by not in {"cost", "tokens"}:
        raise ValueError("Unsupported top-user sort")

    order_by = (
        "COALESCE(SUM(a.estimated_cost_usd), 0) DESC, COALESCE(SUM(a.total_tokens), 0) DESC, a.user_id ASC"
        if sort_by == "cost"
        else "COALESCE(SUM(a.total_tokens), 0) DESC, COALESCE(SUM(a.estimated_cost_usd), 0) DESC, a.user_id ASC"
    )
    with _cur() as cur:
        cur.execute(
            f"""
            SELECT
                a.user_id,
                COALESCE(u.display_name, '') AS display_name,
                COALESCE(u.email, '') AS email,
                COALESCE(SUM(a.total_tokens), 0) AS total_tokens,
                COALESCE(SUM(a.estimated_cost_usd), 0) AS estimated_cost_usd,
                COUNT(*) AS request_count
            FROM ai_usage_analytics a
            LEFT JOIN "user" u ON u.id = a.user_id
            WHERE a.user_id IS NOT NULL
            GROUP BY a.user_id, u.display_name, u.email
            ORDER BY {order_by}
            LIMIT %s
            """,
            (max(1, int(limit)),),
        )
        rows = cur.fetchall() or []
    return [
        {
            "user_id": int(row[0]),
            "display_name": str(row[1] or ""),
            "email": str(row[2] or ""),
            "total_tokens": int(row[3] or 0),
            "estimated_cost_usd": float(row[4] or 0),
            "request_count": int(row[5] or 0),
        }
        for row in rows
    ]


def get_ai_usage_cost_breakdown(*, dimension: str, limit: int = 6) -> List[Dict[str, Any]]:
    if dimension not in {"model_name", "purpose"}:
        raise ValueError("Unsupported breakdown dimension")

    with _cur() as cur:
        label_sql = "COALESCE(NULLIF(TRIM(model_name), ''), 'unknown')" if dimension == "model_name" else "COALESCE(NULLIF(TRIM(purpose), ''), 'unspecified')"
        cur.execute(
            f"""
            SELECT
                {label_sql} AS label,
                COALESCE(SUM(total_tokens), 0) AS total_tokens,
                COALESCE(SUM(estimated_cost_usd), 0) AS estimated_cost_usd,
                COUNT(*) AS request_count
            FROM ai_usage_analytics
            GROUP BY label
            ORDER BY COALESCE(SUM(estimated_cost_usd), 0) DESC,
                     COALESCE(SUM(total_tokens), 0) DESC,
                     label ASC
            LIMIT %s
            """,
            (max(1, int(limit)),),
        )
        rows = cur.fetchall() or []
    return [
        {
            "label": str(row[0] or ""),
            "total_tokens": int(row[1] or 0),
            "estimated_cost_usd": float(row[2] or 0),
            "request_count": int(row[3] or 0),
        }
        for row in rows
    ]
