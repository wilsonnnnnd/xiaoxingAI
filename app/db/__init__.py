from .base import init_db, LogType
from .session import _cur

from typing import Any, Dict, List, Optional
from app.core import config

# ── Repository Imports & Re-exports ───────────────────────────────────

from .repositories import (
    user_repo, bot_repo, prompt_repo, log_repo,
    email_repo, stats_repo, oauth_repo, profile_repo, persona_repo, outgoing_email_repo, reply_format_repo
)

# User
from .repositories.user_repo import (
    create_user, get_user_by_email, get_user_by_id,
    list_users, list_worker_enabled_users, update_user
)

# Bot
from .repositories.bot_repo import (
    create_bot, get_bot, get_bots_by_user, get_default_bot,
    get_all_bots, get_notify_bots, update_bot, set_default_bot, delete_bot
)

# Prompt
from .repositories.prompt_repo import (
    get_prompts, get_prompt, create_prompt, update_prompt, delete_prompt,
    get_user_prompt, save_user_prompt, delete_user_prompt, list_user_prompt_names
)

# Log
from .repositories.log_repo import (
    insert_log, get_recent_logs, clear_logs, cleanup_old_logs
)

# Email
from .repositories.email_repo import (
    save_email_record, get_email_records, get_email_record,
    count_email_records, is_email_processed
)

# Stats
from .repositories.stats_repo import (
    get_worker_stats, save_worker_stats
)

# OAuth
from .repositories.oauth_repo import (
    load_token_json, save_token_json
)

# Outgoing Email
from .repositories.outgoing_email_repo import (
    create_draft_stub,
    set_draft_body_encrypted,
    get_draft,
    get_draft_any,
    get_draft_by_preview_message,
    update_draft_status,
    confirm_draft,
    cancel_draft,
    start_sending,
    expire_pending,
    set_preview_message,
    set_preview_delivery,
    update_draft_recipient,
    set_send_result_success,
    set_send_result_failed,
    insert_action,
    list_outgoing_actions,
    list_outgoing_drafts,
)

from .repositories.reply_format_repo import (
    list_reply_templates,
    get_reply_template,
    create_reply_template,
    update_reply_template,
    delete_reply_template,
    get_reply_format_settings,
    upsert_reply_format_settings,
)

# Profile
from .repositories.profile_repo import (
    get_profile, save_profile, delete_profile, get_profile_updated_at
)

# Persona
from .repositories.persona_repo import (
    get_persona_configs, upsert_persona_config
)

# ── Logic remaining in root (to be refactored later) ─────────────────

def get_active_prompt(ptype: str, user_id: Optional[int] = None, bot_id: Optional[int] = None) -> Optional[str]:
    """按优先级获取 prompt 内容：bot 绑定 → 用户默认 → 系统内置。"""
    with _cur() as cur:
        # 1. Bot 绑定的专属 chat prompt（来自 user_prompts）
        if bot_id is not None and ptype == "chat":
            cur.execute(
                "SELECT p.content FROM user_prompts p"
                " JOIN bot b ON b.chat_prompt_id = p.id"
                " WHERE b.id = %s",
                (bot_id,),
            )
            row = cur.fetchone()
            if row:
                return row[0]
        # 2. 用户自定义默认（user_prompts）
        if user_id is not None:
            cur.execute(
                "SELECT content FROM user_prompts"
                " WHERE user_id = %s AND type = %s AND is_default = TRUE LIMIT 1",
                (user_id, ptype),
            )
            row = cur.fetchone()
            if row:
                return row[0]
        # 3. 系统内置（system_prompts，is_default=TRUE 优先）
        cur.execute(
            "SELECT content FROM system_prompts"
            " WHERE type = %s AND is_default = TRUE LIMIT 1",
            (ptype,),
        )
        row = cur.fetchone()
        if row:
            return row[0]
        cur.execute(
            "SELECT content FROM system_prompts WHERE type = %s LIMIT 1",
            (ptype,),
        )
        row = cur.fetchone()
        return row[0] if row else None

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
            cur.execute("SELECT COUNT(*) FROM log"); log_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM email_records"); record_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM oauth_tokens"); has_token = cur.fetchone()[0]

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
