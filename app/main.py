import asyncio
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
    INTERNAL_PROMPT_DIRS, VALID_BOT_MODES
)
from app.schemas import (
    AdminLoginRequest, UserCreate, UserUpdate, 
    BotCreate, BotUpdate, PromptCreate, PromptUpdate, 
)
from app import db
from app.core import auth as auth_mod
from app.core import redis_client as rc
from app.core.step_log import start_step_log_buffer, stop_step_log_buffer
from app.skills.gmail import worker
from app.skills.gmail.auth import exchange_code_for_token, get_oauth_url
from app.utils.oauth_state import decode_oauth_state
from app.core.auth import get_current_user_or_none
from app.api.routes import (
    health, ai, email_records, auth as auth_routes, users, bots, 
    db_prompts, config as config_routes, 
    prompts, stats_logs, gmail_actions, gmail_compose, telegram_tools, debug_outgoing, reply_format,
    email_automation_rules,
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
    start_step_log_buffer()
    auth_mod.ensure_admin_exists()
    if app_config.REQUIRE_REDIS and not rc.is_available():
        raise RuntimeError("Redis 不可用（REQUIRE_REDIS=true）")
    if not app_config.REQUIRE_REDIS and not rc.is_available():
        logger.warning("Redis 不可用：Token 吊销/去重/缓存将降级失效")
    if app_config.AUTO_START_GMAIL_WORKER:
        async def _auto_start() -> None:
            try:
                await worker.start(allow_empty=True)
            except Exception as e:
                logger.warning("Gmail worker 自动恢复失败: %s", e)
        asyncio.create_task(_auto_start())
    logger.info(
        "服务已启动 | FRONTEND=%s | LLM=%s | ROUTER=%s",
        app_config.FRONTEND_URL,
        app_config.LLM_API_URL,
        app_config.ROUTER_API_URL or "(fallback to LLM)",
    )
    yield
    # 关闭时优雅停止 worker
    await worker.shutdown()
    await stop_step_log_buffer()


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
app.include_router(config_routes.router)
app.include_router(prompts.router)
app.include_router(stats_logs.router)
app.include_router(gmail_actions.router)
app.include_router(gmail_compose.router)
app.include_router(telegram_tools.router)
app.include_router(debug_outgoing.router)
app.include_router(reply_format.router)
app.include_router(email_automation_rules.router)

API_PREFIX = "/api"

app.include_router(health.router, prefix=API_PREFIX)
app.include_router(ai.router, prefix=API_PREFIX)
app.include_router(email_records.router, prefix=API_PREFIX)
app.include_router(auth_routes.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(bots.router, prefix=API_PREFIX)
app.include_router(db_prompts.router, prefix=API_PREFIX)
app.include_router(config_routes.router, prefix=API_PREFIX)
app.include_router(prompts.router, prefix=API_PREFIX)
app.include_router(stats_logs.router, prefix=API_PREFIX)
app.include_router(gmail_actions.router, prefix=API_PREFIX)
app.include_router(gmail_compose.router, prefix=API_PREFIX)
app.include_router(telegram_tools.router, prefix=API_PREFIX)
app.include_router(debug_outgoing.router, prefix=API_PREFIX)
app.include_router(reply_format.router, prefix=API_PREFIX)
app.include_router(email_automation_rules.router, prefix=API_PREFIX)


# ─────────────────────────────────────────
# Gmail OAuth
# ─────────────────────────────────────────

@app.get("/api/gmail/auth/url")
def gmail_auth_get_url(request: Request, user: dict = Depends(auth_mod.current_user)):
    """返回 Gmail OAuth 授权 URL（JSON）。前端用此接口获取 URL 后由 JS 跳转，可携带 user_id。"""
    try:
        redirect_uri = str(request.base_url).rstrip("/") + "/api/gmail/callback"
        url = get_oauth_url(redirect_uri, user_id=user["id"])
        return {"url": url}
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/gmail/auth")
def gmail_auth(request: Request, user: Optional[dict] = Depends(auth_mod.get_current_user_or_none)):
    """跳转到 Google OAuth 授权页面（浏览器直接跳转的兼容路由，无 JWT 时 user_id=None）"""
    user_id = user["id"] if user else None
    try:
        redirect_uri = str(request.base_url).rstrip("/") + "/api/gmail/callback"
        url = get_oauth_url(redirect_uri, user_id=user_id)
        return RedirectResponse(url=url)
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/gmail/callback")
def gmail_callback(request: Request, code: str,
                   state: Optional[str] = None,
                   user: Optional[dict] = Depends(auth_mod.get_current_user_or_none)):
    """返回 Google OAuth 回调，保存 token。优先从 state 参数恢复 user_id。"""
    # 优先 from OAuth state 参数恢复 user_id（由 /gmail/auth/url 编码进去）
    user_id = None
    if state:
        user_id = decode_oauth_state(state, app_config.JWT_SECRET)
    # 降级：若 state 未携带（旧路由 /gmail/auth 直接跳转），尝试 JWT
    if user_id is None and user:
        user_id = user["id"]
    try:
        redirect_uri = str(request.base_url).rstrip("/") + "/api/gmail/callback"
        exchange_code_for_token(code, redirect_uri, user_id=user_id)
        return RedirectResponse(url=f"{app_config.FRONTEND_URL}/oauth/complete?provider=google&result=success")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth 回调失败: {str(e)}")


# ─────────────────────────────────────────
# Worker 调度控制
# ─────────────────────────────────────────

@app.post("/api/worker/start")
async def worker_start(user: dict = Depends(auth_mod.require_admin)):
    """启动自动轮询 Worker"""
    try:
        started = await worker.start()
        return {"ok": True, "started": started, "status": worker.get_status()}
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/worker/stop")
def worker_stop(user: dict = Depends(auth_mod.require_admin)):
    """停止自动轮询 Worker"""
    stopped = worker.stop()
    return {"ok": True, "stopped": stopped, "status": worker.get_status()}


@app.get("/api/worker/status")
def worker_status(user: dict = Depends(auth_mod.current_user)):
    """获取 Worker 当前状态和统计"""
    return worker.get_status()


# ─────────────────────────────────────────
# 邮件记录
# ─────────────────────────────────────────


@app.post("/api/worker/poll")
async def worker_poll(user: dict = Depends(auth_mod.require_admin)):
    """立即触发一次轮询（无论 worker 是否在运行）"""
    try:
        result = await worker.poll_now()
        return {"ok": True, **result}
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"轮询失败: {str(e)}")


@app.websocket("/api/ws/worker/status")
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


# Backwards-compatible wrappers exposing explicit endpoints for separated statuses
@app.get("/api/gmail/workstatus")
def gmail_work_status(user: dict = Depends(auth_mod.current_user)):
    """Wrapper for Gmail worker status (frontend-friendly name)."""
    return worker.get_status()
