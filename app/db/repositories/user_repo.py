from typing import Any, Dict, List, Optional
from ..session import _cur

def _row_to_user(r: tuple) -> Dict[str, Any]:
    """Public-safe user dict (no password_hash)."""
    return {
        "id": r[0], "email": r[1], "display_name": r[2], "role": r[3],
        "worker_enabled": r[4], "min_priority": r[5],
        "max_emails_per_run": r[6], "poll_interval": r[7],
        "created_at": str(r[8]), "updated_at": str(r[9]),
    }

def _row_to_user_full(r: tuple) -> Dict[str, Any]:
    """Full user dict including password_hash (for internal auth use)."""
    return {
        "id": r[0], "email": r[1], "display_name": r[2], "role": r[3],
        "password_hash": r[4], "worker_enabled": r[5],
        "min_priority": r[6], "max_emails_per_run": r[7], "poll_interval": r[8],
        "created_at": str(r[9]), "updated_at": str(r[10]),
    }

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
               RETURNING id, email, display_name, role, worker_enabled,
                         min_priority, max_emails_per_run, poll_interval,
                         created_at, updated_at""",
            (email, display_name, role, password_hash),
        )
        return _row_to_user(cur.fetchone())

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            """SELECT id, email, display_name, role, password_hash, worker_enabled,
                      min_priority, max_emails_per_run, poll_interval,
                      created_at, updated_at
               FROM "user" WHERE email = %s""",
            (email,),
        )
        row = cur.fetchone()
        return _row_to_user_full(row) if row else None

def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            """SELECT id, email, display_name, role, password_hash, worker_enabled,
                      min_priority, max_emails_per_run, poll_interval,
                      created_at, updated_at
               FROM "user" WHERE id = %s""",
            (user_id,),
        )
        row = cur.fetchone()
        return _row_to_user_full(row) if row else None

def list_users() -> List[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            """SELECT id, email, display_name, role, password_hash, worker_enabled,
                      min_priority, max_emails_per_run, poll_interval,
                      created_at, updated_at
               FROM "user" ORDER BY id"""
        )
        return [_row_to_user_full(r) for r in cur.fetchall()]

def list_worker_enabled_users() -> List[Dict[str, Any]]:
    """返回所有 worker_enabled=TRUE 的用户（启动时用于恢复 Worker）。"""
    with _cur() as cur:
        cur.execute(
            """SELECT id, email, display_name, role, password_hash, worker_enabled,
                      min_priority, max_emails_per_run, poll_interval,
                      created_at, updated_at
               FROM "user" WHERE worker_enabled = TRUE ORDER BY id"""
        )
        return [_row_to_user_full(r) for r in cur.fetchall()]

def update_user(user_id: int, **fields: Any) -> Optional[Dict[str, Any]]:
    """动态更新用户字段（只更新传入的字段）。"""
    allowed = {
        "display_name", "role", "password_hash", "worker_enabled",
        "min_priority", "max_emails_per_run", "poll_interval",
    }
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return get_user_by_id(user_id)
    
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    values = list(updates.values()) + [user_id]
    with _cur() as cur:
        cur.execute(
            f"""UPDATE "user" SET {set_clause}, updated_at = NOW()
                WHERE id = %s
                RETURNING id, email, display_name, role, password_hash, worker_enabled,
                          min_priority, max_emails_per_run, poll_interval,
                          created_at, updated_at""",
            values,
        )
        row = cur.fetchone()
        return _row_to_user_full(row) if row else None
