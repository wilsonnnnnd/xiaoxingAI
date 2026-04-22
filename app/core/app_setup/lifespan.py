import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import db
from app.core import auth as auth_mod
from app.core import config as app_config
from app.core import redis_client as rc
from app.core.step_log import start_step_log_buffer, stop_step_log_buffer
from app.domains import worker

logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    start_step_log_buffer()
    auth_mod.ensure_admin_exists()

    if app_config.REQUIRE_REDIS and not rc.is_available():
        raise RuntimeError("Redis is not available (REQUIRE_REDIS=true)")
    if not app_config.REQUIRE_REDIS and not rc.is_available():
        logger.warning("Redis is not available: Token revocation/duplication/caching will be disabled")

    if app_config.AUTO_START_GMAIL_WORKER:

        async def _auto_start() -> None:
            try:
                await worker.start(allow_empty=True)
            except Exception as e:
                logger.warning("Gmail worker auto-restart failed: %s", e)

        asyncio.create_task(_auto_start())

    logger.info(
        "Service started | FRONTEND=%s | LLM=%s | ROUTER=%s",
        app_config.FRONTEND_URL,
        app_config.LLM_API_URL,
        app_config.ROUTER_API_URL or "(fallback to LLM)",
    )

    yield

    await worker.shutdown()
    await stop_step_log_buffer()
