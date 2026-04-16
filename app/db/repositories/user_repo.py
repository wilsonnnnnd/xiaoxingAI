from typing import Any, Dict, List, Optional
from ..session import _cur
from app.core import config

def _row_to_user(r: tuple) -> Dict[str, Any]:
    """Public-safe user dict (no password_hash)."""
    return {
        "id": r[0], "email": r[1], "display_name": r[2], "role": r[3],
        "worker_enabled": r[4], "min_priority": r[5],
        "max_emails_per_run": r[6], "poll_interval": r[7],
        "gmail_poll_query": r[8],
        "created_at": str(r[9]), "updated_at": str(r[10]),
    }

def _row_to_user_full(r: tuple) -> Dict[str, Any]:
    """Full user dict including password_hash (for internal auth use)."""
    return {
        "id": r[0], "email": r[1], "display_name": r[2], "role": r[3],
        "password_hash": r[4], "worker_enabled": r[5],
        "min_priority": r[6], "max_emails_per_run": r[7], "poll_interval": r[8],
        "gmail_poll_query": r[9],
        "created_at": str(r[10]), "updated_at": str(r[11]),
    }


_SELECT_USER_FULL = """
    SELECT
        u.id, u.email, u.display_name, u.role,
        u.password_hash,
        COALESCE(s.worker_enabled, u.worker_enabled) AS worker_enabled,
        COALESCE(s.min_priority, u.min_priority) AS min_priority,
        COALESCE(s.max_emails_per_run, u.max_emails_per_run) AS max_emails_per_run,
        COALESCE(s.poll_interval, u.poll_interval) AS poll_interval,
        COALESCE(NULLIF(s.gmail_poll_query, ''), %s) AS gmail_poll_query,
        u.created_at, u.updated_at
    FROM "user" u
    LEFT JOIN user_settings s ON s.user_id = u.id
"""


_SELECT_USER_PUBLIC = """
    SELECT
        u.id, u.email, u.display_name, u.role,
        COALESCE(s.worker_enabled, u.worker_enabled) AS worker_enabled,
        COALESCE(s.min_priority, u.min_priority) AS min_priority,
        COALESCE(s.max_emails_per_run, u.max_emails_per_run) AS max_emails_per_run,
        COALESCE(s.poll_interval, u.poll_interval) AS poll_interval,
        COALESCE(NULLIF(s.gmail_poll_query, ''), %s) AS gmail_poll_query,
        u.created_at, u.updated_at
    FROM "user" u
    LEFT JOIN user_settings s ON s.user_id = u.id
"""

def create_user(
    email: str,
    display_name: Optional[str] = None,
    role: str = "user",
    password_hash: Optional[str] = None,
) -> Dict[str, Any]:
    with _cur() as cur:
        cur.execute(
            """INSERT INTO "user" (email, display_name, role, password_hash)
               VALUES (%s, %s, %s, %s)
               RETURNING id""",
            (email, display_name, role, password_hash),
        )
        user_id = int(cur.fetchone()[0])

        cur.execute(
            """INSERT INTO user_settings
               (user_id, worker_enabled, min_priority, max_emails_per_run, poll_interval, gmail_poll_query)
               VALUES (%s, %s, %s, %s, %s, %s)
               ON CONFLICT (user_id) DO NOTHING""",
            (user_id, False, "medium", 5, 300, config.GMAIL_POLL_QUERY),
        )

        cur.execute(
            _SELECT_USER_PUBLIC + " WHERE u.id = %s",
            (config.GMAIL_POLL_QUERY, user_id),
        )
        return _row_to_user(cur.fetchone())

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            _SELECT_USER_FULL + " WHERE u.email = %s",
            (config.GMAIL_POLL_QUERY, email),
        )
        row = cur.fetchone()
        return _row_to_user_full(row) if row else None

def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            _SELECT_USER_FULL + " WHERE u.id = %s",
            (config.GMAIL_POLL_QUERY, user_id),
        )
        row = cur.fetchone()
        return _row_to_user_full(row) if row else None

def list_users() -> List[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            _SELECT_USER_FULL + " ORDER BY u.id",
            (config.GMAIL_POLL_QUERY,),
        )
        return [_row_to_user_full(r) for r in cur.fetchall()]

def list_worker_enabled_users() -> List[Dict[str, Any]]:
    """返回所有 worker_enabled=TRUE 的用户（启动时用于恢复 Worker）。"""
    with _cur() as cur:
        cur.execute(
            _SELECT_USER_FULL + " WHERE COALESCE(s.worker_enabled, u.worker_enabled) = TRUE ORDER BY u.id",
            (config.GMAIL_POLL_QUERY,),
        )
        return [_row_to_user_full(r) for r in cur.fetchall()]


def count_users() -> int:
    with _cur() as cur:
        cur.execute("""SELECT COUNT(*) FROM "user" """)
        row = cur.fetchone()
        return int(row[0] or 0) if row else 0

def update_user(user_id: int, **fields: Any) -> Optional[Dict[str, Any]]:
    """动态更新用户字段（只更新传入的字段）。"""
    with _cur() as cur:
        user_allowed = {"display_name", "role", "password_hash"}
        settings_allowed = {
            "worker_enabled", "min_priority", "max_emails_per_run", "poll_interval", "gmail_poll_query",
        }

        user_updates = {k: v for k, v in fields.items() if k in user_allowed}
        settings_updates = {k: v for k, v in fields.items() if k in settings_allowed}

        if user_updates:
            set_clause = ", ".join(f"{k} = %s" for k in user_updates)
            values = list(user_updates.values()) + [user_id]
            cur.execute(
                f"""UPDATE "user" SET {set_clause}, updated_at = NOW()
                    WHERE id = %s""",
                values,
            )

        if settings_updates:
            cols = ["user_id", *settings_updates.keys()]
            placeholders = ", ".join(["%s"] * len(cols))
            update_clause = ", ".join(f"{k} = EXCLUDED.{k}" for k in settings_updates.keys())
            cur.execute(
                f"""INSERT INTO user_settings ({", ".join(cols)})
                    VALUES ({placeholders})
                    ON CONFLICT (user_id) DO UPDATE
                    SET {update_clause}, updated_at = NOW()""",
                [user_id, *settings_updates.values()],
            )

        cur.execute(
            _SELECT_USER_FULL + " WHERE u.id = %s",
            (config.GMAIL_POLL_QUERY, user_id),
        )
        row = cur.fetchone()
        return _row_to_user_full(row) if row else None
