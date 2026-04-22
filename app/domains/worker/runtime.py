from __future__ import annotations

from typing import Any, Dict

from app.domains.gmail import worker as _gmail_worker


async def start(*, allow_empty: bool = False) -> None:
    await _gmail_worker.start(allow_empty=allow_empty)


async def shutdown() -> None:
    await _gmail_worker.shutdown()


def request_start() -> bool:
    return _gmail_worker.request_start()


def stop() -> bool:
    return _gmail_worker.stop()


def get_status() -> Dict[str, Any]:
    return _gmail_worker.get_status()


def get_user_status(*, user_id: int) -> Dict[str, Any]:
    return _gmail_worker.get_user_status(user_id=user_id)


async def poll_now() -> Dict[str, Any]:
    return await _gmail_worker.poll_now()


async def ensure_user_running(user_id: int) -> bool:
    return await _gmail_worker.ensure_user_running(user_id)


def stop_user(user_id: int) -> bool:
    return _gmail_worker.stop_user(user_id)
