import secrets
from typing import Any, Dict, List, Optional

from ..session import _cur


def create_register_invite(
    created_by: Optional[int],
    ttl_seconds: int = 86400,
    note: Optional[str] = None,
) -> Dict[str, Any]:
    ttl = int(ttl_seconds or 0)
    if ttl <= 0:
        ttl = 86400
    if ttl > 60 * 60 * 24 * 30:
        ttl = 60 * 60 * 24 * 30

    for _ in range(6):
        code = secrets.token_urlsafe(18).replace("-", "").replace("_", "")[:24]
        with _cur() as cur:
            cur.execute(
                """
                INSERT INTO register_invites (code, created_by, note, expires_at)
                VALUES (%s, %s, %s, NOW() + (%s || ' seconds')::interval)
                RETURNING id, code, created_by, note, created_at, expires_at, used_at, used_by, used_email, used_ip, revoked_at
                """,
                (code, created_by, (note or None), ttl),
            )
            row = cur.fetchone()
            if row:
                return {
                    "id": int(row[0]),
                    "code": row[1],
                    "created_by": row[2],
                    "note": row[3],
                    "created_at": str(row[4]),
                    "expires_at": str(row[5]),
                    "used_at": str(row[6]) if row[6] else None,
                    "used_by": row[7],
                    "used_email": row[8],
                    "used_ip": row[9],
                    "revoked_at": str(row[10]) if row[10] else None,
                }
    raise RuntimeError("failed to generate invite code")


def list_register_invites(limit: int = 50) -> List[Dict[str, Any]]:
    n = int(limit or 0)
    if n <= 0:
        n = 50
    if n > 200:
        n = 200
    with _cur() as cur:
        cur.execute(
            """
            SELECT
              i.id, i.code, i.created_by, cu.email AS created_by_email,
              i.note, i.created_at, i.expires_at,
              i.used_at, i.used_by, uu.email AS used_by_email,
              i.used_email, i.used_ip, i.revoked_at
            FROM register_invites i
            LEFT JOIN "user" cu ON cu.id = i.created_by
            LEFT JOIN "user" uu ON uu.id = i.used_by
            ORDER BY i.id DESC
            LIMIT %s
            """,
            (n,),
        )
        out: List[Dict[str, Any]] = []
        for r in cur.fetchall():
            out.append(
                {
                    "id": int(r[0]),
                    "code": r[1],
                    "created_by": r[2],
                    "created_by_email": r[3],
                    "note": r[4],
                    "created_at": str(r[5]),
                    "expires_at": str(r[6]),
                    "used_at": str(r[7]) if r[7] else None,
                    "used_by": r[8],
                    "used_by_email": r[9],
                    "used_email": r[10],
                    "used_ip": r[11],
                    "revoked_at": str(r[12]) if r[12] else None,
                }
            )
        return out


def consume_register_invite(code: str, used_email: str, used_ip: str) -> bool:
    c = (code or "").strip()
    if not c:
        return False
    with _cur() as cur:
        cur.execute(
            """
            UPDATE register_invites
            SET used_at = NOW(), used_email = %s, used_ip = %s
            WHERE code = %s
              AND revoked_at IS NULL
              AND used_at IS NULL
              AND expires_at > NOW()
            """,
            (used_email, used_ip, c),
        )
        return cur.rowcount == 1


def finalize_register_invite(code: str, used_by: int) -> None:
    c = (code or "").strip()
    if not c:
        return
    with _cur() as cur:
        cur.execute(
            """
            UPDATE register_invites
            SET used_by = %s
            WHERE code = %s
              AND used_at IS NOT NULL
              AND used_by IS NULL
            """,
            (int(used_by), c),
        )


def release_register_invite(code: str, used_email: str) -> None:
    c = (code or "").strip()
    if not c:
        return
    with _cur() as cur:
        cur.execute(
            """
            UPDATE register_invites
            SET used_at = NULL, used_email = NULL, used_ip = NULL
            WHERE code = %s
              AND used_by IS NULL
              AND used_email = %s
              AND used_at >= (NOW() - INTERVAL '2 minutes')
            """,
            (c, (used_email or "").strip().lower()),
        )


def revoke_register_invite(code: str) -> bool:
    c = (code or "").strip()
    if not c:
        return False
    with _cur() as cur:
        cur.execute(
            """
            UPDATE register_invites
            SET revoked_at = NOW()
            WHERE code = %s
              AND revoked_at IS NULL
              AND used_at IS NULL
            """,
            (c,),
        )
        return cur.rowcount == 1

