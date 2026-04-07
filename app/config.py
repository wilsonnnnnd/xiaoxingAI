from pathlib import Path
from dotenv import load_dotenv
import os

_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_ROOT / ".env")


def _get(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()


# Telegram
TELEGRAM_BOT_TOKEN: str = _get("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID:   str = _get("TELEGRAM_CHAT_ID")

# Gmail 轮询
GMAIL_POLL_INTERVAL: int  = int(_get("GMAIL_POLL_INTERVAL", "300"))
GMAIL_POLL_QUERY:    str  = _get("GMAIL_POLL_QUERY", "is:unread in:inbox")
GMAIL_POLL_MAX:      int  = int(_get("GMAIL_POLL_MAX", "20"))
GMAIL_MARK_READ:     bool = _get("GMAIL_MARK_READ", "true").lower() == "true"

# 优先级过滤（空列表 = 全部通知）
_priority_raw = _get("NOTIFY_MIN_PRIORITY", "")
NOTIFY_PRIORITIES: list[str] = [p.strip() for p in _priority_raw.split(",") if p.strip()]

# LLM 后端
# LLM_BACKEND=local  → 使用本地 llama-server（OpenAI 兼容接口）
# LLM_BACKEND=openai → 使用 OpenAI API
LLM_BACKEND:      str = _get("LLM_BACKEND", "local").lower()
LLM_API_URL:      str = _get("LLM_API_URL", "http://127.0.0.2:8001/v1/chat/completions")
LLM_MODEL:        str = _get("LLM_MODEL", "local-model")
OPENAI_API_KEY:   str = _get("OPENAI_API_KEY", "")

# Prompt 文件分配（各处理阶段使用哪个 prompt 文件）
# Gmail skill prompts 默认放在 prompts/gmail/ 子目录
PROMPT_ANALYZE:   str = _get("PROMPT_ANALYZE",  "gmail/email_analysis.txt")
PROMPT_SUMMARY:   str = _get("PROMPT_SUMMARY",   "gmail/email_summary.txt")
PROMPT_TELEGRAM:  str = _get("PROMPT_TELEGRAM",  "gmail/telegram_notify.txt")
PROMPT_CHAT:      str = _get("PROMPT_CHAT",       "chat.txt")
PROMPT_PROFILE:   str = _get("PROMPT_PROFILE",    "user_profile.txt")

# UI language for web pages (en / zh)
UI_LANG:          str = _get("UI_LANG", "en").lower()

# Frontend URL — used for OAuth callback redirect and CORS
# In development: http://localhost:5173 (Vite dev server)
# In production:  your deployed frontend origin
FRONTEND_URL:     str = _get("FRONTEND_URL", "http://localhost:5173").rstrip("/")


def validate() -> list[str]:
    """返回缺失的必填配置项列表"""
    missing = []
    if not TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN == "your_bot_token_here":
        missing.append("TELEGRAM_BOT_TOKEN")
    if not TELEGRAM_CHAT_ID or TELEGRAM_CHAT_ID == "your_chat_id_here":
        missing.append("TELEGRAM_CHAT_ID")
    if LLM_BACKEND == "openai" and not OPENAI_API_KEY:
        missing.append("OPENAI_API_KEY")
    return missing
