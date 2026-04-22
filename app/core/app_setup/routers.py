from typing import Optional

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse

from app.api.routes import (
    admin_dashboard,
    ai,
    auth as auth_routes,
    bots,
    config as config_routes,
    db_prompts,
    debug_outgoing,
    email_automation_rules,
    email_records,
    gmail_actions,
    gmail_compose,
    health,
    prompts,
    reply_format,
    stats_logs,
    telegram_tools,
    users,
)
from app.core import auth as auth_mod
from app.core import config as app_config
from app.domains import worker
from app.domains.gmail.auth import exchange_code_for_token, get_oauth_url
from app.domains.gmail import telegram_updates as tg_updates
from app.utils.oauth_state import decode_oauth_state

API_PREFIX = "/api"


def register_all_routers(app: FastAPI) -> None:
    register_primary_api_routes(app)
    register_external_unprefixed_routes(app)


def register_primary_api_routes(app: FastAPI) -> None:
    for r in _primary_api_routers():
        app.include_router(r, prefix=API_PREFIX)

    app.include_router(_service_api_router(), prefix=API_PREFIX)


def register_external_unprefixed_routes(app: FastAPI) -> None:
    app.include_router(health.router)
    app.include_router(_legacy_api_router(), prefix=API_PREFIX)


def _primary_api_routers() -> list[APIRouter]:
    return [
        health.router,
        ai.router,
        email_records.router,
        auth_routes.router,
        users.router,
        bots.router,
        db_prompts.router,
        config_routes.router,
        prompts.router,
        stats_logs.router,
        gmail_actions.router,
        gmail_compose.router,
        telegram_tools.router,
        debug_outgoing.router,
        reply_format.router,
        email_automation_rules.router,
        admin_dashboard.router,
    ]


def _service_api_router() -> APIRouter:
    router = APIRouter()

    @router.get("/gmail/auth/url")
    def gmail_auth_get_url(request: Request, user: dict = Depends(auth_mod.current_user)):
        """Get Gmail OAuth authorization URL for current user"""
        try:
            redirect_uri = str(request.base_url).rstrip("/") + f"{API_PREFIX}/gmail/callback"
            url = get_oauth_url(redirect_uri, user_id=user["id"])
            return {"url": url}
        except FileNotFoundError as e:
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/gmail/auth")
    def gmail_auth(request: Request, user: Optional[dict] = Depends(auth_mod.get_current_user_or_none)):
        """Redirect to Google OAuth authorization page"""
        user_id = user["id"] if user else None
        try:
            redirect_uri = str(request.base_url).rstrip("/") + f"{API_PREFIX}/gmail/callback"
            url = get_oauth_url(redirect_uri, user_id=user_id)
            return RedirectResponse(url=url)
        except FileNotFoundError as e:
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/gmail/callback")
    def gmail_callback(
        request: Request,
        code: str,
        state: Optional[str] = None,
        user: Optional[dict] = Depends(auth_mod.get_current_user_or_none),
    ):
        """Handle Google OAuth callback, save token."""
        user_id = None
        if state:
            user_id = decode_oauth_state(state, app_config.JWT_SECRET)
        if user_id is None and user:
            user_id = user["id"]
        try:
            redirect_uri = str(request.base_url).rstrip("/") + f"{API_PREFIX}/gmail/callback"
            exchange_code_for_token(code, redirect_uri, user_id=user_id)
            return RedirectResponse(
                url=f"{app_config.FRONTEND_URL}/oauth/complete?provider=google&result=success"
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"OAuth callback failed: {str(e)}")

    @router.post("/worker/start")
    async def worker_start(user: dict = Depends(auth_mod.require_admin)):
        """Start the Gmail worker polling"""
        try:
            started = worker.request_start()
            status = worker.get_status()
            if status.get("running"):
                message = "already running"
            elif status.get("starting"):
                message = "starting"
            else:
                message = "start requested" if started else "ignored"
            return {"ok": True, "started": started, "status": status, "message": message}
        except RuntimeError as e:
            raise HTTPException(status_code=400, detail=str(e))

    @router.post("/worker/stop")
    def worker_stop(user: dict = Depends(auth_mod.require_admin)):
        """Stop the Gmail worker polling"""
        stopped = worker.stop()
        return {"ok": True, "stopped": stopped, "status": worker.get_status()}

    @router.get("/worker/status")
    def worker_status(user: dict = Depends(auth_mod.current_user)):
        """Get Gmail worker status and statistics"""
        if user.get("role") == "admin":
            return {"scope": "global", "system": worker.get_status(), "user": worker.get_user_status(user_id=int(user["id"]))}
        return {
            "scope": "user",
            "user": worker.get_user_status(user_id=int(user["id"])),
            "system": {"telegram_updates": tg_updates.status()},
        }

    @router.post("/worker/poll")
    async def worker_poll(user: dict = Depends(auth_mod.require_admin)):
        """Trigger polling now"""
        try:
            result = await worker.poll_now()
            return {"ok": True, **result}
        except RuntimeError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Polling failed: {str(e)}")

    return router


def _legacy_api_router() -> APIRouter:
    router = APIRouter()

    @router.get("/gmail/workstatus")
    def gmail_work_status(user: dict = Depends(auth_mod.current_user)):
        """Wrapper for Gmail worker status (frontend-friendly name)."""
        if user.get("role") == "admin":
            return {"scope": "global", "system": worker.get_status(), "user": worker.get_user_status(user_id=int(user["id"]))}
        return {
            "scope": "user",
            "user": worker.get_user_status(user_id=int(user["id"])),
            "system": {"telegram_updates": tg_updates.status()},
        }

    return router
