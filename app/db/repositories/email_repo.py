import json as _json
import logging
import time
from typing import Any, Dict, Iterable, List, Optional, Set
from ..session import _cur

logger = logging.getLogger("db")


def _build_email_record_filters(
    *,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    has_reply_drafts: Optional[bool] = None,
    q: Optional[str] = None,
    user_id: Optional[int] = None,
) -> tuple[List[str], List[Any]]:
    conditions: List[str] = []
    params: List[Any] = []

    if priority:
        conditions.append("priority = %s")
        params.append(priority)
    if category:
        conditions.append("analysis_json::jsonb ->> 'category' = %s")
        params.append(category)
    if has_reply_drafts is True:
        conditions.append(
            "jsonb_typeof(reply_drafts_json::jsonb -> 'options') = 'array'"
            " AND jsonb_array_length(reply_drafts_json::jsonb -> 'options') > 0"
        )
    elif has_reply_drafts is False:
        conditions.append(
            "("
            "jsonb_typeof(reply_drafts_json::jsonb -> 'options') IS DISTINCT FROM 'array'"
            " OR jsonb_array_length("
            "CASE WHEN jsonb_typeof(reply_drafts_json::jsonb -> 'options') = 'array'"
            " THEN reply_drafts_json::jsonb -> 'options'"
            " ELSE '[]'::jsonb END"
            ") = 0"
            ")"
        )
    if q:
        q_value = str(q).strip()
        if q_value:
            conditions.append("(subject ILIKE %s OR sender ILIKE %s)")
            pattern = f"%{q_value}%"
            params.extend([pattern, pattern])
    if user_id is not None:
        conditions.append("user_id = %s")
        params.append(user_id)

    return conditions, params

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


def get_processed_email_ids(email_ids: Iterable[str], user_id: Optional[int] = None) -> Set[str]:
    ids = [str(x) for x in email_ids if str(x)]
    if not ids:
        return set()
    with _cur() as cur:
        if user_id is not None:
            cur.execute(
                "SELECT email_id FROM email_records WHERE user_id = %s AND email_id = ANY(%s)",
                (user_id, ids),
            )
        else:
            cur.execute(
                "SELECT email_id FROM email_records WHERE email_id = ANY(%s)",
                (ids,),
            )
        return {str(r[0]) for r in cur.fetchall()}

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
    final_status: str = "",
    processed_at: str = "",
    reply_drafts: Any = None,
    processing_result: Any = None,
    user_id: Optional[int] = None,
) -> None:
    """保存邮件处理记录（upsert by user_id+email_id）。"""
    with _cur() as cur:
        cur.execute(
            """INSERT INTO email_records
               (user_id, email_id, subject, sender, date, body,
                analysis_json, summary_json, telegram_msg, tokens, priority, sent_telegram,
                final_status, processed_at, reply_drafts_json, processing_result_json)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (user_id, email_id) DO UPDATE SET
                   analysis_json = EXCLUDED.analysis_json,
                   summary_json  = EXCLUDED.summary_json,
                   telegram_msg  = EXCLUDED.telegram_msg,
                   tokens        = EXCLUDED.tokens,
                   priority      = EXCLUDED.priority,
                   sent_telegram = EXCLUDED.sent_telegram,
                   final_status = EXCLUDED.final_status,
                   processed_at = EXCLUDED.processed_at,
                   reply_drafts_json = EXCLUDED.reply_drafts_json,
                   processing_result_json = EXCLUDED.processing_result_json""",
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
                final_status,
                processed_at,
                _json.dumps(reply_drafts or {}, ensure_ascii=False) if not isinstance(reply_drafts, str) else (reply_drafts or "{}"),
                _json.dumps(processing_result or {}, ensure_ascii=False) if not isinstance(processing_result, str) else (processing_result or "{}"),
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
        "final_status":  r[13],
        "processed_at":  r[14],
        "reply_drafts":  _json.loads(r[15]),
        "processing_result": _json.loads(r[16]),
        "created_at":    r[17],
    }

_EMAIL_COLS = (
    "id, user_id, email_id, subject, sender, date, body,"
    " analysis_json, summary_json, telegram_msg, tokens, priority, sent_telegram,"
    " final_status, processed_at, reply_drafts_json, processing_result_json, created_at"
)

def get_email_records(
    limit: int = 50,
    offset: int = 0,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    has_reply_drafts: Optional[bool] = None,
    q: Optional[str] = None,
    user_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    with _cur() as cur:
        conditions, params = _build_email_record_filters(
            priority=priority,
            category=category,
            has_reply_drafts=has_reply_drafts,
            q=q,
            user_id=user_id,
        )
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        params.extend([limit, offset])
        start = time.perf_counter()
        cur.execute(
            f"SELECT {_EMAIL_COLS} FROM email_records {where} ORDER BY id DESC LIMIT %s OFFSET %s",
            params,
        )
        rows = cur.fetchall()
        ms = (time.perf_counter() - start) * 1000
        logger.info("[DB] email_records_list | %.0fms | rows=%d", ms, len(rows))
        return [_row_to_email_record(r) for r in rows]

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


def get_email_record_by_id(record_id: int, user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        start = time.perf_counter()
        if user_id is not None:
            cur.execute(
                f"SELECT {_EMAIL_COLS} FROM email_records"
                " WHERE id = %s AND user_id = %s",
                (record_id, user_id),
            )
        else:
            cur.execute(
                f"SELECT {_EMAIL_COLS} FROM email_records WHERE id = %s LIMIT 1",
                (record_id,),
            )
        r = cur.fetchone()
        ms = (time.perf_counter() - start) * 1000
        logger.info("[DB] email_record_by_id | %.0fms | rows=%d", ms, 1 if r else 0)
        return _row_to_email_record(r) if r else None

def count_email_records(
    user_id: Optional[int] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    has_reply_drafts: Optional[bool] = None,
    q: Optional[str] = None,
) -> int:
    with _cur() as cur:
        conditions, params = _build_email_record_filters(
            priority=priority,
            category=category,
            has_reply_drafts=has_reply_drafts,
            q=q,
            user_id=user_id,
        )
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        start = time.perf_counter()
        cur.execute(f"SELECT COUNT(*) FROM email_records {where}", params)
        value = cur.fetchone()[0]
        ms = (time.perf_counter() - start) * 1000
        logger.info("[DB] email_records_count | %.0fms", ms)
        return value


def get_processed_email_overview_stats(*, user_id: int) -> Dict[str, int]:
    with _cur() as cur:
        start = time.perf_counter()
        cur.execute(
            """
            SELECT
                COUNT(*) FILTER (
                    WHERE left(processed_at, 10) = to_char(CURRENT_DATE, 'YYYY-MM-DD')
                ) AS processed_today,
                COUNT(*) FILTER (
                    WHERE analysis_json::jsonb ->> 'priority' = 'high'
                ) AS high_priority,
                COUNT(*) FILTER (
                    WHERE jsonb_typeof(reply_drafts_json::jsonb -> 'options') = 'array'
                      AND jsonb_array_length(reply_drafts_json::jsonb -> 'options') > 0
                ) AS with_reply_drafts
            FROM email_records
            WHERE user_id = %s
            """,
            (int(user_id),),
        )
        row = cur.fetchone() or (0, 0, 0)
        ms = (time.perf_counter() - start) * 1000
        logger.info("[DB] email_records_stats | %.0fms", ms)
        return {
            "processed_today": int(row[0] or 0),
            "high_priority": int(row[1] or 0),
            "with_reply_drafts": int(row[2] or 0),
        }
