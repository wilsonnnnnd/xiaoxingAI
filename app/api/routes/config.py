import importlib
import os
import hashlib
from typing import Dict

from dotenv import set_key
from fastapi import APIRouter, Depends, HTTPException

from app.core import auth as auth_mod
from app.core import config as app_config
from app.core.ai_usage import normalize_pricing_json, pricing_table_for_api
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
    try:
        pricing_json = normalize_pricing_json(app_config.AI_PRICING_JSON)
    except Exception:
        pricing_json = normalize_pricing_json("")
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
        "AI_PRICING_JSON":    pricing_json,
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
        "UI_LANG":            app_config.UI_LANG,
    }


@router.post("/config")
def config_update(payload: Dict[str, str], user: dict = Depends(auth_mod.require_admin)):
    """更新 .env 文件并热重载配置，无需重启服务"""
    if not app_config._ENV_PATH.exists():
        raise HTTPException(status_code=500, detail=".env file does not exist, please create it first")

    unknown = set(payload.keys()) - ALLOWED_CONFIG_KEYS
    if unknown:
        raise HTTPException(status_code=422, detail=f"Config keys not allowed to be modified: {unknown}")

    if "AI_PRICING_JSON" in payload:
        try:
            payload["AI_PRICING_JSON"] = normalize_pricing_json(payload.get("AI_PRICING_JSON"))
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Invalid AI_PRICING_JSON: {exc}") from exc

    for key, value in payload.items():
        if key in {"OPENAI_API_KEY", "LLM_API_KEY", "ROUTER_API_KEY"} and (value or "").strip() == "":
            continue
        set_key(str(app_config._ENV_PATH), key, value)
        os.environ[key] = value

    importlib.reload(app_config)
    return {"ok": True, "config": config_get(user)}


@router.get("/config/pricing")
def pricing_config_get(user: dict = Depends(auth_mod.require_admin)):
    return pricing_table_for_api()


@router.post("/config/pricing")
def pricing_config_update(payload: Dict[str, str], user: dict = Depends(auth_mod.require_admin)):
    raw = str(payload.get("AI_PRICING_JSON") or "").strip()
    if not app_config._ENV_PATH.exists():
        raise HTTPException(status_code=500, detail=".env file does not exist, please create it first")

    normalized = normalize_pricing_json(raw)
    set_key(str(app_config._ENV_PATH), "AI_PRICING_JSON", normalized)
    os.environ["AI_PRICING_JSON"] = normalized
    importlib.reload(app_config)
    return {"ok": True, "pricing": pricing_table_for_api(), "raw": normalize_pricing_json(app_config.AI_PRICING_JSON)}
