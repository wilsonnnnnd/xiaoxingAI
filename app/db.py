"""
PostgreSQL 持久化层 — gmailManager

表结构：
  sender        — 已处理邮件 ID（防重推送）
  oauth_tokens  — Google OAuth token（单行）
  worker_logs   — Worker 步骤日志（最多保留 10000 条）
  user_profile  — Bot 聊天用户画像（每个 chat_id 一行，每日更新）
  email_records — 邮件处理记录
  worker_stats  — Worker 运行统计
"""
import enum
import json as _json
from contextlib import contextmanager
from typing import Any, Dict, Generator, List, Optional

import psycopg2
import psycopg2.pool

from app import config


class LogType(str, enum.Enum):
    """日志来源类型，便于后续分类筛选"""
    EMAIL = "email"
    CHAT  = "chat"


# ── 连接池（懒初始化） ─────────────────────────────────────────────
_pool: Optional[psycopg2.pool.ThreadedConnectionPool] = None


def _get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=config.POSTGRES_DSN,
        )
    return _pool


@contextmanager
def _cur() -> Generator:
    """
    从连接池取一个连接，提供 cursor；成功时 commit，异常时 rollback，最终归还连接。
    """
    pool = _get_pool()
    conn = pool.getconn()
    cur = None
    try:
        cur = conn.cursor()
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        if cur is not None:
            cur.close()
        pool.putconn(conn)


_TS_EXPR = "to_char(NOW(), 'YYYY-MM-DDTHH24:MI:SS')"


# ── 建表 ──────────────────────────────────────────────────────────

def init_db() -> None:
    """建表（幂等）"""
    with _cur() as cur:
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS sender (
                email_id   TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT {_TS_EXPR}
            )
        """)
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS oauth_tokens (
                id         INTEGER PRIMARY KEY CHECK (id = 1),
                token_json TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT {_TS_EXPR}
            )
        """)
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS worker_logs (
                id         BIGSERIAL PRIMARY KEY,
                ts         TEXT NOT NULL,
                level      TEXT NOT NULL DEFAULT 'info',
                log_type   TEXT NOT NULL DEFAULT 'email',
                tokens     INTEGER NOT NULL DEFAULT 0,
                msg        TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT {_TS_EXPR}
            )
        """)
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS user_profile (
                chat_id    TEXT PRIMARY KEY,
                profile    TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT {_TS_EXPR}
            )
        """)
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS email_records (
                id            BIGSERIAL PRIMARY KEY,
                email_id      TEXT NOT NULL UNIQUE,
                subject       TEXT NOT NULL DEFAULT '',
                sender        TEXT NOT NULL DEFAULT '',
                date          TEXT NOT NULL DEFAULT '',
                body          TEXT NOT NULL DEFAULT '',
                analysis_json TEXT NOT NULL DEFAULT '{{}}',
                summary_json  TEXT NOT NULL DEFAULT '{{}}',
                telegram_msg  TEXT NOT NULL DEFAULT '',
                tokens        INTEGER NOT NULL DEFAULT 0,
                priority      TEXT NOT NULL DEFAULT '',
                sent_telegram BOOLEAN NOT NULL DEFAULT FALSE,
                created_at    TEXT NOT NULL DEFAULT {_TS_EXPR}
            )
        """)
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS worker_stats (
                id            BIGSERIAL PRIMARY KEY,
                started_at    TEXT NOT NULL DEFAULT '',
                stopped_at    TEXT NOT NULL DEFAULT {_TS_EXPR},
                total_sent    INTEGER NOT NULL DEFAULT 0,
                total_fetched INTEGER NOT NULL DEFAULT 0,
                total_errors  INTEGER NOT NULL DEFAULT 0,
                total_tokens  INTEGER NOT NULL DEFAULT 0,
                runtime_secs  INTEGER NOT NULL DEFAULT 0,
                last_poll     TEXT
            )
        """)


# ── sender ─────────────────────────────────────────────────────────

def is_sent(email_id: str) -> bool:
    with _cur() as cur:
        cur.execute("SELECT 1 FROM sender WHERE email_id = %s", (email_id,))
        return cur.fetchone() is not None


def add_sent_id(email_id: str) -> None:
    with _cur() as cur:
        cur.execute(
            "INSERT INTO sender (email_id) VALUES (%s) ON CONFLICT DO NOTHING",
            (email_id,),
        )


