import importlib
import os
import hashlib
from typing import Dict

from dotenv import set_key
from fastapi import APIRouter, Depends, HTTPException

from app.core import auth as auth_mod
from app.core import config as app_config
from app.core.constants import ALLOWED_CONFIG_KEYS

router = APIRouter()

def _fp(s: str) -> str:
    v = (s or "").strip()
    if not v:
        return "none"
    return "sha256:" + hashlib.sha256(v.encode("utf-8")).hexdigest()[:10]

@router.get("/config")
def config_get(user: dict = Depends(auth_mod.require_admin)):
    """返回当前运行时配置（从内存读取，与 .env 一致）"""
    llm_key = app_config.LLM_API_KEY or app_config.OPENAI_API_KEY
    llm_key_src = "LLM_API_KEY" if app_config.LLM_API_KEY else ("OPENAI_API_KEY" if app_config.OPENAI_API_KEY else "none")
    router_key = app_config.ROUTER_API_KEY
    return {
        "LLM_BACKEND":        app_config.LLM_BACKEND,
        "LLM_API_URL":        app_config.LLM_API_URL,
        "LLM_MODEL":          app_config.LLM_MODEL,
        "LLM_API_KEY":        "",
        "ROUTER_API_KEY":     "",
        "HAS_LLM_API_KEY":    bool(app_config.LLM_API_KEY or app_config.OPENAI_API_KEY),
        "HAS_ROUTER_API_KEY": bool(app_config.ROUTER_API_KEY),
        "LLM_API_KEY_FINGERPRINT": _fp(llm_key),
        "LLM_API_KEY_SOURCE": llm_key_src,
        "ROUTER_API_KEY_FINGERPRINT": _fp(router_key),
        "ROUTER_API_URL":     app_config.ROUTER_API_URL,
        "ROUTER_MODEL":       app_config.ROUTER_MODEL,
        "GMAIL_POLL_INTERVAL": str(app_config.GMAIL_POLL_INTERVAL),
        "GMAIL_POLL_QUERY":   app_config.GMAIL_POLL_QUERY,
        "GMAIL_POLL_MAX":     str(app_config.GMAIL_POLL_MAX),
        "GMAIL_MARK_READ":    str(app_config.GMAIL_MARK_READ).lower(),
        "NOTIFY_MIN_PRIORITY": ",".join(app_config.NOTIFY_PRIORITIES),
        "TELEGRAM_BOT_TOKEN": app_config.TELEGRAM_BOT_TOKEN,
        "TELEGRAM_CHAT_ID":   app_config.TELEGRAM_CHAT_ID,
        "PROMPT_ANALYZE":     app_config.PROMPT_ANALYZE,
        "PROMPT_SUMMARY":     app_config.PROMPT_SUMMARY,
        "PROMPT_TELEGRAM":    app_config.PROMPT_TELEGRAM,
        "PROMPT_CHAT":        app_config.PROMPT_CHAT,
        "PROMPT_PROFILE":     app_config.PROMPT_PROFILE,
        "UI_LANG":            app_config.UI_LANG,
    }


@router.post("/config")
def config_update(payload: Dict[str, str], user: dict = Depends(auth_mod.require_admin)):
    """更新 .env 文件并热重载配置，无需重启服务"""
    if not app_config._ENV_PATH.exists():
        raise HTTPException(status_code=500, detail=".env 文件不存在，请先创建")

    unknown = set(payload.keys()) - ALLOWED_CONFIG_KEYS
    if unknown:
        raise HTTPException(status_code=422, detail=f"不允许修改的配置项: {unknown}")

    for key, value in payload.items():
        if key in {"OPENAI_API_KEY", "LLM_API_KEY", "ROUTER_API_KEY"} and (value or "").strip() == "":
            continue
        set_key(str(app_config._ENV_PATH), key, value)
        os.environ[key] = value

    importlib.reload(app_config)
    return {"ok": True, "config": config_get(user)}
