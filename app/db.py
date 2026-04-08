"""
PostgreSQL 持久化层 — Xiaoxing AI

表结构（新架构）：
  user         — Gmail 账号（用户）
  prompts      — Prompt 模板（系统内置 user_id=NULL + 用户私有）
  bot          — Telegram Bot（每用户可多个）
  oauth_tokens — Google OAuth token（每用户一行）
  email_records — 邮件处理记录
  worker_stats  — Worker 运行统计
  user_profile  — Bot 对话用户画像（每 bot_id 一行）
  log           — Worker 步骤日志（含系统日志 user_id=NULL）

迁移说明：首次检测到无 user 表时，自动删除旧表并建立新架构。
"""
import enum
import json as _json
from contextlib import contextmanager
from pathlib import Path
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

# 系统内置 Prompt 文件映射
_SYSTEM_PROMPTS = [
    ("对话回复",      "chat",           "chat.txt"),
    ("用户画像生成",  "user_profile",   "user_profile.txt"),
    ("邮件分析",      "email_analysis", "gmail/email_analysis.txt"),
    ("邮件摘要",      "email_summary",  "gmail/email_summary.txt"),
    ("Telegram通知",  "telegram_notify","gmail/telegram_notify.txt"),
]

_PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"


# ── 建表 / 迁移 ─────────────────────────────────────────────────────

