import json
from typing import Optional, Dict, Any

from config.config import DATABASE_URL
from db.connection import get_connection


def _is_postgres() -> bool:
    return bool(DATABASE_URL and DATABASE_URL.startswith(("postgres://", "postgresql://")))


def log(level: str, message: str, context: Optional[Dict[str, Any]] = None) -> int:
    """Insert a row into `logs` and return the new id."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        ctx = json.dumps(context, ensure_ascii=False) if context is not None else None
        if _is_postgres():
            sql = "INSERT INTO logs (level, message, context) VALUES (%s,%s,%s) RETURNING id"
            cur.execute(sql, (level, message, ctx))
            new_id = cur.fetchone()[0]
        else:
            sql = "INSERT INTO logs (level, message, context) VALUES (?,?,?)"
            cur.execute(sql, (level, message, ctx))
            new_id = cur.lastrowid

        conn.commit()
        return new_id
    finally:
        cur.close()
        conn.close()
