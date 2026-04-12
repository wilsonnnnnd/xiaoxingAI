from pathlib import Path
from dotenv import load_dotenv
import os

_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_PATH = _ROOT / ".env"
load_dotenv(_ENV_PATH)


def _get(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()


# Telegram
TELEGRAM_BOT_TOKEN: str = _get("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID:   str = _get("TELEGRAM_CHAT_ID")

# Gmail 轮询
GMAIL_POLL_INTERVAL: int  = int(_get("GMAIL_POLL_INTERVAL", "300"))
GMAIL_POLL_QUERY:    str  = _get("GMAIL_POLL_QUERY", "is:unread in:inbox")
GMAIL_POLL_MAX:      int  = int(_get("GMAIL_POLL_MAX", "5"))
GMAIL_MARK_READ:     bool = _get("GMAIL_MARK_READ", "true").lower() == "true"

# 优先级过滤（空列表 = 全部通知）
_priority_raw = _get("NOTIFY_MIN_PRIORITY", "")
NOTIFY_PRIORITIES: list[str] = [p.strip() for p in _priority_raw.split(",") if p.strip()]

# LLM 后端
# LLM_BACKEND=local  → 使用本地 llama-server（OpenAI 兼容接口）
# LLM_BACKEND=openai → 使用 OpenAI API
LLM_BACKEND:      str = _get("LLM_BACKEND", "local").lower()
LLM_API_URL:      str = _get("LLM_API_URL", "http://127.0.0.1:8001/v1/chat/completions")
LLM_MODEL:        str = _get("LLM_MODEL", "local-model")
OPENAI_API_KEY:   str = _get("OPENAI_API_KEY", "")

# Router 模型（小模型，用于工具路由意图识别）
# 留空则路由直接复用主模型
ROUTER_API_URL:   str = _get("ROUTER_API_URL", "http://127.0.0.1:8002/v1/chat/completions")
ROUTER_MODEL:     str = _get("ROUTER_MODEL", "local-router")

# Prompt 文件分配（各处理阶段使用哪个 prompt 文件）
# Gmail skill prompts 默认放在 prompts/gmail/ 子目录
PROMPT_ANALYZE:   str = _get("PROMPT_ANALYZE",  "gmail/email_analysis.txt")
PROMPT_SUMMARY:   str = _get("PROMPT_SUMMARY",   "gmail/email_summary.txt")
PROMPT_TELEGRAM:  str = _get("PROMPT_TELEGRAM",  "gmail/telegram_notify.txt")
PROMPT_CHAT:      str = _get("PROMPT_CHAT",       "chat.txt")
PROMPT_PROFILE:   str = _get("PROMPT_PROFILE",    "user_profile.txt")

# Redis
REDIS_URL:        str = _get("REDIS_URL", "redis://localhost:6380")

# PostgreSQL
POSTGRES_DSN:     str = _get("POSTGRES_DSN", "postgresql://postgres:postgres@localhost:5432/xiaoxing")

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
    if LLM_BACKEND == "openai" and not OPENAI_API_KEY:
        missing.append("OPENAI_API_KEY")
    return missing

def validate_gmail() -> list[str]:
    """返回启动 Gmail worker 所需但缺失的配置项（不包含 Telegram）"""
    missing: list[str] = []
    if LLM_BACKEND == "openai" and not OPENAI_API_KEY:
        missing.append("OPENAI_API_KEY")
    return missing


def validate_telegram() -> list[str]:
    """返回启动 Telegram bot 所需但缺失的配置项"""
    missing: list[str] = []
    if not TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN == "your_bot_token_here":
        missing.append("TELEGRAM_BOT_TOKEN")
    if not TELEGRAM_CHAT_ID or TELEGRAM_CHAT_ID == "your_chat_id_here":
        missing.append("TELEGRAM_CHAT_ID")
    return missing
