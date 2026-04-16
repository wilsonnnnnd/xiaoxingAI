import asyncio
from typing import Any, Dict, Set


_worker_subscribers: Set[asyncio.Queue] = set()


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
