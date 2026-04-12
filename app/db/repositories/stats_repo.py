from typing import Any, Dict, Optional
from ..session import _cur

def get_worker_stats(user_id: Optional[int] = None) -> Dict[str, Any]:
    """返回累积统计（SUM）。user_id=None 返回全局合计。"""
    with _cur() as cur:
        where = "WHERE user_id = %s" if user_id is not None else ""
        params = (user_id,) if user_id is not None else ()
        cur.execute(
            f"""SELECT
                    COALESCE(SUM(total_sent), 0),
                    COALESCE(SUM(total_fetched), 0),
                    COALESCE(SUM(total_errors), 0),
                    COALESCE(SUM(total_tokens), 0),
                    COALESCE(SUM(runtime_secs), 0),
                    (SELECT last_poll FROM worker_stats {where} ORDER BY id DESC LIMIT 1)
                FROM worker_stats {where}""",
            params + params,
        )
        row = cur.fetchone()
    return {
        "total_sent":         row[0],
        "total_fetched":      row[1],
        "total_errors":       row[2],
        "total_tokens":       row[3],
        "total_runtime_secs": row[4],
        "last_poll":          row[5],
    }

def save_worker_stats(
    started_at: str,
    total_sent: int,
    total_fetched: int,
    total_errors: int,
    total_tokens: int,
    runtime_secs: int,
    last_poll: Optional[str],
    user_id: Optional[int] = None,
) -> None:
    from ..session import _TS_EXPR
    with _cur() as cur:
        cur.execute(
            f"""INSERT INTO worker_stats
                   (user_id, started_at, stopped_at, total_sent, total_fetched,
                    total_errors, total_tokens, runtime_secs, last_poll)
               VALUES (%s, %s, {_TS_EXPR}, %s, %s, %s, %s, %s, %s)""",
            (user_id, started_at, total_sent, total_fetched,
             total_errors, total_tokens, runtime_secs, last_poll),
        )
