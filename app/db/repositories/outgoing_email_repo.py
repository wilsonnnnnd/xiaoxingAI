import json as _json
from typing import Any, Dict, Optional, Sequence

import psycopg2

from ..session import _cur


_DRAFT_COLS = (
    "id, user_id, status, to_email, cc_emails, bcc_emails, subject, body_format,"
    " body_ciphertext, body_nonce, body_key_id, body_sha256, prompt_snapshot, llm_tokens,"
    " idempotency_key, expires_at, telegram_bot_id, telegram_chat_id, telegram_message_id,"
    " callback_nonce, send_attempt_count, last_error_code, last_error_message, gmail_message_id,"
    " created_at, updated_at"
)


def _row_to_draft(r: tuple) -> Dict[str, Any]:
    def _maybe_load_json(v):
        if v is None:
            return None
        if isinstance(v, (dict, list)):
            return v
        if isinstance(v, (bytes, bytearray)):
            try:
                v = v.decode("utf-8", errors="replace")
            except Exception:
                return None
        if isinstance(v, str):
            try:
                return _json.loads(v)
            except Exception:
                return None
        return None

    return {
        "id": r[0],
        "user_id": r[1],
        "status": r[2],
        "to_email": r[3],
        "cc_emails": r[4],
        "bcc_emails": r[5],
        "subject": r[6],
        "body_format": r[7],
        "body_ciphertext": r[8],
        "body_nonce": r[9],
        "body_key_id": r[10],
        "body_sha256": r[11],
        "prompt_snapshot": _maybe_load_json(r[12]),
        "llm_tokens": r[13],
        "idempotency_key": r[14],
        "expires_at": r[15],
        "telegram_bot_id": r[16],
        "telegram_chat_id": r[17],
        "telegram_message_id": r[18],
        "callback_nonce": r[19],
        "send_attempt_count": r[20],
        "last_error_code": r[21],
        "last_error_message": r[22],
        "gmail_message_id": r[23],
        "created_at": r[24],
        "updated_at": r[25],
    }


def create_draft_stub(
    *,
    user_id: int,
    to_email: str,
    subject: str,
    body_format: str,
    idempotency_key: str,
    expires_at,
    prompt_snapshot: Optional[dict] = None,
    llm_tokens: int = 0,
    telegram_bot_id: Optional[int] = None,
    telegram_chat_id: Optional[str] = None,
    callback_nonce: Optional[str] = None,
) -> int:
    with _cur() as cur:
        cur.execute(
            """
            INSERT INTO outgoing_email_drafts
                (user_id, status, to_email, subject, body_format,
                 prompt_snapshot, llm_tokens, idempotency_key, expires_at,
                 telegram_bot_id, telegram_chat_id, callback_nonce)
            VALUES
                (%s, 'pending', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, idempotency_key) DO NOTHING
            RETURNING id
            """,
            (
                user_id,
                to_email,
                subject,
                body_format,
                _json.dumps(prompt_snapshot, ensure_ascii=False) if prompt_snapshot else None,
                llm_tokens,
                idempotency_key,
                expires_at,
                telegram_bot_id,
                telegram_chat_id,
                callback_nonce,
            ),
        )
        row = cur.fetchone()
        if row:
            return int(row[0])

        cur.execute(
            "SELECT id FROM outgoing_email_drafts WHERE user_id = %s AND idempotency_key = %s",
            (user_id, idempotency_key),
        )
        row = cur.fetchone()
        if not row:
            raise RuntimeError("failed to create draft")
        return int(row[0])


def set_draft_body_encrypted(
    *,
    draft_id: int,
    user_id: int,
    ciphertext: bytes,
    nonce: bytes,
    key_id: str,
    sha256: bytes,
) -> None:
    with _cur() as cur:
        cur.execute(
            """
            UPDATE outgoing_email_drafts
               SET body_ciphertext = %s,
                   body_nonce      = %s,
                   body_key_id     = %s,
                   body_sha256     = %s,
                   updated_at      = NOW()
             WHERE id = %s AND user_id = %s
            """,
            (ciphertext, nonce, key_id, sha256, draft_id, user_id),
        )


def get_draft(*, draft_id: int, user_id: int) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            f"SELECT {_DRAFT_COLS} FROM outgoing_email_drafts WHERE id = %s AND user_id = %s",
            (draft_id, user_id),
        )
        r = cur.fetchone()
        return _row_to_draft(r) if r else None


