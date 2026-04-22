import logging

from fastapi import FastAPI

from app.core.app_setup.lifespan import lifespan
from app.core.app_setup.middleware import register_middleware
from app.core.app_setup.routers import register_all_routers
from app.core.app_setup.websocket import register_websocket


def create_app() -> FastAPI:
    _configure_logging()

    app = FastAPI(
        title="Gmail AI Manager",
        version="0.1.0",
        lifespan=lifespan,
    )

    register_middleware(app)
    register_all_routers(app)
    register_websocket(app)

    return app


def _configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

