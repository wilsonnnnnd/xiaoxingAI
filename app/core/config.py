from pathlib import Path
from dotenv import load_dotenv
import os
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_PATH = _ROOT / ".env"
load_dotenv(_ENV_PATH)


def _get(key: str, default: str = "") -> str:
    v = os.environ.get(key, default)
    if v is None:
        return ""
    s = str(v).strip()
    while s and s[0] in {"`", '"', "'"} and s[-1] == s[0]:
        s = s[1:-1].strip()
    return s


def _get_raw(key: str, default: str = "") -> str:
    v = os.environ.get(key, default)
    if v is None:
        return ""
    return str(v).strip()


# Telegram
TELEGRAM_BOT_TOKEN: str = _get("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID:   str = _get("TELEGRAM_CHAT_ID")
TELEGRAM_WEBHOOK_BASE_URL: str = _get("TELEGRAM_WEBHOOK_BASE_URL", "").rstrip("/")
TELEGRAM_WEBHOOK_SECRET: str = _get("TELEGRAM_WEBHOOK_SECRET", "")

# Gmail 轮询
GMAIL_POLL_INTERVAL: int  = int(_get("GMAIL_POLL_INTERVAL", "300"))
GMAIL_POLL_QUERY:    str  = _get("GMAIL_POLL_QUERY", "is:unread in:inbox category:primary")
GMAIL_POLL_MAX:      int  = int(_get("GMAIL_POLL_MAX", "5"))
GMAIL_MARK_READ:     bool = _get("GMAIL_MARK_READ", "true").lower() == "true"
AUTO_START_GMAIL_WORKER: bool = _get("AUTO_START_GMAIL_WORKER", "false").lower() == "true"
GMAIL_WORKER_IO_CONCURRENCY: int = int(_get("GMAIL_WORKER_IO_CONCURRENCY", "8"))
GMAIL_WORKER_IO_MAX_WORKERS: int = int(_get("GMAIL_WORKER_IO_MAX_WORKERS", "12"))
GMAIL_WORKER_START_JITTER_MAX: int = int(_get("GMAIL_WORKER_START_JITTER_MAX", "15"))
GMAIL_WORKER_START_BUCKETS: int = int(_get("GMAIL_WORKER_START_BUCKETS", "12"))

ALLOW_PUBLIC_REGISTER: bool = _get("ALLOW_PUBLIC_REGISTER", "false").lower() == "true"
REGISTER_INVITE_CODE: str = _get("REGISTER_INVITE_CODE", "").strip()
REGISTER_EMAIL_ALLOWLIST: str = _get("REGISTER_EMAIL_ALLOWLIST", "").strip()

# 优先级过滤（空列表 = 全部通知）
_priority_raw = _get("NOTIFY_MIN_PRIORITY", "")
NOTIFY_PRIORITIES: list[str] = [p.strip() for p in _priority_raw.split(",") if p.strip()]

# LLM 后端
# LLM_BACKEND=local  → 使用本地 llama-server（OpenAI 兼容接口）
# LLM_BACKEND=openai → 使用 OpenAI API
LLM_BACKEND:      str = _get("LLM_BACKEND", "local").lower()
LLM_API_URL:      str = _get("LLM_API_URL", "http://127.0.0.1:8001/v1/chat/completions")
LLM_MODEL:        str = _get("LLM_MODEL", "local-model")
LLM_API_KEY:      str = _get("LLM_API_KEY", "") or _get("OPENAI_API_KEY", "")
OPENAI_API_KEY:   str = _get("OPENAI_API_KEY", "")

# Router 模型（小模型，用于工具路由意图识别）
# 留空则路由直接复用主模型
ROUTER_API_URL:   str = _get("ROUTER_API_URL", "")
ROUTER_MODEL:     str = _get("ROUTER_MODEL", "")
ROUTER_API_KEY:   str = _get("ROUTER_API_KEY", "")
AI_PRICING_JSON:  str = _get_raw("AI_PRICING_JSON", "")

# Prompt 文件分配（各处理阶段使用哪个 prompt 文件）
# Gmail skill prompts 默认放在 prompts/gmail/ 子目录
PROMPT_ANALYZE:   str = _get("PROMPT_ANALYZE",  "gmail/email_analysis.txt")
PROMPT_SUMMARY:   str = _get("PROMPT_SUMMARY",   "gmail/email_summary.txt")
PROMPT_TELEGRAM:  str = _get("PROMPT_TELEGRAM",  "gmail/telegram_notify.txt")

# Redis
REDIS_URL:        str = _get("REDIS_URL", "redis://localhost:6380")
REQUIRE_REDIS:    bool = _get("REQUIRE_REDIS", "false").lower() == "true"

# PostgreSQL
DB_SSLMODE:      str = _get("DB_SSLMODE", "")
DB_POOL_MINCONN: int = int(_get("DB_POOL_MINCONN", "1"))
DB_POOL_MAXCONN: int = int(_get("DB_POOL_MAXCONN", "10"))
DB_ALLOW_LEGACY_DROP: bool = _get("DB_ALLOW_LEGACY_DROP", "false").lower() == "true"

_DEFAULT_DSN = "postgresql://postgres:postgres@localhost:5432/xiaoxing"
_RAW_DSN: str = _get("SUPABASE_DB_DSN") or _get("DATABASE_URL") or _get("POSTGRES_DSN", _DEFAULT_DSN)

def _ensure_sslmode(dsn: str) -> str:
    try:
        u = urlparse(dsn)
        if not u.scheme or not u.netloc:
            return dsn
        q = dict(parse_qsl(u.query, keep_blank_values=True))
        if "sslmode" in q:
            return dsn
        sslmode = DB_SSLMODE
        host = (u.hostname or "").lower()
        if not sslmode and "supabase" in host:
            sslmode = "require"
        if not sslmode:
            return dsn
        q["sslmode"] = sslmode
        return urlunparse(u._replace(query=urlencode(q)))
    except Exception:
        return dsn

POSTGRES_DSN: str = _ensure_sslmode(_RAW_DSN)

# Auth (JWT)
JWT_SECRET:          str = _get("JWT_SECRET", "change-me-in-production")
JWT_EXPIRE_MINUTES:  int = int(_get("JWT_EXPIRE_MINUTES", "60"))
ADMIN_USER:          str = _get("ADMIN_USER", "")
ADMIN_PASSWORD:      str = _get("ADMIN_PASSWORD", "")

# UI language for web pages (en / zh)
UI_LANG:          str = _get("UI_LANG", "en").lower()

# Frontend URL — used for OAuth callback redirect and CORS
# In development: http://localhost:5173 (Vite dev server)
# In production:  your deployed frontend origin
FRONTEND_URL:     str = _get("FRONTEND_URL", "http://localhost:5173").rstrip("/")

OUTGOING_EMAIL_ENCRYPTION_KEY: str = _get("OUTGOING_EMAIL_ENCRYPTION_KEY", "")
TELEGRAM_CALLBACK_SECRET:      str = _get("TELEGRAM_CALLBACK_SECRET", "")
OUTGOING_DRAFT_TTL_MINUTES:    int = int(_get("OUTGOING_DRAFT_TTL_MINUTES", "30"))

OUTGOING_EMAIL_ENCRYPTION_KEY_RAW: str = _get_raw("OUTGOING_EMAIL_ENCRYPTION_KEY", "")
TELEGRAM_CALLBACK_SECRET_RAW:      str = _get_raw("TELEGRAM_CALLBACK_SECRET", "")

# Prompts directory
PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


def validate() -> list[str]:
    """返回缺失的必填配置项列表（兼容旧调用，检查所有必需项）"""
    missing = []
    # Keep previous behavior for callers that expect a global validation
    if not TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN == "your_bot_token_here":
        missing.append("TELEGRAM_BOT_TOKEN")
    if not TELEGRAM_CHAT_ID or TELEGRAM_CHAT_ID == "your_chat_id_here":
        missing.append("TELEGRAM_CHAT_ID")
    if LLM_BACKEND == "openai" and not LLM_API_KEY:
        missing.append("LLM_API_KEY")
    return missing

def validate_gmail() -> list[str]:
    """返回启动 Gmail worker 所需但缺失的配置项（不包含 Telegram）"""
    missing: list[str] = []
    if LLM_BACKEND == "openai" and not LLM_API_KEY:
        missing.append("LLM_API_KEY")
    return missing


def validate_telegram() -> list[str]:
    """返回启动 Telegram bot 所需但缺失的配置项"""
    missing: list[str] = []
    if not TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN == "your_bot_token_here":
        missing.append("TELEGRAM_BOT_TOKEN")
    if not TELEGRAM_CHAT_ID or TELEGRAM_CHAT_ID == "your_chat_id_here":
        missing.append("TELEGRAM_CHAT_ID")
    return missing
