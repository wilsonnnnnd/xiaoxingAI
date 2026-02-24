import json
from typing import Optional, Dict, Any

from config.config import DATABASE_URL
from db.connection import get_connection
from datetime import datetime


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


def _fetch_metadata(cur, audio_id: int):
    try:
        cur.execute("SELECT metadata FROM audio_usage WHERE id = %s" if _is_postgres() else "SELECT metadata FROM audio_usage WHERE id = ?", (audio_id,))
        row = cur.fetchone()
        if not row:
            return None
        val = row[0]
        if val is None:
            return None
        try:
            return json.loads(val) if isinstance(val, str) else val
        except Exception:
            return None
    except Exception:
        return None


def update_audio_metadata(audio_id: int, updates: Dict[str, Any]) -> None:
    """Merge `updates` into the existing metadata JSON for `audio_id`.

    This performs a read-modify-write that works for both SQLite and Postgres.
    """
    if audio_id is None:
        return

    conn = get_connection()
    cur = conn.cursor()
    try:
        existing = _fetch_metadata(cur, audio_id) or {}
        if not isinstance(existing, dict):
            existing = {}
        # shallow merge
        existing.update(updates or {})
        meta_val = json.dumps(existing, ensure_ascii=False)
        if _is_postgres():
            sql = "UPDATE audio_usage SET metadata = %s WHERE id = %s"
            cur.execute(sql, (meta_val, audio_id))
        else:
            sql = "UPDATE audio_usage SET metadata = ? WHERE id = ?"
            cur.execute(sql, (meta_val, audio_id))
        conn.commit()
        # If this update includes playback info, also append a play event to audio_tone
        try:
            if updates and ("played" in updates or "played_at" in updates or "ended_at" in updates):
                try:
                    from function.log.tone_logger import append_play_event
                    status = "played" if updates.get("played", True) else "failed"
                    event = {
                        "status": status,
                        "started_at": updates.get("started_at"),
                        "ended_at": updates.get("played_at") or updates.get("ended_at") or datetime.utcnow().isoformat(),
                        "source": updates.get("source", "player")
                    }
                    append_play_event(audio_id, event)
                except Exception:
                    pass
        except Exception:
            pass
    finally:
        cur.close()
        conn.close()
