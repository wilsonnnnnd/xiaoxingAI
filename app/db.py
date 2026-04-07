"""
SQLite 持久化层 — gmailManager

表结构：
  sender       — 已处理邮件 ID（防重推送）
  oauth_tokens — Google OAuth token（单行）
  worker_logs  — Worker 步骤日志（最多保留 10000 条）
  user_profile — Bot 聊天用户画像（每个 chat_id 一行，每日更新）
"""
import sqlite3
import enum
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

_ROOT   = Path(__file__).resolve().parent.parent
DB_PATH = _ROOT / "gmailmanager.db"


class LogType(str, enum.Enum):
    """日志来源类型，便于后续分类筛选"""
    EMAIL = "email"
    CHAT  = "chat"

_lock = threading.Lock()
_local = threading.local()


def get_conn() -> sqlite3.Connection:
    """每个线程拥有独立连接，避免多线程共享同一 Connection 的并发错误"""
    conn: sqlite3.Connection | None = getattr(_local, 'conn', None)
    if conn is None:
        conn = sqlite3.connect(str(DB_PATH), check_same_thread=True)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.commit()
        _local.conn = conn
    return conn


def init_db() -> None:
    """建表（幂等）"""
    conn = get_conn()
    with _lock:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS sender (
                email_id   TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now'))
            );

            CREATE TABLE IF NOT EXISTS oauth_tokens (
                id         INTEGER PRIMARY KEY CHECK (id = 1),
                token_json TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now'))
            );

            CREATE TABLE IF NOT EXISTS worker_logs (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                ts         TEXT NOT NULL,
                level      TEXT NOT NULL DEFAULT 'info',
                log_type   TEXT NOT NULL DEFAULT 'email',
                tokens     INTEGER NOT NULL DEFAULT 0,
                msg        TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now'))
            );

            CREATE TABLE IF NOT EXISTS user_profile (
                chat_id    TEXT PRIMARY KEY,
                profile    TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now'))
            );

            CREATE TABLE IF NOT EXISTS email_records (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                email_id      TEXT NOT NULL UNIQUE,
                subject       TEXT NOT NULL DEFAULT '',
                sender        TEXT NOT NULL DEFAULT '',
                date          TEXT NOT NULL DEFAULT '',
                body          TEXT NOT NULL DEFAULT '',
                analysis_json TEXT NOT NULL DEFAULT '{}',
                summary_json  TEXT NOT NULL DEFAULT '{}',
                telegram_msg  TEXT NOT NULL DEFAULT '',
                tokens        INTEGER NOT NULL DEFAULT 0,
                priority      TEXT NOT NULL DEFAULT '',
                sent_telegram INTEGER NOT NULL DEFAULT 0,
                created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now'))
            );

            CREATE TABLE IF NOT EXISTS worker_stats (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at    TEXT NOT NULL DEFAULT '',
                stopped_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now')),
                total_sent    INTEGER NOT NULL DEFAULT 0,
                total_fetched INTEGER NOT NULL DEFAULT 0,
                total_errors  INTEGER NOT NULL DEFAULT 0,
                total_tokens  INTEGER NOT NULL DEFAULT 0,
                runtime_secs  INTEGER NOT NULL DEFAULT 0,
                last_poll     TEXT
            );
        """)
        conn.commit()
    # 迁移：为已有数据库添加 log_type 列（幂等，列已存在时忽略）
    try:
        with _lock:
            conn.execute(
                "ALTER TABLE worker_logs ADD COLUMN log_type TEXT NOT NULL DEFAULT 'email'"
            )
            conn.commit()
    except Exception:
        pass  # 列已存在
    try:
        with _lock:
            conn.execute(
                "ALTER TABLE worker_logs ADD COLUMN tokens INTEGER NOT NULL DEFAULT 0"
            )
            conn.commit()
    except Exception:
        pass  # 列已存在
    # 迁移：将旧的单行 worker_stats (CHECK id=1) 转为多行设计
    try:
        schema_row = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='worker_stats'"
        ).fetchone()
        if schema_row and schema_row[0] and 'CHECK' in schema_row[0].upper():
            with _lock:
                conn.executescript("""
                    CREATE TABLE IF NOT EXISTS worker_stats_new (
                        id            INTEGER PRIMARY KEY AUTOINCREMENT,
                        started_at    TEXT NOT NULL DEFAULT '',
                        stopped_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now')),
                        total_sent    INTEGER NOT NULL DEFAULT 0,
                        total_fetched INTEGER NOT NULL DEFAULT 0,
                        total_errors  INTEGER NOT NULL DEFAULT 0,
                        total_tokens  INTEGER NOT NULL DEFAULT 0,
                        runtime_secs  INTEGER NOT NULL DEFAULT 0,
                        last_poll     TEXT
                    );
                    INSERT OR IGNORE INTO worker_stats_new
                        (id, started_at, stopped_at, total_sent, total_fetched,
                         total_errors, total_tokens, runtime_secs, last_poll)
                    SELECT id, '', updated_at, total_sent, total_fetched,
                           total_errors, total_tokens, total_runtime_secs, last_poll
                    FROM worker_stats;
                    DROP TABLE worker_stats;
                    ALTER TABLE worker_stats_new RENAME TO worker_stats;
                """)
    except Exception:
        pass  # 迁移失败则跳过（新库不需要）


# ── sender ───────────────────────────────────────────────

def is_sent(email_id: str) -> bool:
    return (
        get_conn()
        .execute("SELECT 1 FROM sender WHERE email_id = ?", (email_id,))
        .fetchone()
        is not None
    )


def add_sent_id(email_id: str) -> None:
    with _lock:
        get_conn().execute(
            "INSERT OR IGNORE INTO sender (email_id) VALUES (?)", (email_id,)
        )
        get_conn().commit()


def count_sender() -> int:
    return get_conn().execute("SELECT COUNT(*) FROM sender").fetchone()[0]


# ── oauth_tokens ──────────────────────────────────────────

def load_token_json() -> Optional[str]:
    row = get_conn().execute(
        "SELECT token_json FROM oauth_tokens WHERE id = 1"
    ).fetchone()
    return row[0] if row else None


def save_token_json(token_json: str) -> None:
    with _lock:
        get_conn().execute(
            "INSERT OR REPLACE INTO oauth_tokens (id, token_json, updated_at) "
            "VALUES (1, ?, strftime('%Y-%m-%dT%H:%M:%S','now'))",
            (token_json,),
        )
        get_conn().commit()


# ── worker_logs ───────────────────────────────────────────

def insert_log(ts: str, level: str, msg: str, log_type: LogType = LogType.EMAIL, tokens: int = 0) -> None:
    with _lock:
        get_conn().execute(
            "INSERT INTO worker_logs (ts, level, log_type, tokens, msg) VALUES (?, ?, ?, ?, ?)",
            (ts, level, str(log_type.value), tokens, msg),
        )
        get_conn().commit()


def get_recent_logs(limit: int = 100, log_type: Optional[LogType] = None) -> List[Dict[str, Any]]:
    if log_type is not None:
        rows = get_conn().execute(
            "SELECT id, ts, level, log_type, tokens, msg FROM worker_logs WHERE log_type = ? ORDER BY id DESC LIMIT ?",
            (str(log_type.value), limit),
        ).fetchall()
    else:
        rows = get_conn().execute(
            "SELECT id, ts, level, log_type, tokens, msg FROM worker_logs ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    # 反转使最旧的在前（时间正序显示）
    return [{"id": r[0], "ts": r[1], "level": r[2], "log_type": r[3], "tokens": r[4], "msg": r[5]} for r in reversed(rows)]


def clear_logs() -> int:
    with _lock:
        count = get_conn().execute("SELECT COUNT(*) FROM worker_logs").fetchone()[0]
        get_conn().execute("DELETE FROM worker_logs")
        get_conn().commit()
    return count


def cleanup_old_logs(keep: int = 10000) -> None:
    """删除多余的旧日志，只保留最近 keep 条"""
    with _lock:
        get_conn().execute(
            """DELETE FROM worker_logs
               WHERE id NOT IN (
                   SELECT id FROM worker_logs ORDER BY id DESC LIMIT ?
               )""",
            (keep,),
        )
        get_conn().commit()


# ── 统计信息 ──────────────────────────────────────────────

def get_stats() -> Dict[str, Any]:
    conn = get_conn()
    sent_count    = conn.execute("SELECT COUNT(*) FROM sender").fetchone()[0]
    log_count     = conn.execute("SELECT COUNT(*) FROM worker_logs").fetchone()[0]
    record_count  = conn.execute("SELECT COUNT(*) FROM email_records").fetchone()[0]
    has_token     = conn.execute(
        "SELECT COUNT(*) FROM oauth_tokens WHERE id = 1"
    ).fetchone()[0]
    return {
        "db_path":             str(DB_PATH),
        "sender_count":        sent_count,
        "log_count":           log_count,
        "email_records_count": record_count,
        "has_token":           bool(has_token),
    }


# ── user_profile ──────────────────────────────────────────

def get_profile(chat_id: str) -> str:
    """返回指定 chat_id 的用户画像文本，不存在则返回空字符串"""
    row = get_conn().execute(
        "SELECT profile FROM user_profile WHERE chat_id = ?", (chat_id,)
    ).fetchone()
    return row[0] if row else ""


def save_profile(chat_id: str, profile: str) -> None:
    """保存/更新用户画像（upsert）"""
    with _lock:
        get_conn().execute(
            "INSERT INTO user_profile (chat_id, profile, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%S','now')) "
            "ON CONFLICT(chat_id) DO UPDATE SET profile = excluded.profile, updated_at = excluded.updated_at",
            (chat_id, profile),
        )
        get_conn().commit()


def delete_profile(chat_id: str) -> None:
    with _lock:
        get_conn().execute("DELETE FROM user_profile WHERE chat_id = ?", (chat_id,))
        get_conn().commit()


def get_profile_updated_at(chat_id: str) -> Optional[str]:
    row = get_conn().execute(
        "SELECT updated_at FROM user_profile WHERE chat_id = ?", (chat_id,)
    ).fetchone()
    return row[0] if row else None


# ── email_records ─────────────────────────────────────────

import json as _json


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
) -> None:
    """保存邮件处理记录（upsert）"""
    with _lock:
        get_conn().execute(
            """INSERT INTO email_records
               (email_id, subject, sender, date, body, analysis_json, summary_json,
                telegram_msg, tokens, priority, sent_telegram)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(email_id) DO UPDATE SET
                   analysis_json = excluded.analysis_json,
                   summary_json  = excluded.summary_json,
                   telegram_msg  = excluded.telegram_msg,
                   tokens        = excluded.tokens,
                   priority      = excluded.priority,
                   sent_telegram = excluded.sent_telegram""",
            (
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
                1 if sent_telegram else 0,
            ),
        )
        get_conn().commit()


def get_email_records(limit: int = 50, priority: Optional[str] = None) -> List[Dict[str, Any]]:
    """返回邮件记录列表（按 id 倒序）"""
    if priority:
        rows = get_conn().execute(
            "SELECT * FROM email_records WHERE priority = ? ORDER BY id DESC LIMIT ?",
            (priority, limit),
        ).fetchall()
    else:
        rows = get_conn().execute(
            "SELECT * FROM email_records ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [
        {
            "id":            r["id"],
            "email_id":      r["email_id"],
            "subject":       r["subject"],
            "sender":        r["sender"],
            "date":          r["date"],
            "body":          r["body"],
            "analysis":      _json.loads(r["analysis_json"]),
            "summary":       _json.loads(r["summary_json"]),
            "telegram_msg":  r["telegram_msg"],
            "tokens":        r["tokens"],
            "priority":      r["priority"],
            "sent_telegram": bool(r["sent_telegram"]),
            "created_at":    r["created_at"],
        }
        for r in rows
    ]


def get_email_record(email_id: str) -> Optional[Dict[str, Any]]:
    """返回单条邮件记录，不存在则返回 None"""
    r = get_conn().execute(
        "SELECT * FROM email_records WHERE email_id = ?", (email_id,)
    ).fetchone()
    if r is None:
        return None
    return {
        "id":            r["id"],
        "email_id":      r["email_id"],
        "subject":       r["subject"],
        "sender":        r["sender"],
        "date":          r["date"],
        "body":          r["body"],
        "analysis":      _json.loads(r["analysis_json"]),
        "summary":       _json.loads(r["summary_json"]),
        "telegram_msg":  r["telegram_msg"],
        "tokens":        r["tokens"],
        "priority":      r["priority"],
        "sent_telegram": bool(r["sent_telegram"]),
        "created_at":    r["created_at"],
    }


def count_email_records() -> int:
    return get_conn().execute("SELECT COUNT(*) FROM email_records").fetchone()[0]


# ── worker_stats ──────────────────────────────────────────

def get_worker_stats() -> Dict[str, Any]:
    """返回所有历史会话的累积统计（SUM）"""
    row = get_conn().execute("""
        SELECT
            COALESCE(SUM(total_sent), 0),
            COALESCE(SUM(total_fetched), 0),
            COALESCE(SUM(total_errors), 0),
            COALESCE(SUM(total_tokens), 0),
            COALESCE(SUM(runtime_secs), 0),
            (SELECT last_poll FROM worker_stats ORDER BY id DESC LIMIT 1)
        FROM worker_stats
    """).fetchone()
    return {
        "total_sent":         row[0],
        "total_fetched":      row[1],
        "total_errors":       row[2],
        "total_tokens":       row[3],
        "total_runtime_secs": row[4],
        "last_poll":          row[5],
    }


def save_worker_stats(
    started_at: str,
    total_sent: int,
    total_fetched: int,
    total_errors: int,
    total_tokens: int,
    runtime_secs: int,
    last_poll: Optional[str],
) -> None:
    """插入一条新的会话记录（每次 Worker 停止时调用）"""
    with _lock:
        get_conn().execute(
            """INSERT INTO worker_stats
                   (started_at, stopped_at, total_sent, total_fetched, total_errors,
                    total_tokens, runtime_secs, last_poll)
               VALUES (?, strftime('%Y-%m-%dT%H:%M:%S','now'), ?, ?, ?, ?, ?, ?)""",
            (started_at, total_sent, total_fetched, total_errors,
             total_tokens, runtime_secs, last_poll),
        )
        get_conn().commit()
