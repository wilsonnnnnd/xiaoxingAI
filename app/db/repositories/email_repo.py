import json as _json
from typing import Any, Dict, List, Optional
from ..session import _cur

def is_email_processed(email_id: str, user_id: Optional[int] = None) -> bool:
    """检查邮件是否已处理。"""
    with _cur() as cur:
        if user_id is not None:
            cur.execute(
                "SELECT 1 FROM email_records WHERE user_id = %s AND email_id = %s",
                (user_id, email_id),
            )
        else:
            cur.execute(
                "SELECT 1 FROM email_records WHERE email_id = %s LIMIT 1",
                (email_id,),
            )
        return cur.fetchone() is not None

def save_email_record(
    email_id: str,
    subject: str,
    sender: str,
    date: str,
    body: str,
    analysis: Any,
    summary: Any,
    telegram_msg: str,
    tokens: int,
    priority: str,
    sent_telegram: bool,
    user_id: Optional[int] = None,
) -> None:
    """保存邮件处理记录（upsert by user_id+email_id）。"""
    body = ""
    analysis = {}
    summary = {}
    telegram_msg = ""
    with _cur() as cur:
        cur.execute(
            """INSERT INTO email_records
               (user_id, email_id, subject, sender, date, body,
                analysis_json, summary_json, telegram_msg, tokens, priority, sent_telegram)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (user_id, email_id) DO UPDATE SET
                   analysis_json = EXCLUDED.analysis_json,
                   summary_json  = EXCLUDED.summary_json,
                   telegram_msg  = EXCLUDED.telegram_msg,
                   tokens        = EXCLUDED.tokens,
                   priority      = EXCLUDED.priority,
                   sent_telegram = EXCLUDED.sent_telegram""",
            (
                user_id,
                email_id,
                subject,
                sender,
                date,
                body,
                _json.dumps(analysis, ensure_ascii=False) if not isinstance(analysis, str) else analysis,
                _json.dumps(summary, ensure_ascii=False) if not isinstance(summary, str) else summary,
                telegram_msg,
                tokens,
                priority,
                sent_telegram,
            ),
        )

def _row_to_email_record(r: tuple) -> Dict[str, Any]:
    return {
        "id":            r[0],
        "user_id":       r[1],
        "email_id":      r[2],
        "subject":       r[3],
        "sender":        r[4],
        "date":          r[5],
        "body":          r[6],
        "analysis":      _json.loads(r[7]),
        "summary":       _json.loads(r[8]),
        "telegram_msg":  r[9],
        "tokens":        r[10],
        "priority":      r[11],
        "sent_telegram": bool(r[12]),
        "created_at":    r[13],
    }

_EMAIL_COLS = (
    "id, user_id, email_id, subject, sender, date, body,"
    " analysis_json, summary_json, telegram_msg, tokens, priority, sent_telegram, created_at"
)

def get_email_records(
    limit: int = 50,
    priority: Optional[str] = None,
    user_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    with _cur() as cur:
        conditions: List[str] = []
        params: List[Any] = []
        if priority:
            conditions.append("priority = %s")
            params.append(priority)
        if user_id is not None:
            conditions.append("user_id = %s")
            params.append(user_id)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        params.append(limit)
        cur.execute(
            f"SELECT {_EMAIL_COLS} FROM email_records {where} ORDER BY id DESC LIMIT %s",
            params,
        )
        return [_row_to_email_record(r) for r in cur.fetchall()]

def get_email_record(email_id: str, user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        if user_id is not None:
            cur.execute(
                f"SELECT {_EMAIL_COLS} FROM email_records"
                " WHERE email_id = %s AND user_id = %s",
                (email_id, user_id),
            )
        else:
            cur.execute(
                f"SELECT {_EMAIL_COLS} FROM email_records WHERE email_id = %s LIMIT 1",
                (email_id,),
            )
        r = cur.fetchone()
        return _row_to_email_record(r) if r else None

def count_email_records(user_id: Optional[int] = None) -> int:
    with _cur() as cur:
        if user_id is not None:
            cur.execute("SELECT COUNT(*) FROM email_records WHERE user_id = %s", (user_id,))
        else:
            cur.execute("SELECT COUNT(*) FROM email_records")
        return cur.fetchone()[0]
