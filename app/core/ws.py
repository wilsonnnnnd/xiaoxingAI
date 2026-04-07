import asyncio
from typing import Any, Dict, Set

# Separate subscriber sets for Gmail worker and Telegram bot statuses
_worker_subscribers: Set[asyncio.Queue] = set()
_bot_subscribers: Set[asyncio.Queue] = set()


def subscribe_worker() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue()
    _worker_subscribers.add(q)
    return q


def unsubscribe_worker(q: asyncio.Queue) -> None:
    _worker_subscribers.discard(q)


def publish_worker_status(status: Dict[str, Any]) -> None:
    for q in list(_worker_subscribers):
        try:
            q.put_nowait(status)
        except Exception:
            _worker_subscribers.discard(q)


def subscribe_bot() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue()
    _bot_subscribers.add(q)
    return q


def unsubscribe_bot(q: asyncio.Queue) -> None:
    _bot_subscribers.discard(q)


def publish_bot_status(status: Dict[str, Any]) -> None:
    for q in list(_bot_subscribers):
        try:
            q.put_nowait(status)
        except Exception:
            _bot_subscribers.discard(q)
