from typing import Any, Dict, List, Optional
from ..session import _cur

def _row_to_bot(r: tuple) -> Dict[str, Any]:
    return {
        "id": r[0], "user_id": r[1], "name": r[2], "token": r[3],
        "chat_id": r[4], "is_default": r[5],
        "bot_mode": r[6],
        "created_at": str(r[7]), "updated_at": str(r[8]),
    }

def create_bot(
    user_id: int,
    name: str,
    token: str,
    chat_id: str,
    is_default: bool = False,
    bot_mode: str = "all",
) -> Dict[str, Any]:
    with _cur() as cur:
        if is_default:
            # 先取消该用户已有的默认标记
            cur.execute(
                "UPDATE bot SET is_default = FALSE WHERE user_id = %s",
                (user_id,),
            )
        cur.execute(
            """INSERT INTO bot (user_id, name, token, chat_id, is_default, bot_mode)
               VALUES (%s, %s, %s, %s, %s, %s)
               RETURNING id, user_id, name, token, chat_id, is_default, bot_mode,
                         created_at, updated_at""",
            (user_id, name, token, chat_id, is_default, bot_mode),
        )
        return _row_to_bot(cur.fetchone())

def get_bot(bot_id: int) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            """SELECT id, user_id, name, token, chat_id, is_default, bot_mode,
                      created_at, updated_at
               FROM bot WHERE id = %s""",
            (bot_id,),
        )
        row = cur.fetchone()
        return _row_to_bot(row) if row else None

def get_bots_by_user(user_id: int) -> List[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            """SELECT id, user_id, name, token, chat_id, is_default, bot_mode,
                      created_at, updated_at
               FROM bot WHERE user_id = %s ORDER BY is_default DESC, id""",
            (user_id,),
        )
        return [_row_to_bot(r) for r in cur.fetchall()]

def get_default_bot(user_id: int) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            """SELECT id, user_id, name, token, chat_id, is_default, bot_mode,
                      created_at, updated_at
               FROM bot WHERE user_id = %s AND is_default = TRUE LIMIT 1""",
            (user_id,),
        )
        row = cur.fetchone()
        return _row_to_bot(row) if row else None

def get_all_bots() -> List[Dict[str, Any]]:
    """返回所有 Bot。"""
    with _cur() as cur:
        cur.execute(
            """SELECT id, user_id, name, token, chat_id, is_default, bot_mode,
                      created_at, updated_at
               FROM bot ORDER BY user_id, id"""
        )
        return [_row_to_bot(r) for r in cur.fetchall()]

def get_notify_bots(user_id: int) -> List[Dict[str, Any]]:
    """返回该用户所有接收 Gmail 通知的 Bot（mode='all' 或 'notify'）。"""
    with _cur() as cur:
        cur.execute(
            """SELECT id, user_id, name, token, chat_id, is_default, bot_mode,
                      created_at, updated_at
               FROM bot WHERE user_id = %s AND bot_mode IN ('all', 'notify')
               ORDER BY is_default DESC, id""",
            (user_id,),
        )
        return [_row_to_bot(r) for r in cur.fetchall()]

def update_bot(bot_id: int, user_id: int, **fields: Any) -> Optional[Dict[str, Any]]:
    allowed = {"name", "token", "chat_id", "is_default", "bot_mode"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return get_bot(bot_id)
    with _cur() as cur:
        if updates.get("is_default"):
            cur.execute(
                "UPDATE bot SET is_default = FALSE WHERE user_id = %s",
                (user_id,),
            )
        set_clause = ", ".join(f"{k} = %s" for k in updates)
        values = list(updates.values()) + [bot_id, user_id]
        cur.execute(
            f"""UPDATE bot SET {set_clause}, updated_at = NOW()
                WHERE id = %s AND user_id = %s
                RETURNING id, user_id, name, token, chat_id, is_default, bot_mode,
                          created_at, updated_at""",
            values,
        )
        row = cur.fetchone()
        return _row_to_bot(row) if row else None

def set_default_bot(bot_id: int, user_id: int) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            "UPDATE bot SET is_default = FALSE WHERE user_id = %s",
            (user_id,),
        )
        cur.execute(
            """UPDATE bot SET is_default = TRUE, updated_at = NOW()
               WHERE id = %s AND user_id = %s
               RETURNING id, user_id, name, token, chat_id, is_default, chat_prompt_id, bot_mode,
                         created_at, updated_at""",
            (bot_id, user_id),
        )
        row = cur.fetchone()
        return _row_to_bot(row) if row else None

def delete_bot(bot_id: int, user_id: int) -> bool:
    with _cur() as cur:
        cur.execute(
            "DELETE FROM bot WHERE id = %s AND user_id = %s",
            (bot_id, user_id),
        )
        return cur.rowcount > 0
