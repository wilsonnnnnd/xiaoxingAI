from collections import deque
from typing import Any, Deque, Dict, List


_events: Deque[Dict[str, Any]] = deque(maxlen=200)


def record(event: Dict[str, Any]) -> None:
    _events.append(event)


def list_events(limit: int = 100) -> List[Dict[str, Any]]:
    if limit <= 0:
        return []
    return list(_events)[-limit:]


def clear() -> None:
    _events.clear()
