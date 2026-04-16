import importlib
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Dict, List, Optional

from dotenv import set_key
from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from pathlib import Path

from app.core import config as app_config
from app.core.constants import (
    ALLOWED_CONFIG_KEYS, DEFAULT_PROMPTS, INTERNAL_PROMPTS, 
    INTERNAL_PROMPT_DIRS, VALID_BOT_MODES, VALID_PERSONA_CATS,
    PERSONA_LABEL_MAP
)
from app.schemas import (
    AdminLoginRequest, UserCreate, UserUpdate, 
    BotCreate, BotUpdate, PromptCreate, PromptUpdate, 
    PersonaConfigSave, ChatPersonaRequest
)
from app import db
from app.core import auth as auth_mod
from app.skills.gmail import worker
from app.core import bot_worker as tg_bot_worker
from app.skills.gmail.auth import exchange_code_for_token, get_oauth_url
from app.core.auth import get_current_user_or_none
from app.api.routes import (
    health, ai, email_records, auth as auth_routes, users, bots, 
    db_prompts, admin_persona, config as config_routes, 
    prompts, stats_logs, gmail_actions, gmail_compose, telegram_tools, chat, debug_outgoing, reply_format
)


# ── Logging ──────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 初始化数据库（建表 + 自动迁移旧 JSON 文件）
    db.init_db()
    auth_mod.ensure_admin_exists()
    if app_config.AUTO_START_GMAIL_WORKER:
        try:
            await worker.start(allow_empty=True)
        except Exception as e:
            logger.warning("Gmail worker 自动恢复失败: %s", e)
    logger.info(
        "服务已启动 | FRONTEND=%s | LLM=%s | ROUTER=%s",
        app_config.FRONTEND_URL,
        app_config.LLM_API_URL,
        app_config.ROUTER_API_URL or "(fallback to LLM)",
    )
    yield
    # 关闭时优雅停止 worker 和 tg bot
    await worker.shutdown()
    await tg_bot_worker.stop()


