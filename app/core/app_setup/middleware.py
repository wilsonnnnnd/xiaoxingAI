import logging
import time
from datetime import datetime, timezone
from typing import Dict

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core import config as app_config

logger = logging.getLogger("main")


def register_middleware(app: FastAPI) -> None:
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
        path = request.url.path

        is_processed_email_api = (
            path == "/emails/processed"
            or path.startswith("/emails/processed/")
            or path == "/api/emails/processed"
            or path.startswith("/api/emails/processed/")
        )
        start_dt = datetime.now(timezone.utc) if is_processed_email_api else None

        response = await call_next(request)
        end = time.perf_counter()
        ms = (end - start) * 1000
        logger.info("%s %s %d %.0fms", request.method, path, response.status_code, ms)

        if is_processed_email_api:
            end_dt = datetime.now(timezone.utc)
            qp = request.query_params
            safe_params: Dict[str, object] = {}
            for key in ("page", "page_size", "priority", "category", "has_reply_drafts"):
                value = qp.get(key)
                if value is not None and value != "":
                    safe_params[key] = value
            q_value = qp.get("q")
            if q_value:
                safe_params["q_len"] = len(q_value)

            logger.info(
                "[API] %s %s | %.0fms | start=%s end=%s | params=%s",
                request.method,
                path,
                ms,
                start_dt.isoformat() if start_dt else "",
                end_dt.isoformat(),
                safe_params,
            )

        return response

