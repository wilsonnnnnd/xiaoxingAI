from typing import Any, Dict, List, Optional
from ..session import _cur

def _row_to_prompt(r: tuple) -> Dict[str, Any]:
    return {
        "id": r[0], "user_id": r[1], "name": r[2], "type": r[3],
        "content": r[4], "is_default": r[5],
        "created_at": str(r[6]), "updated_at": str(r[7]),
        "meta": r[8] if len(r) > 8 else None,
    }

def get_prompts(user_id: Optional[int] = None, ptype: Optional[str] = None) -> List[Dict[str, Any]]:
    """返回 user_prompts 表中的提示词。user_id=None 时返回全部（管理员视图）。"""
    with _cur() as cur:
        conditions: List[str] = []
        params: List[Any] = []
        if user_id is not None:
            conditions.append("user_id = %s")
            params.append(user_id)
        if ptype:
            conditions.append("type = %s")
            params.append(ptype)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        cur.execute(
            f"SELECT id, user_id, name, type, content, is_default, created_at, updated_at, meta"
            f" FROM user_prompts {where} ORDER BY id",
            params,
        )
        return [_row_to_prompt(r) for r in cur.fetchall()]

def get_prompt(prompt_id: int) -> Optional[Dict[str, Any]]:
    """按 ID 查找 Prompt：先查 user_prompts，再查 system_prompts。"""
    with _cur() as cur:
        cur.execute(
            "SELECT id, user_id, name, type, content, is_default, created_at, updated_at, meta"
            " FROM user_prompts WHERE id = %s",
            (prompt_id,),
        )
        row = cur.fetchone()
        if row:
            return _row_to_prompt(row)
        cur.execute(
            "SELECT id, name, type, content, is_default, created_at, updated_at"
            " FROM system_prompts WHERE id = %s",
            (prompt_id,),
        )
        row = cur.fetchone()
        if row:
            return {
                "id": row[0], "user_id": None, "name": row[1], "type": row[2],
                "content": row[3], "is_default": row[4],
                "created_at": str(row[5]), "updated_at": str(row[6]),
            }
        return None

def create_prompt(
    user_id: int,
    name: str,
    ptype: str,
    content: str,
    is_default: bool = False,
    meta: Optional[str] = None,
) -> Dict[str, Any]:
    with _cur() as cur:
        if is_default:
            cur.execute(
                "UPDATE user_prompts SET is_default = FALSE WHERE user_id = %s AND type = %s",
                (user_id, ptype),
            )
        cur.execute(
            """INSERT INTO user_prompts (user_id, name, type, content, is_default, meta)
               VALUES (%s, %s, %s, %s, %s, %s)
               RETURNING id, user_id, name, type, content, is_default, created_at, updated_at, meta""",
            (user_id, name, ptype, content, is_default, meta),
        )
        return _row_to_prompt(cur.fetchone())

def update_prompt(prompt_id: int, **fields: Any) -> Optional[Dict[str, Any]]:
    allowed = {"name", "content", "is_default"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return get_prompt(prompt_id)
    existing = get_prompt(prompt_id)
    if existing is None:
        return None
    table = "user_prompts" if existing.get("user_id") is not None else "system_prompts"
    with _cur() as cur:
        if updates.get("is_default") and table == "user_prompts":
            cur.execute(
                "UPDATE user_prompts SET is_default = FALSE"
                " WHERE user_id = %s AND type = %s",
                (existing["user_id"], existing["type"]),
            )
        set_clause = ", ".join(f"{k} = %s" for k in updates)
        values = list(updates.values()) + [prompt_id]
        cur.execute(
            f"UPDATE {table} SET {set_clause}, updated_at = NOW() WHERE id = %s",
            values,
        )
    return get_prompt(prompt_id)

def delete_prompt(prompt_id: int) -> bool:
    """删除 user_prompts 中的提示词。系统提示词不能通过此函数删除。"""
    with _cur() as cur:
        cur.execute("DELETE FROM user_prompts WHERE id = %s RETURNING id", (prompt_id,))
        return cur.fetchone() is not None

def get_user_prompt(user_id: int, filename: str) -> Optional[str]:
    """用户专属 Prompt 内容（来自 user_prompts 表）；不存在时返回 None。"""
    with _cur() as cur:
        cur.execute(
            "SELECT content FROM user_prompts WHERE user_id = %s AND name = %s",
            (user_id, filename),
        )
        row = cur.fetchone()
        return row[0] if row else None

def save_user_prompt(user_id: int, filename: str, content: str) -> None:
    """Upsert 用户专属 Prompt 到 user_prompts 表（UPDATE 优先，行不存在时 INSERT）。"""
    with _cur() as cur:
        cur.execute(
            "UPDATE user_prompts SET content = %s, updated_at = NOW()"
            " WHERE user_id = %s AND name = %s",
            (content, user_id, filename),
        )
        if cur.rowcount == 0:
            cur.execute(
                "INSERT INTO user_prompts (user_id, name, type, content, is_default)"
                " VALUES (%s, %s, %s, %s, FALSE)",
                (user_id, filename, filename, content),
            )

def delete_user_prompt(user_id: int, filename: str) -> bool:
    """删除用户专属 Prompt；成功返回 True，不存在返回 False。"""
    with _cur() as cur:
        cur.execute(
            "DELETE FROM user_prompts WHERE user_id = %s AND name = %s RETURNING id",
            (user_id, filename),
        )
        return cur.fetchone() is not None

def list_user_prompt_names(user_id: int) -> List[str]:
    """返回用户在 user_prompts 中保存过的所有 Prompt 名称。"""
    with _cur() as cur:
        cur.execute(
            "SELECT name FROM user_prompts WHERE user_id = %s ORDER BY name",
            (user_id,),
        )
        return [r[0] for r in cur.fetchall()]
