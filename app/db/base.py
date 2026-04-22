import enum
from pathlib import Path
from .session import _cur, _TS_EXPR
from app.core import config

class LogType(str, enum.Enum):
    """日志来源类型，便于后续分类筛选"""
    EMAIL = "email"

# 系统内置 Prompt 文件映射
_SYSTEM_PROMPTS = [
    ("邮件分析",      "email_analysis", "gmail/email_analysis.txt"),
    ("邮件摘要",      "email_summary",  "gmail/email_summary.txt"),
    ("Telegram通知",  "telegram_notify","gmail/telegram_notify.txt"),
    ("Telegram通知(EN)", "telegram_notify_en", "gmail/telegram_notify.en.txt"),
    ("Outgoing Email", "outgoing_email", "outgoing/email_compose.txt"),
    ("Email Edit", "email_edit", "outgoing/email_edit.txt"),
    ("Email Reply Compose", "email_reply_compose", "outgoing/email_reply_compose.txt"),
    ("Email Reply Drafts", "email_reply_drafts", "outgoing/email_reply_drafts.txt"),
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

        if not has_user_table and config.DB_ALLOW_LEGACY_DROP:
            # 旧表清理（顺序：先子表后父表）
            for tbl in [
                "worker_stats", "email_records",
                "worker_logs", "sender", "oauth_tokens", "ai_usage_analytics",
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

        # ── user_settings（per-user 设置，使用 user_id 关联） ────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id            BIGINT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
                worker_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
                min_priority       VARCHAR NOT NULL DEFAULT 'medium',
                max_emails_per_run INTEGER NOT NULL DEFAULT 5,
                poll_interval      INTEGER NOT NULL DEFAULT 300,
                gmail_poll_query   TEXT NOT NULL DEFAULT '',
                notify_lang        VARCHAR NOT NULL DEFAULT 'en',
                ui_lang            VARCHAR NOT NULL DEFAULT 'en',
                created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute(
            "SELECT column_name FROM information_schema.columns"
            " WHERE table_schema='public' AND table_name='user_settings'"
        )
        cols = {r[0] for r in cur.fetchall()}
        if "notify_lang" not in cols:
            cur.execute("ALTER TABLE user_settings ADD COLUMN notify_lang VARCHAR NOT NULL DEFAULT 'en'")
        if "ui_lang" not in cols:
            cur.execute("ALTER TABLE user_settings ADD COLUMN ui_lang VARCHAR NOT NULL DEFAULT 'en'")
        if "notify_lang" not in cols and "ui_lang" in cols:
            cur.execute("UPDATE user_settings SET notify_lang = ui_lang WHERE notify_lang IS NULL OR notify_lang = ''")
        if "ui_lang" not in cols and "notify_lang" in cols:
            cur.execute("UPDATE user_settings SET ui_lang = notify_lang WHERE ui_lang IS NULL OR ui_lang = ''")

        cur.execute(
            "INSERT INTO user_settings (user_id, worker_enabled, min_priority, max_emails_per_run, poll_interval, gmail_poll_query, notify_lang, ui_lang)"
            " SELECT id, worker_enabled, min_priority, max_emails_per_run, poll_interval, %s, 'en', 'en'"
            " FROM \"user\""
            " ON CONFLICT (user_id) DO NOTHING",
            (config.GMAIL_POLL_QUERY,),
        )
        cur.execute(
            "UPDATE user_settings SET notify_lang = 'en' WHERE notify_lang IS NULL OR notify_lang = ''"
        )
        cur.execute(
            "UPDATE user_settings SET ui_lang = 'en' WHERE ui_lang IS NULL OR ui_lang = ''"
        )
        cur.execute(
            "UPDATE user_settings SET gmail_poll_query = %s"
            " WHERE gmail_poll_query IS NULL OR gmail_poll_query = ''",
            (config.GMAIL_POLL_QUERY,),
        )

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
                bot_mode       VARCHAR NOT NULL DEFAULT 'all',
                created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute(
            "ALTER TABLE bot ADD COLUMN IF NOT EXISTS bot_mode VARCHAR NOT NULL DEFAULT 'all'"
        )
        cur.execute("ALTER TABLE bot DROP CONSTRAINT IF EXISTS bot_chat_prompt_id_fkey")
        cur.execute("ALTER TABLE bot DROP COLUMN IF EXISTS chat_prompt_id")
        cur.execute("UPDATE bot SET bot_mode = 'notify' WHERE bot_mode = 'chat'")

        # ── oauth_tokens ─────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS oauth_tokens (
                id         BIGSERIAL PRIMARY KEY,
                user_id    BIGINT UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
                token_json TEXT NOT NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """)

        # ── register_invites ─────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS register_invites (
                id          BIGSERIAL PRIMARY KEY,
                code        VARCHAR(64) UNIQUE NOT NULL,
                created_by  BIGINT REFERENCES "user"(id) ON DELETE SET NULL,
                note        VARCHAR(200),
                created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
                expires_at  TIMESTAMP NOT NULL,
                used_at     TIMESTAMP,
                used_by     BIGINT REFERENCES "user"(id) ON DELETE SET NULL,
                used_email  VARCHAR,
                used_ip     VARCHAR,
                revoked_at  TIMESTAMP
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_register_invites_expires_at ON register_invites (expires_at)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_register_invites_used_at ON register_invites (used_at)")

        cur.execute("""
            CREATE TABLE IF NOT EXISTS outgoing_email_drafts (
                id                BIGSERIAL PRIMARY KEY,
                user_id           BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
                status            VARCHAR(16) NOT NULL DEFAULT 'pending',
                to_email          TEXT NOT NULL,
                cc_emails         JSONB,
                bcc_emails        JSONB,
                subject           TEXT NOT NULL DEFAULT '',
                body_format       VARCHAR(8) NOT NULL DEFAULT 'plain',
                body_ciphertext   BYTEA,
                body_nonce        BYTEA,
                body_key_id       VARCHAR(32) NOT NULL DEFAULT 'v1',
                body_sha256       BYTEA,
                prompt_snapshot   JSONB,
                llm_tokens        INTEGER NOT NULL DEFAULT 0,
                idempotency_key   VARCHAR(64) NOT NULL,
                expires_at        TIMESTAMPTZ NOT NULL,
                telegram_bot_id   BIGINT REFERENCES bot(id) ON DELETE SET NULL,
                telegram_chat_id  TEXT,
                telegram_message_id BIGINT,
                callback_nonce    VARCHAR(32),
                send_attempt_count INTEGER NOT NULL DEFAULT 0,
                last_error_code    VARCHAR(64),
                last_error_message TEXT,
                gmail_message_id   TEXT,
                created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(user_id, idempotency_key)
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS outgoing_email_actions (
                id               BIGSERIAL PRIMARY KEY,
                draft_id         BIGINT NOT NULL REFERENCES outgoing_email_drafts(id) ON DELETE CASCADE,
                user_id          BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
                action           VARCHAR(24) NOT NULL,
                actor_type       VARCHAR(8) NOT NULL,
                source           VARCHAR(24) NOT NULL,
                result           VARCHAR(8) NOT NULL DEFAULT 'ok',
                error_code       VARCHAR(64),
                error_message    TEXT,
                idempotency_key  VARCHAR(64),
                telegram_update_id TEXT UNIQUE,
                meta             JSONB,
                created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)

        cur.execute("CREATE INDEX IF NOT EXISTS idx_outgoing_drafts_user_status ON outgoing_email_drafts(user_id, status)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_outgoing_drafts_user_created ON outgoing_email_drafts(user_id, created_at DESC)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_outgoing_drafts_expires ON outgoing_email_drafts(expires_at)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_outgoing_actions_draft_time ON outgoing_email_actions(draft_id, created_at DESC)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_outgoing_actions_user_time ON outgoing_email_actions(user_id, created_at DESC)")

        cur.execute("""
            CREATE TABLE IF NOT EXISTS ai_usage_analytics (
                id                   BIGSERIAL PRIMARY KEY,
                user_id              BIGINT REFERENCES "user"(id) ON DELETE SET NULL,
                recorded_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                provider             VARCHAR(64) NOT NULL DEFAULT '',
                source               VARCHAR(64) NOT NULL DEFAULT '',
                purpose              VARCHAR(128) NOT NULL DEFAULT '',
                model_name           VARCHAR(160) NOT NULL DEFAULT '',
                prompt_tokens        INTEGER NOT NULL DEFAULT 0,
                completion_tokens    INTEGER NOT NULL DEFAULT 0,
                total_tokens         INTEGER NOT NULL DEFAULT 0,
                estimated_cost_usd   NUMERIC(18, 8) NOT NULL DEFAULT 0
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_ai_usage_recorded_at ON ai_usage_analytics(recorded_at DESC)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_ai_usage_user_recorded_at ON ai_usage_analytics(user_id, recorded_at DESC)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_ai_usage_model_recorded_at ON ai_usage_analytics(model_name, recorded_at DESC)")

        cur.execute("""
            CREATE TABLE IF NOT EXISTS reply_templates (
                id         BIGSERIAL PRIMARY KEY,
                user_id    BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
                name       VARCHAR(80) NOT NULL,
                body_template TEXT NOT NULL,
                closing    TEXT,
                is_default BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_reply_templates_user_id ON reply_templates(user_id)")
        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_reply_templates_user_default ON reply_templates(user_id) WHERE is_default = TRUE")

        cur.execute("""
            CREATE TABLE IF NOT EXISTS reply_format_settings (
                user_id            BIGINT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
                default_template_id BIGINT REFERENCES reply_templates(id) ON DELETE SET NULL,
                signature          TEXT NOT NULL DEFAULT '',
                updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS email_automation_rules (
                id         BIGSERIAL PRIMARY KEY,
                user_id    BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
                category   VARCHAR,
                priority   VARCHAR,
                action     VARCHAR NOT NULL,
                enabled    BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute("ALTER TABLE email_automation_rules ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_email_automation_rules_user_enabled ON email_automation_rules(user_id, enabled)")

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
                final_status  TEXT NOT NULL DEFAULT '',
                processed_at  TEXT NOT NULL DEFAULT {_TS_EXPR},
                reply_drafts_json TEXT NOT NULL DEFAULT '{{}}',
                processing_result_json TEXT NOT NULL DEFAULT '{{}}',
                created_at    TEXT NOT NULL DEFAULT {_TS_EXPR},
                UNIQUE(user_id, email_id)
            )
        """)
        cur.execute("ALTER TABLE email_records ADD COLUMN IF NOT EXISTS final_status TEXT NOT NULL DEFAULT ''")
        cur.execute(f"ALTER TABLE email_records ADD COLUMN IF NOT EXISTS processed_at TEXT NOT NULL DEFAULT {_TS_EXPR}")
        cur.execute("ALTER TABLE email_records ADD COLUMN IF NOT EXISTS reply_drafts_json TEXT NOT NULL DEFAULT '{}'")
        cur.execute("ALTER TABLE email_records ADD COLUMN IF NOT EXISTS processing_result_json TEXT NOT NULL DEFAULT '{}'")

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

        cur.execute("DROP TABLE IF EXISTS user_profile CASCADE")

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

        cur.execute("DELETE FROM system_prompts WHERE type = 'persona_config'")

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
        cur.execute("DROP TABLE IF EXISTS prompts CASCADE")

def _init_system_prompts() -> None:
    with _cur() as cur:
        for name, ptype, rel_path in _SYSTEM_PROMPTS:
            fpath = _PROMPTS_DIR / rel_path
            if not fpath.exists():
                continue
            content = fpath.read_text(encoding="utf-8")
            cur.execute(
                "SELECT id FROM system_prompts WHERE type = %s ORDER BY id ASC",
                (ptype,),
            )
            rows = cur.fetchall()
            if not rows:
                cur.execute(
                    "INSERT INTO system_prompts (name, type, content, is_default)"
                    " VALUES (%s, %s, %s, TRUE)",
                    (name, ptype, content),
                )
                continue

            keep_id = rows[0][0]
            cur.execute(
                "DELETE FROM system_prompts WHERE type = %s AND id <> %s",
                (ptype, keep_id),
            )
            cur.execute(
                "UPDATE system_prompts SET name = %s, content = %s, is_default = TRUE, updated_at = NOW()"
                " WHERE id = %s",
                (name, content, keep_id),
            )
