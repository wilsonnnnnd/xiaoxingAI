from typing import Optional
from ..session import _cur

def get_profile(bot_id: int) -> str:
    with _cur() as cur:
        cur.execute("SELECT profile FROM user_profile WHERE bot_id = %s", (bot_id,))
        row = cur.fetchone()
        return row[0] if row else ""

def save_profile(bot_id: int, profile: str) -> None:
    from ..session import _TS_EXPR
    with _cur() as cur:
        cur.execute(
            f"""INSERT INTO user_profile (bot_id, profile, updated_at)
                VALUES (%s, %s, {_TS_EXPR})
                ON CONFLICT (bot_id) DO UPDATE
                    SET profile    = EXCLUDED.profile,
                        updated_at = EXCLUDED.updated_at""",
            (bot_id, profile),
        )

def delete_profile(bot_id: int) -> None:
    with _cur() as cur:
        cur.execute("DELETE FROM user_profile WHERE bot_id = %s", (bot_id,))

def get_profile_updated_at(bot_id: int) -> Optional[str]:
    with _cur() as cur:
        cur.execute("SELECT updated_at FROM user_profile WHERE bot_id = %s", (bot_id,))
        row = cur.fetchone()
        return row[0] if row else None
