from typing import Optional
from ..session import _cur

def load_token_json(user_id: Optional[int] = None) -> Optional[str]:
    """返回指定用户的 OAuth token JSON。user_id=None 时返回第一条（兼容旧调用）。"""
    with _cur() as cur:
        if user_id is not None:
            cur.execute("SELECT token_json FROM oauth_tokens WHERE user_id = %s", (user_id,))
        else:
            cur.execute("SELECT token_json FROM oauth_tokens ORDER BY id LIMIT 1")
        row = cur.fetchone()
        return row[0] if row else None

def save_token_json(token_json: str, user_id: Optional[int] = None) -> None:
    """保存/更新 OAuth token（upsert）。"""
    with _cur() as cur:
        if user_id is not None:
            cur.execute(
                """INSERT INTO oauth_tokens (user_id, token_json)
                   VALUES (%s, %s)
                   ON CONFLICT (user_id) DO UPDATE
                       SET token_json = EXCLUDED.token_json,
                           updated_at = NOW()""",
                (user_id, token_json),
            )
        else:
            # 向后兼容：user_id=NULL（未绑定账号的旧式调用）
            cur.execute(
                """INSERT INTO oauth_tokens (user_id, token_json)
                   VALUES (NULL, %s)""",
                (token_json,),
            )