app = FastAPI(
    title="Gmail AI Manager",
    version="0.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[app_config.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def _log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - start) * 1000
    logger.info("%s %s %d %.0fms", request.method, request.url.path, response.status_code, ms)
    return response


app.include_router(health.router)
app.include_router(ai.router)
app.include_router(email_records.router)
app.include_router(auth_routes.router)
app.include_router(users.router)
app.include_router(bots.router)
app.include_router(db_prompts.router)
app.include_router(admin_persona.router)
app.include_router(config_routes.router)
app.include_router(prompts.router)
app.include_router(stats_logs.router)
app.include_router(gmail_actions.router)
app.include_router(gmail_compose.router)
app.include_router(telegram_tools.router)
app.include_router(chat.router)
app.include_router(debug_outgoing.router)
app.include_router(reply_format.router)

API_PREFIX = "/api"

app.include_router(health.router, prefix=API_PREFIX)
app.include_router(ai.router, prefix=API_PREFIX)
app.include_router(email_records.router, prefix=API_PREFIX)
app.include_router(auth_routes.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(bots.router, prefix=API_PREFIX)
app.include_router(db_prompts.router, prefix=API_PREFIX)
app.include_router(admin_persona.router, prefix=API_PREFIX)
app.include_router(config_routes.router, prefix=API_PREFIX)
app.include_router(prompts.router, prefix=API_PREFIX)
app.include_router(stats_logs.router, prefix=API_PREFIX)
app.include_router(gmail_actions.router, prefix=API_PREFIX)
app.include_router(gmail_compose.router, prefix=API_PREFIX)
app.include_router(telegram_tools.router, prefix=API_PREFIX)
app.include_router(chat.router, prefix=API_PREFIX)
app.include_router(debug_outgoing.router, prefix=API_PREFIX)
app.include_router(reply_format.router, prefix=API_PREFIX)


# ─────────────────────────────────────────
# Gmail OAuth
# ─────────────────────────────────────────

@app.get("/api/gmail/auth/url")
@app.get("/gmail/auth/url")
def gmail_auth_get_url(request: Request, user: dict = Depends(auth_mod.current_user)):
    """返回 Gmail OAuth 授权 URL（JSON）。前端用此接口获取 URL 后由 JS 跳转，可携带 user_id。"""
    try:
        redirect_uri = str(request.base_url).rstrip("/") + "/gmail/callback"
        url = get_oauth_url(redirect_uri, user_id=user["id"])
        return {"url": url}
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/gmail/auth")
@app.get("/gmail/auth")
def gmail_auth(request: Request, user: Optional[dict] = Depends(auth_mod.get_current_user_or_none)):
    """跳转到 Google OAuth 授权页面（浏览器直接跳转的兼容路由，无 JWT 时 user_id=None）"""
    user_id = user["id"] if user else None
    try:
        redirect_uri = str(request.base_url).rstrip("/") + "/gmail/callback"
        url = get_oauth_url(redirect_uri, user_id=user_id)
        return RedirectResponse(url=url)
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/gmail/callback")
@app.get("/gmail/callback")
def gmail_callback(request: Request, code: str,
                   state: Optional[str] = None,
                   user: Optional[dict] = Depends(auth_mod.get_current_user_or_none)):
    """返回 Google OAuth 回调，保存 token。优先从 state 参数恢复 user_id。"""
    # 优先 from OAuth state 参数恢复 user_id（由 /gmail/auth/url 编码进去）
    user_id = None
    if state:
        try:
            user_id = int(state)
        except (ValueError, TypeError):
            pass
    # 降级：若 state 未携带（旧路由 /gmail/auth 直接跳转），尝试 JWT
    if user_id is None and user:
        user_id = user["id"]
    try:
        redirect_uri = str(request.base_url).rstrip("/") + "/gmail/callback"
        exchange_code_for_token(code, redirect_uri, user_id=user_id)
        return RedirectResponse(url=f"{app_config.FRONTEND_URL}?auth=success")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth 回调失败: {str(e)}")


# ─────────────────────────────────────────
# Worker 调度控制
# ─────────────────────────────────────────

@app.post("/api/worker/start")
@app.post("/worker/start")
async def worker_start():
    """启动自动轮询 Worker"""
    try:
        started = await worker.start()
        return {"ok": True, "started": started, "status": worker.get_status()}
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/worker/stop")
@app.post("/worker/stop")
def worker_stop():
    """停止自动轮询 Worker"""
    stopped = worker.stop()
    return {"ok": True, "stopped": stopped, "status": worker.get_status()}


@app.get("/api/worker/status")
@app.get("/worker/status")
def worker_status():
    """获取 Worker 当前状态和统计"""
    return worker.get_status()


# ─────────────────────────────────────────
# 邮件记录
# ─────────────────────────────────────────


@app.post("/api/worker/poll")
@app.post("/worker/poll")
async def worker_poll():
    """立即触发一次轮询（无论 worker 是否在运行）"""
    try:
        result = await worker.poll_now()
        return {"ok": True, **result}
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"轮询失败: {str(e)}")


@app.websocket("/api/ws/worker/status")
@app.websocket("/ws/worker/status")
async def ws_worker_status(websocket: WebSocket):
    await websocket.accept()
    from app.core.realtime import ws as ws_pub
    q = ws_pub.subscribe_worker()
    try:
        # send current status immediately
        await websocket.send_json(worker.get_status())
        while True:
            status = await q.get()
            await websocket.send_json(status)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        ws_pub.unsubscribe_worker(q)


@app.websocket("/api/ws/bot/status")
@app.websocket("/ws/bot/status")
async def ws_bot_status(websocket: WebSocket):
    await websocket.accept()
    from app.core.realtime import ws as ws_pub
    q = ws_pub.subscribe_bot()
    try:
        # send current bot status immediately
        await websocket.send_json({"running": tg_bot_worker.is_running()})
        while True:
            status = await q.get()
            await websocket.send_json(status)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        ws_pub.unsubscribe_bot(q)


# ─────────────────────────────────────────
# Telegram Bot 聊天 Worker
# ─────────────────────────────────────────

@app.post("/api/telegram/bot/start")
@app.post("/telegram/bot/start")
async def tg_bot_start():
    """启动 Telegram Bot 聊天 Worker（长轮询）"""
    try:
        started = await tg_bot_worker.start()
        return {"ok": True, "started": started, "running": tg_bot_worker.is_running()}
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/telegram/bot/stop")
@app.post("/telegram/bot/stop")
async def tg_bot_stop():
    """停止 Telegram Bot 聊天 Worker"""
    await tg_bot_worker.stop()
    return {"ok": True, "running": False}


@app.get("/api/telegram/bot/status")
@app.get("/telegram/bot/status")
def tg_bot_status():
    """返回 Bot Worker 运行状态"""
    return {"running": tg_bot_worker.is_running()}


# Backwards-compatible wrappers exposing explicit endpoints for separated statuses
@app.get("/api/gmail/workstatus")
@app.get("/gmail/workstatus")
def gmail_work_status():
    """Wrapper for Gmail worker status (frontend-friendly name)."""
    return worker.get_status()


@app.get("/api/chat/workstatus")
@app.get("/chat/workstatus")
def chat_work_status():
    """Wrapper for Chat (Telegram bot) worker status (frontend-friendly name)."""
    return {"running": tg_bot_worker.is_running()}
