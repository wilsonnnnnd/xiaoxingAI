import json
from typing import Optional, Dict, Any

from config.config import DATABASE_URL
from db.connection import get_connection


def _is_postgres() -> bool:
    return bool(DATABASE_URL and DATABASE_URL.startswith(("postgres://", "postgresql://")))


def log_tone(audio_id: int, tone: Optional[str], score: Optional[float] = None, metadata: Optional[Dict[str, Any]] = None) -> int:
    """Insert a tone row linked to `audio_id` and return the new id."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        meta_val = json.dumps(metadata, ensure_ascii=False) if metadata is not None else None
        if _is_postgres():
            sql = (
                "INSERT INTO audio_tone (audio_id, tone, score, metadata) VALUES (%s,%s,%s,%s) RETURNING id"
            )
            cur.execute(sql, (audio_id, tone, score, meta_val))
            new_id = cur.fetchone()[0]
        else:
            sql = (
                "INSERT INTO audio_tone (audio_id, tone, score, metadata) VALUES (?,?,?,?)"
            )
            cur.execute(sql, (audio_id, tone, score, meta_val))
            new_id = cur.lastrowid

        conn.commit()
        return new_id
    finally:
        cur.close()
        conn.close()


def append_play_event(audio_id: int, event: Dict[str, Any]) -> None:
    """Append a playback `event` to the most recent audio_tone.metadata.play_events for `audio_id`.

    If no tone row exists for the given audio_id, create one with `tone=None` and metadata containing the event list.
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        # find most recent tone row for audio_id
        if _is_postgres():
            cur.execute("SELECT id, metadata FROM audio_tone WHERE audio_id = %s ORDER BY created_at DESC LIMIT 1", (audio_id,))
        else:
            cur.execute("SELECT id, metadata FROM audio_tone WHERE audio_id = ? ORDER BY created_at DESC LIMIT 1", (audio_id,))
        row = cur.fetchone()
        if row:
            row_id = row[0]
            raw = row[1]
            try:
                meta = json.loads(raw) if isinstance(raw, str) and raw else (raw or {})
            except Exception:
                meta = {}
            if not isinstance(meta, dict):
                meta = {}
            play_events = meta.get("play_events") or []
            play_events.append(event)
            meta["play_events"] = play_events
            meta_val = json.dumps(meta, ensure_ascii=False)
            if _is_postgres():
                cur.execute("UPDATE audio_tone SET metadata = %s WHERE id = %s", (meta_val, row_id))
            else:
                cur.execute("UPDATE audio_tone SET metadata = ? WHERE id = ?", (meta_val, row_id))
        else:
            # insert a new tone row with the play_events list
            meta = {"play_events": [event]}
            meta_val = json.dumps(meta, ensure_ascii=False)
            if _is_postgres():
                cur.execute("INSERT INTO audio_tone (audio_id, tone, score, metadata) VALUES (%s,%s,%s,%s)", (audio_id, None, None, meta_val))
            else:
                cur.execute("INSERT INTO audio_tone (audio_id, tone, score, metadata) VALUES (?,?,?,?)", (audio_id, None, None, meta_val))

        conn.commit()
    finally:
        cur.close()
        conn.close()