def count_sender() -> int:
    with _cur() as cur:
        cur.execute("SELECT COUNT(*) FROM sender")
        return cur.fetchone()[0]


# ── oauth_tokens ───────────────────────────────────────────────────

def load_token_json() -> Optional[str]:
    with _cur() as cur:
        cur.execute("SELECT token_json FROM oauth_tokens WHERE id = 1")
        row = cur.fetchone()
        return row[0] if row else None


def save_token_json(token_json: str) -> None:
    with _cur() as cur:
        cur.execute(
            f"""INSERT INTO oauth_tokens (id, token_json, updated_at)
                VALUES (1, %s, {_TS_EXPR})
                ON CONFLICT (id) DO UPDATE
                    SET token_json = EXCLUDED.token_json,
                        updated_at = EXCLUDED.updated_at""",
            (token_json,),
        )


# ── worker_logs ────────────────────────────────────────────────────

def insert_log(ts: str, level: str, msg: str, log_type: LogType = LogType.EMAIL, tokens: int = 0) -> None:
    with _cur() as cur:
        cur.execute(
            "INSERT INTO worker_logs (ts, level, log_type, tokens, msg) VALUES (%s, %s, %s, %s, %s)",
            (ts, level, str(log_type.value), tokens, msg),
        )


def get_recent_logs(limit: int = 100, log_type: Optional[LogType] = None) -> List[Dict[str, Any]]:
    with _cur() as cur:
        if log_type is not None:
            cur.execute(
                "SELECT id, ts, level, log_type, tokens, msg FROM worker_logs"
                " WHERE log_type = %s ORDER BY id DESC LIMIT %s",
                (str(log_type.value), limit),
            )
        else:
            cur.execute(
                "SELECT id, ts, level, log_type, tokens, msg FROM worker_logs ORDER BY id DESC LIMIT %s",
                (limit,),
            )
        rows = cur.fetchall()
    return [
        {"id": r[0], "ts": r[1], "level": r[2], "log_type": r[3], "tokens": r[4], "msg": r[5]}
        for r in reversed(rows)
    ]


def clear_logs(log_type: Optional[str] = None) -> int:
    """清空步骤日志。可选按 log_type 过滤；不传则删除全部。返回被删除条目数。"""
    with _cur() as cur:
        if log_type:
            cur.execute("SELECT COUNT(*) FROM worker_logs WHERE log_type = %s", (log_type,))
            count = cur.fetchone()[0]
            cur.execute("DELETE FROM worker_logs WHERE log_type = %s", (log_type,))
        else:
            cur.execute("SELECT COUNT(*) FROM worker_logs")
            count = cur.fetchone()[0]
            cur.execute("DELETE FROM worker_logs")
    return count


def cleanup_old_logs(keep: int = 10000) -> None:
    """删除多余的旧日志，只保留最近 keep 条"""
    with _cur() as cur:
        cur.execute(
            """DELETE FROM worker_logs
               WHERE id NOT IN (
                   SELECT id FROM worker_logs ORDER BY id DESC LIMIT %s
               )""",
            (keep,),
        )


# ── 统计信息 ────────────────────────────────────────────────────────

def get_stats() -> Dict[str, Any]:
    with _cur() as cur:
        cur.execute("SELECT COUNT(*) FROM sender")
        sent_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM worker_logs")
        log_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM email_records")
        record_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM oauth_tokens WHERE id = 1")
        has_token = cur.fetchone()[0]

    # 从 DSN 中提取 host/dbname 展示，不暴露密码
    dsn = config.POSTGRES_DSN
    try:
        import urllib.parse as _up
        parsed = _up.urlparse(dsn)
        db_display = f"{parsed.hostname}:{parsed.port or 5432}{parsed.path}"
    except Exception:
        db_display = "postgresql"

    return {
        "db_path":             db_display,   # 保持与前端接口兼容
        "sender_count":        sent_count,
        "log_count":           log_count,
        "email_records_count": record_count,
        "has_token":           bool(has_token),
    }


# ── user_profile ────────────────────────────────────────────────────

def get_profile(chat_id: str) -> str:
    """返回指定 chat_id 的用户画像文本，不存在则返回空字符串"""
    with _cur() as cur:
        cur.execute("SELECT profile FROM user_profile WHERE chat_id = %s", (chat_id,))
        row = cur.fetchone()
        return row[0] if row else ""


