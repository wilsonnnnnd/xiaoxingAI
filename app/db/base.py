import enum
from pathlib import Path
from .session import _cur, _TS_EXPR

class LogType(str, enum.Enum):
    """日志来源类型，便于后续分类筛选"""
    EMAIL = "email"
    CHAT  = "chat"

# 系统内置 Prompt 文件映射
_SYSTEM_PROMPTS = [
    ("对话回复",      "chat",           "chat.txt"),
    ("用户画像生成",  "user_profile",   "user_profile.txt"),
    ("邮件分析",      "email_analysis", "gmail/email_analysis.txt"),
    ("邮件摘要",      "email_summary",  "gmail/email_summary.txt"),
    ("Telegram通知",  "telegram_notify","gmail/telegram_notify.txt"),
]

_PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"

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

        # ── system_prompts ───────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS system_prompts (
                id         BIGSERIAL PRIMARY KEY,
                name       VARCHAR NOT NULL,
                type       VARCHAR NOT NULL,
                content    TEXT NOT NULL,
                is_default BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """)

        # ── user_prompts ─────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS user_prompts (
                id         BIGSERIAL PRIMARY KEY,
                user_id    BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
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
                chat_prompt_id BIGINT REFERENCES user_prompts(id) ON DELETE SET NULL,
                bot_mode       VARCHAR NOT NULL DEFAULT 'all',
                created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute(
            "ALTER TABLE bot ADD COLUMN IF NOT EXISTS bot_mode VARCHAR NOT NULL DEFAULT 'all'"
        )

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

    _migrate_prompts_split()

    with _cur() as cur:
        cur.execute(
            "ALTER TABLE user_prompts ADD COLUMN IF NOT EXISTS meta TEXT"
        )

    _init_system_prompts()

def _migrate_prompts_split() -> None:
    with _cur() as cur:
        cur.execute(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables"
            " WHERE table_schema='public' AND table_name='prompts')"
        )
        if not cur.fetchone()[0]:
            return

        cur.execute("""
            INSERT INTO system_prompts (id, name, type, content, is_default, created_at, updated_at)
            SELECT id, name, type, content, is_default, created_at, updated_at
            FROM prompts WHERE user_id IS NULL
            ON CONFLICT DO NOTHING
        """)
        cur.execute("""
            SELECT setval(
                pg_get_serial_sequence('system_prompts', 'id'),
                COALESCE((SELECT MAX(id) FROM system_prompts), 0),
                false
            )
        """)

        cur.execute("""
            INSERT INTO user_prompts (id, user_id, name, type, content, is_default, created_at, updated_at)
            SELECT id, user_id, name, type, content, is_default, created_at, updated_at
            FROM prompts WHERE user_id IS NOT NULL
            ON CONFLICT DO NOTHING
        """)
        cur.execute("""
            SELECT setval(
                pg_get_serial_sequence('user_prompts', 'id'),
                COALESCE((SELECT MAX(id) FROM user_prompts), 0),
                false
            )
        """)

        cur.execute("ALTER TABLE bot DROP CONSTRAINT IF EXISTS bot_chat_prompt_id_fkey")
        cur.execute("""
            ALTER TABLE bot ADD CONSTRAINT bot_chat_prompt_id_fkey
            FOREIGN KEY (chat_prompt_id) REFERENCES user_prompts(id) ON DELETE SET NULL
        """)

        cur.execute("DROP TABLE IF EXISTS prompts CASCADE")

def _init_system_prompts() -> None:
    with _cur() as cur:
        cur.execute("SELECT COUNT(*) FROM system_prompts WHERE type != 'persona_config'")
        if cur.fetchone()[0] > 0:
            return

        for name, ptype, rel_path in _SYSTEM_PROMPTS:
            fpath = _PROMPTS_DIR / rel_path
            if not fpath.exists():
                continue
            content = fpath.read_text(encoding="utf-8")
            cur.execute(
                "INSERT INTO system_prompts (name, type, content, is_default)"
                " VALUES (%s, %s, %s, TRUE)"
                " ON CONFLICT DO NOTHING",
                (name, ptype, content),
            )