def get_draft_any(*, draft_id: int) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            f"SELECT {_DRAFT_COLS} FROM outgoing_email_drafts WHERE id = %s",
            (draft_id,),
        )
        r = cur.fetchone()
        return _row_to_draft(r) if r else None


def get_draft_by_preview_message(
    *,
    telegram_bot_id: int,
    telegram_chat_id: str,
    telegram_message_id: int,
) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            f"""
            SELECT {_DRAFT_COLS}
              FROM outgoing_email_drafts
             WHERE telegram_bot_id = %s
               AND telegram_chat_id = %s
               AND telegram_message_id = %s
             ORDER BY id DESC
             LIMIT 1
            """,
            (telegram_bot_id, telegram_chat_id, telegram_message_id),
        )
        r = cur.fetchone()
        return _row_to_draft(r) if r else None


def update_draft_recipient(
    *,
    draft_id: int,
    user_id: int,
    to_email: str,
) -> None:
    with _cur() as cur:
        cur.execute(
            """
            UPDATE outgoing_email_drafts
               SET to_email = %s,
                   updated_at = NOW()
             WHERE id = %s AND user_id = %s
            """,
            (to_email, draft_id, user_id),
        )


def update_draft_subject(*, draft_id: int, user_id: int, subject: str) -> None:
    with _cur() as cur:
        cur.execute(
            """
            UPDATE outgoing_email_drafts
               SET subject = %s,
                   updated_at = NOW()
             WHERE id = %s AND user_id = %s
            """,
            (subject, draft_id, user_id),
        )


def update_draft_status(
    *,
    draft_id: int,
    user_id: int,
    from_statuses: Sequence[str],
    to_status: str,
) -> bool:
    if not from_statuses:
        return False
    placeholders = ",".join(["%s"] * len(from_statuses))
    with _cur() as cur:
        cur.execute(
            f"""
            UPDATE outgoing_email_drafts
               SET status = %s,
                   updated_at = NOW()
             WHERE id = %s AND user_id = %s
               AND status IN ({placeholders})
            """,
            (to_status, draft_id, user_id, *list(from_statuses)),
        )
        return cur.rowcount > 0


def confirm_draft(*, draft_id: int, user_id: int) -> bool:
    return update_draft_status(
        draft_id=draft_id,
        user_id=user_id,
        from_statuses=("pending",),
        to_status="confirmed",
    )


def cancel_draft(*, draft_id: int, user_id: int) -> bool:
    return update_draft_status(
        draft_id=draft_id,
        user_id=user_id,
        from_statuses=("pending",),
        to_status="cancelled",
    )


def start_sending(*, draft_id: int, user_id: int) -> bool:
    return update_draft_status(
        draft_id=draft_id,
        user_id=user_id,
        from_statuses=("confirmed", "failed"),
        to_status="sending",
    )


def expire_pending(*, now) -> int:
    with _cur() as cur:
        cur.execute(
            """
            UPDATE outgoing_email_drafts
               SET status = 'expired',
                   updated_at = NOW()
             WHERE status = 'pending' AND expires_at < %s
            """,
            (now,),
        )
        return cur.rowcount


def set_preview_message(
    *,
    draft_id: int,
    user_id: int,
    telegram_message_id: int,
) -> None:
    with _cur() as cur:
        cur.execute(
            """
            UPDATE outgoing_email_drafts
               SET telegram_message_id = %s,
                   updated_at = NOW()
             WHERE id = %s AND user_id = %s
            """,
            (telegram_message_id, draft_id, user_id),
        )


def set_preview_delivery(
    *,
    draft_id: int,
    user_id: int,
    telegram_bot_id: int,
    telegram_chat_id: str,
    telegram_message_id: int,
) -> None:
    with _cur() as cur:
        cur.execute(
            """
            UPDATE outgoing_email_drafts
               SET telegram_bot_id = %s,
                   telegram_chat_id = %s,
                   telegram_message_id = %s,
                   updated_at = NOW()
             WHERE id = %s AND user_id = %s
            """,
            (telegram_bot_id, telegram_chat_id, telegram_message_id, draft_id, user_id),
        )


def set_send_result_success(
    *,
    draft_id: int,
    user_id: int,
    gmail_message_id: str,
) -> None:
    with _cur() as cur:
        cur.execute(
            """
            UPDATE outgoing_email_drafts
               SET status = 'sent',
                   gmail_message_id = %s,
                   last_error_code = NULL,
                   last_error_message = NULL,
                   updated_at = NOW()
             WHERE id = %s AND user_id = %s
            """,
            (gmail_message_id, draft_id, user_id),
        )