def save_profile(chat_id: str, profile: str) -> None:
    """保存/更新用户画像（upsert）"""
    with _cur() as cur:
        cur.execute(
            f"""INSERT INTO user_profile (chat_id, profile, updated_at)
                VALUES (%s, %s, {_TS_EXPR})
                ON CONFLICT (chat_id) DO UPDATE
                    SET profile    = EXCLUDED.profile,
                        updated_at = EXCLUDED.updated_at""",
            (chat_id, profile),
        )


def delete_profile(chat_id: str) -> None:
    with _cur() as cur:
        cur.execute("DELETE FROM user_profile WHERE chat_id = %s", (chat_id,))


def get_profile_updated_at(chat_id: str) -> Optional[str]:
    with _cur() as cur:
        cur.execute("SELECT updated_at FROM user_profile WHERE chat_id = %s", (chat_id,))
        row = cur.fetchone()
        return row[0] if row else None


# ── email_records ───────────────────────────────────────────────────

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
    with _cur() as cur:
        cur.execute(
            """INSERT INTO email_records
               (email_id, subject, sender, date, body, analysis_json, summary_json,
                telegram_msg, tokens, priority, sent_telegram)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (email_id) DO UPDATE SET
                   analysis_json = EXCLUDED.analysis_json,
                   summary_json  = EXCLUDED.summary_json,
                   telegram_msg  = EXCLUDED.telegram_msg,
                   tokens        = EXCLUDED.tokens,
                   priority      = EXCLUDED.priority,
                   sent_telegram = EXCLUDED.sent_telegram""",
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
                sent_telegram,
            ),
        )


def _row_to_email_record(r: tuple) -> Dict[str, Any]:
    return {
        "id":            r[0],
        "email_id":      r[1],
        "subject":       r[2],
        "sender":        r[3],
        "date":          r[4],
        "body":          r[5],
        "analysis":      _json.loads(r[6]),
        "summary":       _json.loads(r[7]),
        "telegram_msg":  r[8],
        "tokens":        r[9],
        "priority":      r[10],
        "sent_telegram": bool(r[11]),
        "created_at":    r[12],
    }


_EMAIL_COLS = (
    "id, email_id, subject, sender, date, body,"
    " analysis_json, summary_json, telegram_msg, tokens, priority, sent_telegram, created_at"
)


def get_email_records(limit: int = 50, priority: Optional[str] = None) -> List[Dict[str, Any]]:
    """返回邮件记录列表（按 id 倒序）"""
    with _cur() as cur:
        if priority:
            cur.execute(
                f"SELECT {_EMAIL_COLS} FROM email_records WHERE priority = %s ORDER BY id DESC LIMIT %s",
                (priority, limit),
            )
        else:
            cur.execute(
                f"SELECT {_EMAIL_COLS} FROM email_records ORDER BY id DESC LIMIT %s",
                (limit,),
            )
        return [_row_to_email_record(r) for r in cur.fetchall()]


def get_email_record(email_id: str) -> Optional[Dict[str, Any]]:
    """返回单条邮件记录，不存在则返回 None"""
    with _cur() as cur:
        cur.execute(
            f"SELECT {_EMAIL_COLS} FROM email_records WHERE email_id = %s",
            (email_id,),
        )
        r = cur.fetchone()
        return _row_to_email_record(r) if r else None


def count_email_records() -> int:
    with _cur() as cur:
        cur.execute("SELECT COUNT(*) FROM email_records")
        return cur.fetchone()[0]


# ── worker_stats ────────────────────────────────────────────────────

def get_worker_stats() -> Dict[str, Any]:
    """返回所有历史会话的累积统计（SUM）"""
    with _cur() as cur:
        cur.execute("""
            SELECT
                COALESCE(SUM(total_sent), 0),
                COALESCE(SUM(total_fetched), 0),
                COALESCE(SUM(total_errors), 0),
                COALESCE(SUM(total_tokens), 0),
                COALESCE(SUM(runtime_secs), 0),
                (SELECT last_poll FROM worker_stats ORDER BY id DESC LIMIT 1)
            FROM worker_stats
        """)
        row = cur.fetchone()
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
    with _cur() as cur:
        cur.execute(
            f"""INSERT INTO worker_stats
                   (started_at, stopped_at, total_sent, total_fetched, total_errors,
                    total_tokens, runtime_secs, last_poll)
               VALUES (%s, {_TS_EXPR}, %s, %s, %s, %s, %s, %s)""",
            (started_at, total_sent, total_fetched, total_errors,
             total_tokens, runtime_secs, last_poll),
        )
