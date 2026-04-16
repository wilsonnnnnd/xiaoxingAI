from typing import Any, Dict, List, Optional
from ..session import _cur
from ..base import LogType
from psycopg2.extras import execute_values

def insert_log(
    ts: str,
    level: str,
    msg: str,
    log_type: LogType = LogType.EMAIL,
    tokens: int = 0,
    user_id: Optional[int] = None,
) -> None:
    with _cur() as cur:
        cur.execute(
            "INSERT INTO log (user_id, ts, level, log_type, tokens, msg)"
            " VALUES (%s, %s, %s, %s, %s, %s)",
            (user_id, ts, level, str(log_type.value), tokens, msg),
        )


def insert_logs_bulk(rows: List[Dict[str, Any]]) -> None:
    if not rows:
        return
    values = [
        (
            r.get("user_id"),
            r["ts"],
            r["level"],
            r["log_type"],
            int(r.get("tokens") or 0),
            r["msg"],
        )
        for r in rows
    ]
    with _cur() as cur:
        execute_values(
            cur,
            "INSERT INTO log (user_id, ts, level, log_type, tokens, msg) VALUES %s",
            values,
            page_size=1000,
        )

def get_recent_logs(
    limit: int = 20,
    log_type: Optional[LogType] = None,
    user_id: Optional[int] = None,
    before_id: Optional[int] = None,
    from_ts: Optional[str] = None,
    to_ts: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """返回最近日志。user_id=None 时管理员视图（返回全部含系统日志），否则过滤当前用户。"""
    with _cur() as cur:
        conditions: List[str] = []
        params: List[Any] = []
        if log_type is not None:
            conditions.append("log_type = %s")
            params.append(str(log_type.value))
        if user_id is not None:
            conditions.append("user_id = %s")
            params.append(user_id)
        if before_id is not None:
            conditions.append("id < %s")
            params.append(before_id)
        if from_ts is not None:
            conditions.append("ts >= %s")
            params.append(from_ts)
        if to_ts is not None:
            conditions.append("ts <= %s")
            params.append(to_ts)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        params.append(limit)
        cur.execute(
            f"SELECT id, user_id, ts, level, log_type, tokens, msg"
            f" FROM log {where} ORDER BY id DESC LIMIT %s",
            params,
        )
        rows = cur.fetchall()
    return [
        {
            "id": r[0], "user_id": r[1], "ts": r[2],
            "level": r[3], "log_type": r[4], "tokens": r[5], "msg": r[6],
        }
        for r in reversed(rows)
    ]

def clear_logs(log_type: Optional[str] = None, user_id: Optional[int] = None) -> int:
    """清空日志。可按 log_type / user_id 过滤。返回删除条数。"""
    with _cur() as cur:
        conditions: List[str] = []
        params: List[Any] = []
        if log_type:
            conditions.append("log_type = %s")
            params.append(log_type)
        if user_id is not None:
            conditions.append("user_id = %s")
            params.append(user_id)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        cur.execute(f"SELECT COUNT(*) FROM log {where}", params)
        count = cur.fetchone()[0]
        cur.execute(f"DELETE FROM log {where}", params)
    return count

def cleanup_old_logs(keep: int = 10_000) -> None:
    with _cur() as cur:
        cur.execute(
            "DELETE FROM log WHERE id NOT IN"
            " (SELECT id FROM log ORDER BY id DESC LIMIT %s)",
            (keep,),
        )
