from typing import Any, Dict, List, Optional

from ..session import _cur


def _row_to_template(r: tuple) -> Dict[str, Any]:
    return {
        "id": r[0],
        "user_id": r[1],
        "name": r[2],
        "body_template": r[3],
        "closing": r[4],
        "is_default": bool(r[5]),
        "created_at": str(r[6]),
        "updated_at": str(r[7]),
    }


def list_reply_templates(user_id: int) -> List[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            """SELECT id, user_id, name, body_template, closing, is_default, created_at, updated_at
               FROM reply_templates
               WHERE user_id = %s
               ORDER BY is_default DESC, updated_at DESC, id DESC""",
            (user_id,),
        )
        return [_row_to_template(r) for r in cur.fetchall()]


def get_reply_template(template_id: int, user_id: int) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            """SELECT id, user_id, name, body_template, closing, is_default, created_at, updated_at
               FROM reply_templates
               WHERE id = %s AND user_id = %s""",
            (template_id, user_id),
        )
        row = cur.fetchone()
        return _row_to_template(row) if row else None


def create_reply_template(
    *,
    user_id: int,
    name: str,
    body_template: str,
    closing: Optional[str] = None,
    is_default: bool = False,
) -> Dict[str, Any]:
    with _cur() as cur:
        if is_default:
            cur.execute(
                "UPDATE reply_templates SET is_default = FALSE, updated_at = NOW() WHERE user_id = %s AND is_default = TRUE",
                (user_id,),
            )

        cur.execute(
            """INSERT INTO reply_templates (user_id, name, body_template, closing, is_default)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING id, user_id, name, body_template, closing, is_default, created_at, updated_at""",
            (user_id, name, body_template, closing, bool(is_default)),
        )
        tpl = _row_to_template(cur.fetchone())

        if is_default:
            cur.execute(
                """INSERT INTO reply_format_settings (user_id, default_template_id, signature)
                   VALUES (%s, %s, '')
                   ON CONFLICT (user_id)
                   DO UPDATE SET default_template_id = EXCLUDED.default_template_id, updated_at = NOW()""",
                (user_id, int(tpl["id"])),
            )

        return tpl


def update_reply_template(template_id: int, user_id: int, **fields: Any) -> Optional[Dict[str, Any]]:
    allowed = {"name", "body_template", "closing", "is_default"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return get_reply_template(template_id, user_id)

    with _cur() as cur:
        if "is_default" in updates and bool(updates["is_default"]):
            cur.execute(
                "UPDATE reply_templates SET is_default = FALSE, updated_at = NOW() WHERE user_id = %s AND is_default = TRUE",
                (user_id,),
            )

        set_clause = ", ".join(f"{k} = %s" for k in updates)
        values = list(updates.values()) + [template_id, user_id]
        cur.execute(
            f"""UPDATE reply_templates
                 SET {set_clause}, updated_at = NOW()
               WHERE id = %s AND user_id = %s
               RETURNING id, user_id, name, body_template, closing, is_default, created_at, updated_at""",
            values,
        )
        row = cur.fetchone()
        if not row:
            return None
        tpl = _row_to_template(row)

        if "is_default" in updates and bool(updates["is_default"]):
            cur.execute(
                """INSERT INTO reply_format_settings (user_id, default_template_id, signature)
                   VALUES (%s, %s, '')
                   ON CONFLICT (user_id)
                   DO UPDATE SET default_template_id = EXCLUDED.default_template_id, updated_at = NOW()""",
                (user_id, int(tpl["id"])),
            )

        return tpl


def delete_reply_template(template_id: int, user_id: int) -> bool:
    with _cur() as cur:
        cur.execute(
            "SELECT id, is_default FROM reply_templates WHERE id = %s AND user_id = %s",
            (template_id, user_id),
        )
        row = cur.fetchone()
        if not row:
            return False
        was_default = bool(row[1])

        cur.execute("DELETE FROM reply_templates WHERE id = %s AND user_id = %s", (template_id, user_id))

        if was_default:
            cur.execute(
                "UPDATE reply_format_settings SET default_template_id = NULL, updated_at = NOW() WHERE user_id = %s",
                (user_id,),
            )
        return True


def get_reply_format_settings(user_id: int) -> Dict[str, Any]:
    with _cur() as cur:
        cur.execute(
            "SELECT user_id, default_template_id, signature, updated_at FROM reply_format_settings WHERE user_id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            return {"user_id": user_id, "default_template_id": None, "signature": "", "updated_at": None}
        return {
            "user_id": row[0],
            "default_template_id": row[1],
            "signature": row[2] or "",
            "updated_at": str(row[3]) if row[3] is not None else None,
        }


def upsert_reply_format_settings(
    *,
    user_id: int,
    signature: Optional[str] = None,
    default_template_id: Optional[int] = None,
) -> Dict[str, Any]:
    with _cur() as cur:
        cur.execute(
            "SELECT signature, default_template_id FROM reply_format_settings WHERE user_id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        cur_signature = row[0] if row else ""
        cur_default = row[1] if row else None
        next_signature = cur_signature if signature is None else str(signature)
        next_default = cur_default if default_template_id is None else default_template_id

        cur.execute(
            """INSERT INTO reply_format_settings (user_id, signature, default_template_id)
               VALUES (%s, %s, %s)
               ON CONFLICT (user_id)
               DO UPDATE SET signature = EXCLUDED.signature, default_template_id = EXCLUDED.default_template_id, updated_at = NOW()
               RETURNING user_id, default_template_id, signature, updated_at""",
            (user_id, next_signature, next_default),
        )
        saved = cur.fetchone()
        return {
            "user_id": saved[0],
            "default_template_id": saved[1],
            "signature": saved[2] or "",
            "updated_at": str(saved[3]) if saved[3] is not None else None,
        }

