import json
from typing import Optional, Dict, Any

from config.config import DATABASE_URL
from db.connection import get_connection


def _is_postgres() -> bool:
    return bool(DATABASE_URL and DATABASE_URL.startswith(("postgres://", "postgresql://")))


def log_api_call(
    user_input: str,
    prompt: str,
    response: str,
    response_tokens: Optional[int] = None,
    model: Optional[str] = None,
    duration_ms: Optional[int] = None,
    status: str = "ok",
    metadata: Optional[Dict[str, Any]] = None,
) -> int:
    """Insert a row into `api_calls` and return the new id."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        meta_val = json.dumps(metadata, ensure_ascii=False) if metadata is not None else None
        if _is_postgres():
            sql = (
                "INSERT INTO api_calls (user_input, prompt, response, response_tokens, model, duration_ms, status, metadata)"
                " VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id"
            )
            cur.execute(sql, (user_input, prompt, response, response_tokens, model, duration_ms, status, meta_val))
            new_id = cur.fetchone()[0]
        else:
            sql = (
                "INSERT INTO api_calls (user_input, prompt, response, response_tokens, model, duration_ms, status, metadata)"
                " VALUES (?,?,?,?,?,?,?,?)"
            )
            cur.execute(sql, (user_input, prompt, response, response_tokens, model, duration_ms, status, meta_val))
            new_id = cur.lastrowid

        conn.commit()
        return new_id
    finally:
        cur.close()
        conn.close()
