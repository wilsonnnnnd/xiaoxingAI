from typing import Any, Dict, List, Optional
from ..session import _cur
from ..base import LogType

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

def get_recent_logs(
    limit: int = 100,
    log_type: Optional[LogType] = None,
    user_id: Optional[int] = None,
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
