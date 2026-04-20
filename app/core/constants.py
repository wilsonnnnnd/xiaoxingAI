from pathlib import Path

# ─────────────────────────────────────────
# 配置相关常量
# ─────────────────────────────────────────

ALLOWED_CONFIG_KEYS = {
    "LLM_BACKEND", "LLM_API_URL", "LLM_MODEL",
    "LLM_API_KEY", "ROUTER_API_KEY",
    "ROUTER_API_URL", "ROUTER_MODEL",
    "OPENAI_API_KEY",
    "GMAIL_POLL_INTERVAL", "GMAIL_POLL_QUERY", "GMAIL_POLL_MAX",
    "GMAIL_MARK_READ", "NOTIFY_MIN_PRIORITY",
    "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID",
    "TELEGRAM_WEBHOOK_BASE_URL", "TELEGRAM_WEBHOOK_SECRET",
    "PROMPT_ANALYZE", "PROMPT_SUMMARY", "PROMPT_TELEGRAM",
    "UI_LANG",
    "OUTGOING_EMAIL_ENCRYPTION_KEY", "TELEGRAM_CALLBACK_SECRET", "OUTGOING_DRAFT_TTL_MINUTES",
}

# ─────────────────────────────────────────
# Prompt 相关常量
# ─────────────────────────────────────────

DEFAULT_PROMPTS = {
    "gmail/email_analysis.txt",
    "gmail/email_summary.txt",
    "gmail/telegram_notify.txt",
}

# 系统内部使用的 prompt，不暴露给前端
INTERNAL_PROMPTS = set()

# 隐藏整个子目录下的 Prompt 文件（相对于 prompts 目录的相对路径前缀）
INTERNAL_PROMPT_DIRS = {"tools"}

# ─────────────────────────────────────────
# 业务逻辑常量与枚举
# ─────────────────────────────────────────

VALID_BOT_MODES = {"all", "notify"}