def set_send_result_failed(
    *,
    draft_id: int,
    user_id: int,
    error_code: str,
    error_message: str,
    increment_attempt: bool = True,
) -> None:
    with _cur() as cur:
        if increment_attempt:
            cur.execute(
                """
                UPDATE outgoing_email_drafts
                   SET status = 'failed',
                       send_attempt_count = send_attempt_count + 1,
                       last_error_code = %s,
                       last_error_message = %s,
                       updated_at = NOW()
                 WHERE id = %s AND user_id = %s
                """,
                (error_code, error_message, draft_id, user_id),
            )
        else:
            cur.execute(
                """
                UPDATE outgoing_email_drafts
                   SET status = 'failed',
                       last_error_code = %s,
                       last_error_message = %s,
                       updated_at = NOW()
                 WHERE id = %s AND user_id = %s
                """,
                (error_code, error_message, draft_id, user_id),
            )


def insert_action(
    *,
    draft_id: int,
    user_id: int,
    action: str,
    actor_type: str,
    source: str,
    result: str = "ok",
    error_code: Optional[str] = None,
    error_message: Optional[str] = None,
    idempotency_key: Optional[str] = None,
    telegram_update_id: Optional[str] = None,
    meta: Optional[dict] = None,
) -> bool:
    try:
        with _cur() as cur:
            cur.execute(
                """
                INSERT INTO outgoing_email_actions
                    (draft_id, user_id, action, actor_type, source,
                     result, error_code, error_message, idempotency_key,
                     telegram_update_id, meta)
                VALUES
                    (%s, %s, %s, %s, %s,
                     %s, %s, %s, %s,
                     %s, %s)
                """,
                (
                    draft_id,
                    user_id,
                    action,
                    actor_type,
                    source,
                    result,
                    error_code,
                    error_message,
                    idempotency_key,
                    telegram_update_id,
                    _json.dumps(meta, ensure_ascii=False) if meta else None,
                ),
            )
        return True
    except psycopg2.Error as e:
        if getattr(e, "pgcode", None) == "23505":
            return False
        raise


def list_outgoing_actions(*, limit: int = 100, user_id: Optional[int] = None) -> list[Dict[str, Any]]:
    with _cur() as cur:
        if user_id is not None:
            cur.execute(
                """
                SELECT id, draft_id, user_id, action, actor_type, source, result,
                       error_code, error_message, idempotency_key, telegram_update_id, meta, created_at
                  FROM outgoing_email_actions
                 WHERE user_id = %s
                 ORDER BY id DESC
                 LIMIT %s
                """,
                (user_id, limit),
            )
        else:
            cur.execute(
                """
                SELECT id, draft_id, user_id, action, actor_type, source, result,
                       error_code, error_message, idempotency_key, telegram_update_id, meta, created_at
                  FROM outgoing_email_actions
                 ORDER BY id DESC
                 LIMIT %s
                """,
                (limit,),
            )
        rows = cur.fetchall()

    results: list[Dict[str, Any]] = []
    for r in rows:
        meta = r[11]
        if isinstance(meta, str):
            try:
                meta = _json.loads(meta)
            except Exception:
                meta = None
        results.append(
            {
                "id": r[0],
                "draft_id": r[1],
                "user_id": r[2],
                "action": r[3],
                "actor_type": r[4],
                "source": r[5],
                "result": r[6],
                "error_code": r[7],
                "error_message": r[8],
                "idempotency_key": r[9],
                "telegram_update_id": r[10],
                "meta": meta if isinstance(meta, (dict, list)) else None,
                "created_at": r[12].isoformat() if hasattr(r[12], "isoformat") else str(r[12]),
            }
        )
    return list(reversed(results))


def list_outgoing_drafts(*, limit: int = 50, user_id: Optional[int] = None) -> list[Dict[str, Any]]:
    with _cur() as cur:
        if user_id is not None:
            cur.execute(
                f"SELECT {_DRAFT_COLS} FROM outgoing_email_drafts WHERE user_id = %s ORDER BY id DESC LIMIT %s",
                (user_id, limit),
            )
        else:
            cur.execute(
                f"SELECT {_DRAFT_COLS} FROM outgoing_email_drafts ORDER BY id DESC LIMIT %s",
                (limit,),
            )
        rows = cur.fetchall()
    return [_row_to_draft(r) for r in rows]