def init_db() -> None:
    """建表（幂等）。首次运行新架构时自动删除旧表，然后导入系统内置 Prompt。"""
    with _cur() as cur:
        # 检测是否需要从旧架构迁移
        cur.execute(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables"
            " WHERE table_schema='public' AND table_name='user')"
        )
        has_user_table = cur.fetchone()[0]

        if not has_user_table:
            # 旧表清理（顺序：先子表后父表）
            for tbl in [
                "worker_stats", "email_records", "user_profile",
                "worker_logs", "sender", "oauth_tokens",
            ]:
                cur.execute(f"DROP TABLE IF EXISTS {tbl} CASCADE")

        # ── user ──────────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS "user" (
                id                 BIGSERIAL PRIMARY KEY,
                email              VARCHAR UNIQUE NOT NULL,
                display_name       VARCHAR,
                role               VARCHAR NOT NULL DEFAULT 'user',
                password_hash      TEXT,
                worker_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
                min_priority       VARCHAR NOT NULL DEFAULT 'medium',
                max_emails_per_run INTEGER NOT NULL DEFAULT 5,
                poll_interval      INTEGER NOT NULL DEFAULT 300,
                created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """)

        # ── prompts ──────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS prompts (
                id         BIGSERIAL PRIMARY KEY,
                user_id    BIGINT REFERENCES "user"(id) ON DELETE CASCADE,
                name       VARCHAR NOT NULL,
                type       VARCHAR NOT NULL,
                content    TEXT NOT NULL,
                is_default BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """)

        # ── bot ───────────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS bot (
                id             BIGSERIAL PRIMARY KEY,
                user_id        BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
                name           VARCHAR NOT NULL,
                token          TEXT NOT NULL,
                chat_id        VARCHAR NOT NULL,
                is_default     BOOLEAN NOT NULL DEFAULT FALSE,
                chat_prompt_id BIGINT REFERENCES prompts(id) ON DELETE SET NULL,
                created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """)

        # ── oauth_tokens ─────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS oauth_tokens (
                id         BIGSERIAL PRIMARY KEY,
                user_id    BIGINT UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
                token_json TEXT NOT NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """)

        # ── email_records ─────────────────────────────────────────
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS email_records (
                id            BIGSERIAL PRIMARY KEY,
                user_id       BIGINT REFERENCES "user"(id) ON DELETE SET NULL,
                email_id      TEXT NOT NULL,
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
                created_at    TEXT NOT NULL DEFAULT {_TS_EXPR},
                UNIQUE(user_id, email_id)
            )
        """)

        # ── worker_stats ──────────────────────────────────────────
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS worker_stats (
                id            BIGSERIAL PRIMARY KEY,
                user_id       BIGINT REFERENCES "user"(id) ON DELETE SET NULL,
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

        # ── user_profile ──────────────────────────────────────────
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS user_profile (
                bot_id     BIGINT PRIMARY KEY REFERENCES bot(id) ON DELETE CASCADE,
                profile    TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT {_TS_EXPR}
            )
        """)

        # ── log ───────────────────────────────────────────────────
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS log (
                id         BIGSERIAL PRIMARY KEY,
                user_id    BIGINT REFERENCES "user"(id) ON DELETE SET NULL,
                ts         TEXT NOT NULL,
                level      TEXT NOT NULL DEFAULT 'info',
                log_type   TEXT NOT NULL DEFAULT 'email',
                tokens     INTEGER NOT NULL DEFAULT 0,
                msg        TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT {_TS_EXPR}
            )
        """)

    # 导入系统内置 Prompt（幂等）
    _init_system_prompts()


def _init_system_prompts() -> None:
    """首次启动时将 prompts/ 目录下的文件导入为系统内置 Prompt（user_id=NULL）。"""
    with _cur() as cur:
        cur.execute("SELECT COUNT(*) FROM prompts WHERE user_id IS NULL")
        if cur.fetchone()[0] > 0:
            return  # 已导入过，跳过

        for name, ptype, rel_path in _SYSTEM_PROMPTS:
            fpath = _PROMPTS_DIR / rel_path
            if not fpath.exists():
                continue
            content = fpath.read_text(encoding="utf-8")
            cur.execute(
                "INSERT INTO prompts (user_id, name, type, content, is_default)"
                " VALUES (NULL, %s, %s, %s, TRUE)"
                " ON CONFLICT DO NOTHING",
                (name, ptype, content),
            )


# ── oauth_tokens ───────────────────────────────────────────────────

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


# ── log ────────────────────────────────────────────────────────────

def insert_log(
    ts: str,
    level: str,
    msg: str,
    log_type: LogType = LogType.EMAIL,
    tokens: int = 0,
    user_id: Optional[int] = None,
) -> None:
    with _cur() as cur:
        cur.execute(
            "INSERT INTO log (user_id, ts, level, log_type, tokens, msg)"
            " VALUES (%s, %s, %s, %s, %s, %s)",
            (user_id, ts, level, str(log_type.value), tokens, msg),
        )


def get_recent_logs(
    limit: int = 100,
    log_type: Optional[LogType] = None,
    user_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """返回最近日志。user_id=None 时管理员视图（返回全部含系统日志），否则过滤当前用户。"""
    with _cur() as cur:
        conditions: List[str] = []
        params: List[Any] = []
        if log_type is not None:
            conditions.append("log_type = %s")
            params.append(str(log_type.value))
        if user_id is not None:
            conditions.append("user_id = %s")
            params.append(user_id)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        params.append(limit)
        cur.execute(
            f"SELECT id, user_id, ts, level, log_type, tokens, msg"
            f" FROM log {where} ORDER BY id DESC LIMIT %s",
            params,
        )
        rows = cur.fetchall()
    return [
        {
            "id": r[0], "user_id": r[1], "ts": r[2],
            "level": r[3], "log_type": r[4], "tokens": r[5], "msg": r[6],
        }
        for r in reversed(rows)
    ]


def clear_logs(log_type: Optional[str] = None, user_id: Optional[int] = None) -> int:
    """清空日志。可按 log_type / user_id 过滤。返回删除条数。"""
    with _cur() as cur:
        conditions: List[str] = []
        params: List[Any] = []
        if log_type:
            conditions.append("log_type = %s")
            params.append(log_type)
        if user_id is not None:
            conditions.append("user_id = %s")
            params.append(user_id)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        cur.execute(f"SELECT COUNT(*) FROM log {where}", params)
        count = cur.fetchone()[0]
        cur.execute(f"DELETE FROM log {where}", params)
    return count


def cleanup_old_logs(keep: int = 10_000) -> None:
    with _cur() as cur:
        cur.execute(
            "DELETE FROM log WHERE id NOT IN"
            " (SELECT id FROM log ORDER BY id DESC LIMIT %s)",
            (keep,),
        )


# ── user ────────────────────────────────────────────────────────────

def create_user(
    email: str,
    display_name: Optional[str] = None,
    role: str = "user",
    password_hash: Optional[str] = None,
) -> Dict[str, Any]:
    with _cur() as cur:
        cur.execute(
            """INSERT INTO "user" (email, display_name, role, password_hash)
               VALUES (%s, %s, %s, %s)
               RETURNING id, email, display_name, role, worker_enabled,
                         min_priority, max_emails_per_run, poll_interval,
                         created_at, updated_at""",
            (email, display_name, role, password_hash),
        )
        return _row_to_user(cur.fetchone())


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            """SELECT id, email, display_name, role, password_hash, worker_enabled,
                      min_priority, max_emails_per_run, poll_interval,
                      created_at, updated_at
               FROM "user" WHERE email = %s""",
            (email,),
        )
        row = cur.fetchone()
        return _row_to_user_full(row) if row else None


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            """SELECT id, email, display_name, role, password_hash, worker_enabled,
                      min_priority, max_emails_per_run, poll_interval,
                      created_at, updated_at
               FROM "user" WHERE id = %s""",
            (user_id,),
        )
        row = cur.fetchone()
        return _row_to_user_full(row) if row else None


def list_users() -> List[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            """SELECT id, email, display_name, role, password_hash, worker_enabled,
                      min_priority, max_emails_per_run, poll_interval,
                      created_at, updated_at
               FROM "user" ORDER BY id"""
        )
        return [_row_to_user_full(r) for r in cur.fetchall()]


def list_worker_enabled_users() -> List[Dict[str, Any]]:
    """返回所有 worker_enabled=TRUE 的用户（启动时用于恢复 Worker）。"""
    with _cur() as cur:
        cur.execute(
            """SELECT id, email, display_name, role, password_hash, worker_enabled,
                      min_priority, max_emails_per_run, poll_interval,
                      created_at, updated_at
               FROM "user" WHERE worker_enabled = TRUE ORDER BY id"""
        )
        return [_row_to_user_full(r) for r in cur.fetchall()]


def update_user(user_id: int, **fields: Any) -> Optional[Dict[str, Any]]:
    """动态更新用户字段（只更新传入的字段）。"""
    allowed = {
        "display_name", "role", "password_hash", "worker_enabled",
        "min_priority", "max_emails_per_run", "poll_interval",
    }
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return get_user_by_id(user_id)
    updates["updated_at"] = "NOW()"  # handled separately below
    set_clause = ", ".join(
        f"{k} = NOW()" if k == "updated_at" else f"{k} = %s"
        for k in updates
    )
    values = [v for k, v in updates.items() if k != "updated_at"]
    values.append(user_id)
    with _cur() as cur:
        cur.execute(
            f"""UPDATE "user" SET {set_clause}
                WHERE id = %s
                RETURNING id, email, display_name, role, password_hash, worker_enabled,
                          min_priority, max_emails_per_run, poll_interval,
                          created_at, updated_at""",
            values,
        )
        row = cur.fetchone()
        return _row_to_user_full(row) if row else None


def _row_to_user(r: tuple) -> Dict[str, Any]:
    """Public-safe user dict (no password_hash)."""
    return {
        "id": r[0], "email": r[1], "display_name": r[2], "role": r[3],
        "worker_enabled": r[4], "min_priority": r[5],
        "max_emails_per_run": r[6], "poll_interval": r[7],
        "created_at": str(r[8]), "updated_at": str(r[9]),
    }


def _row_to_user_full(r: tuple) -> Dict[str, Any]:
    """Full user dict including password_hash (for internal auth use)."""
    return {
        "id": r[0], "email": r[1], "display_name": r[2], "role": r[3],
        "password_hash": r[4], "worker_enabled": r[5],
        "min_priority": r[6], "max_emails_per_run": r[7], "poll_interval": r[8],
        "created_at": str(r[9]), "updated_at": str(r[10]),
    }


# ── bot ─────────────────────────────────────────────────────────────

def create_bot(
    user_id: int,
    name: str,
    token: str,
    chat_id: str,
    is_default: bool = False,
    chat_prompt_id: Optional[int] = None,
) -> Dict[str, Any]:
    with _cur() as cur:
        if is_default:
            # 先取消该用户已有的默认标记
            cur.execute(
                "UPDATE bot SET is_default = FALSE WHERE user_id = %s",
                (user_id,),
            )
        cur.execute(
            """INSERT INTO bot (user_id, name, token, chat_id, is_default, chat_prompt_id)
               VALUES (%s, %s, %s, %s, %s, %s)
               RETURNING id, user_id, name, token, chat_id, is_default, chat_prompt_id,
                         created_at, updated_at""",
            (user_id, name, token, chat_id, is_default, chat_prompt_id),
        )
        return _row_to_bot(cur.fetchone())


def get_bot(bot_id: int) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            """SELECT id, user_id, name, token, chat_id, is_default, chat_prompt_id,
                      created_at, updated_at
               FROM bot WHERE id = %s""",
            (bot_id,),
        )
        row = cur.fetchone()
        return _row_to_bot(row) if row else None


def get_bots_by_user(user_id: int) -> List[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            """SELECT id, user_id, name, token, chat_id, is_default, chat_prompt_id,
                      created_at, updated_at
               FROM bot WHERE user_id = %s ORDER BY is_default DESC, id""",
            (user_id,),
        )
        return [_row_to_bot(r) for r in cur.fetchall()]


def get_default_bot(user_id: int) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            """SELECT id, user_id, name, token, chat_id, is_default, chat_prompt_id,
                      created_at, updated_at
               FROM bot WHERE user_id = %s AND is_default = TRUE LIMIT 1""",
            (user_id,),
        )
        row = cur.fetchone()
        return _row_to_bot(row) if row else None


def get_all_bots() -> List[Dict[str, Any]]:
    """返回所有 Bot（启动时用于恢复 ChatWorker）。"""
    with _cur() as cur:
        cur.execute(
            """SELECT id, user_id, name, token, chat_id, is_default, chat_prompt_id,
                      created_at, updated_at
               FROM bot ORDER BY user_id, id"""
        )
        return [_row_to_bot(r) for r in cur.fetchall()]


def update_bot(bot_id: int, user_id: int, **fields: Any) -> Optional[Dict[str, Any]]:
    allowed = {"name", "token", "chat_id", "is_default", "chat_prompt_id"}
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
                RETURNING id, user_id, name, token, chat_id, is_default, chat_prompt_id,
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
               RETURNING id, user_id, name, token, chat_id, is_default, chat_prompt_id,
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


def _row_to_bot(r: tuple) -> Dict[str, Any]:
    return {
        "id": r[0], "user_id": r[1], "name": r[2], "token": r[3],
        "chat_id": r[4], "is_default": r[5], "chat_prompt_id": r[6],
        "created_at": str(r[7]), "updated_at": str(r[8]),
    }


# ── prompts ─────────────────────────────────────────────────────────

def get_prompts(user_id: Optional[int] = None, ptype: Optional[str] = None) -> List[Dict[str, Any]]:
    """返回系统内置 prompt + 该用户私有 prompt。"""
    with _cur() as cur:
        conditions = ["(user_id IS NULL"]
        params: List[Any] = []
        if user_id is not None:
            conditions[0] += f" OR user_id = %s)"
            params.append(user_id)
        else:
            conditions[0] += ")"
        if ptype:
            conditions.append("type = %s")
            params.append(ptype)
        where = "WHERE " + " AND ".join(conditions)
        cur.execute(
            f"SELECT id, user_id, name, type, content, is_default, created_at, updated_at"
            f" FROM prompts {where} ORDER BY user_id NULLS FIRST, id",
            params,
        )
        return [_row_to_prompt(r) for r in cur.fetchall()]


def get_prompt(prompt_id: int) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            "SELECT id, user_id, name, type, content, is_default, created_at, updated_at"
            " FROM prompts WHERE id = %s",
            (prompt_id,),
        )
        row = cur.fetchone()
        return _row_to_prompt(row) if row else None


def get_active_prompt(ptype: str, user_id: Optional[int] = None, bot_id: Optional[int] = None) -> Optional[str]:
    """按优先级获取 prompt 内容：bot 绑定 → 用户默认 → 系统内置。"""
    with _cur() as cur:
        # 1. Bot 绑定的专属 chat prompt
        if bot_id is not None and ptype == "chat":
            cur.execute(
                "SELECT p.content FROM prompts p"
                " JOIN bot b ON b.chat_prompt_id = p.id"
                " WHERE b.id = %s",
                (bot_id,),
            )
            row = cur.fetchone()
            if row:
                return row[0]
        # 2. 用户默认
        if user_id is not None:
            cur.execute(
                "SELECT content FROM prompts"
                " WHERE user_id = %s AND type = %s AND is_default = TRUE LIMIT 1",
                (user_id, ptype),
            )
            row = cur.fetchone()
            if row:
                return row[0]
        # 3. 系统内置
        cur.execute(
            "SELECT content FROM prompts"
            " WHERE user_id IS NULL AND type = %s LIMIT 1",
            (ptype,),
        )
        row = cur.fetchone()
        return row[0] if row else None


def create_prompt(
    user_id: int,
    name: str,
    ptype: str,
    content: str,
    is_default: bool = False,
) -> Dict[str, Any]:
    with _cur() as cur:
        if is_default:
            cur.execute(
                "UPDATE prompts SET is_default = FALSE WHERE user_id = %s AND type = %s",
                (user_id, ptype),
            )
        cur.execute(
            """INSERT INTO prompts (user_id, name, type, content, is_default)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING id, user_id, name, type, content, is_default, created_at, updated_at""",
            (user_id, name, ptype, content, is_default),
        )
        return _row_to_prompt(cur.fetchone())


def update_prompt(prompt_id: int, user_id: int, **fields: Any) -> Optional[Dict[str, Any]]:
    allowed = {"name", "content", "is_default"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return get_prompt(prompt_id)
    with _cur() as cur:
        # 验证所有权（system prompts user_id IS NULL 需要 admin 权限，由上层保证）
        if updates.get("is_default"):
            cur.execute(
                "SELECT type FROM prompts WHERE id = %s", (prompt_id,)
            )
            prow = cur.fetchone()
            if prow:
                cur.execute(
                    "UPDATE prompts SET is_default = FALSE"
                    " WHERE user_id = %s AND type = %s",
                    (user_id, prow[0]),
                )
        set_clause = ", ".join(f"{k} = %s" for k in updates)
        values = list(updates.values()) + [prompt_id]
        cur.execute(
            f"""UPDATE prompts SET {set_clause}, updated_at = NOW()
                WHERE id = %s
                RETURNING id, user_id, name, type, content, is_default, created_at, updated_at""",
            values,
        )
        row = cur.fetchone()
        return _row_to_prompt(row) if row else None


def delete_prompt(prompt_id: int) -> bool:
    with _cur() as cur:
        cur.execute("DELETE FROM prompts WHERE id = %s AND user_id IS NOT NULL", (prompt_id,))
        return cur.rowcount > 0


def _row_to_prompt(r: tuple) -> Dict[str, Any]:
    return {
        "id": r[0], "user_id": r[1], "name": r[2], "type": r[3],
        "content": r[4], "is_default": r[5],
        "created_at": str(r[6]), "updated_at": str(r[7]),
    }


# ── 统计信息 ────────────────────────────────────────────────────────

def get_stats(user_id: Optional[int] = None) -> Dict[str, Any]:
    with _cur() as cur:
        if user_id is not None:
            cur.execute("SELECT COUNT(*) FROM log WHERE user_id = %s", (user_id,))
            log_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM email_records WHERE user_id = %s", (user_id,))
            record_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM oauth_tokens WHERE user_id = %s", (user_id,))
            has_token = cur.fetchone()[0]
        else:
            cur.execute("SELECT COUNT(*) FROM log")
            log_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM email_records")
            record_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM oauth_tokens")
            has_token = cur.fetchone()[0]

    dsn = config.POSTGRES_DSN
    try:
        import urllib.parse as _up
        parsed = _up.urlparse(dsn)
        db_display = f"{parsed.hostname}:{parsed.port or 5432}{parsed.path}"
    except Exception:
        db_display = "postgresql"

    return {
        "db_path":             db_display,
        "log_count":           log_count,
        "email_records_count": record_count,
        "has_token":           bool(has_token),
    }


# ── user_profile ────────────────────────────────────────────────────

def get_profile(bot_id: int) -> str:
    with _cur() as cur:
        cur.execute("SELECT profile FROM user_profile WHERE bot_id = %s", (bot_id,))
        row = cur.fetchone()
        return row[0] if row else ""


def save_profile(bot_id: int, profile: str) -> None:
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


# ── email_records ───────────────────────────────────────────────────

def is_email_processed(email_id: str, user_id: Optional[int] = None) -> bool:
    """检查邮件是否已处理（替代旧 is_sent）。"""
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


# ── worker_stats ────────────────────────────────────────────────────

def get_worker_stats(user_id: Optional[int] = None) -> Dict[str, Any]:
    """返回累积统计（SUM）。user_id=None 返回全局合计。"""
    with _cur() as cur:
        where = "WHERE user_id = %s" if user_id is not None else ""
        params = (user_id,) if user_id is not None else ()
        cur.execute(
            f"""SELECT
                    COALESCE(SUM(total_sent), 0),
                    COALESCE(SUM(total_fetched), 0),
                    COALESCE(SUM(total_errors), 0),
                    COALESCE(SUM(total_tokens), 0),
                    COALESCE(SUM(runtime_secs), 0),
                    (SELECT last_poll FROM worker_stats {where} ORDER BY id DESC LIMIT 1)
                FROM worker_stats {where}""",
            params + params,  # used twice (SUM + subquery)
        )
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
    user_id: Optional[int] = None,
) -> None:
    with _cur() as cur:
        cur.execute(
            f"""INSERT INTO worker_stats
                   (user_id, started_at, stopped_at, total_sent, total_fetched,
                    total_errors, total_tokens, runtime_secs, last_poll)
               VALUES (%s, %s, {_TS_EXPR}, %s, %s, %s, %s, %s, %s)""",
            (user_id, started_at, total_sent, total_fetched,
             total_errors, total_tokens, runtime_secs, last_poll),
        )
