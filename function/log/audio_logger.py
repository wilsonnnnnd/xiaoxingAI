import json
from typing import Optional, Dict, Any

from config.config import DATABASE_URL
from db.connection import get_connection


def _is_postgres() -> bool:
    return bool(DATABASE_URL and DATABASE_URL.startswith(("postgres://", "postgresql://")))


def log_audio_usage(
    text: str,
    duration_ms: Optional[int] = None,
    voice: Optional[str] = None,
    style: Optional[str] = None,
    rate: Optional[str] = None,
    volume: Optional[str] = None,
    length_bytes: Optional[int] = None,
    file_path: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> int:
    conn = get_connection()
    cur = conn.cursor()
    try:
        meta_val = json.dumps(metadata, ensure_ascii=False) if metadata is not None else None
        if _is_postgres():
            sql = (
                "INSERT INTO audio_usage (text, duration_ms, voice, style, rate, volume, length_bytes, file_path, metadata)"
                " VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id"
            )
            cur.execute(sql, (text, duration_ms, voice, style, rate, volume, length_bytes, file_path, meta_val))
            new_id = cur.fetchone()[0]
        else:
            sql = (
                "INSERT INTO audio_usage (text, duration_ms, voice, style, rate, volume, length_bytes, file_path, metadata)"
                " VALUES (?,?,?,?,?,?,?,?,?)"
            )
            cur.execute(sql, (text, duration_ms, voice, style, rate, volume, length_bytes, file_path, meta_val))
            new_id = cur.lastrowid

        conn.commit()
        return new_id
    finally:
        cur.close()
        conn.close()
