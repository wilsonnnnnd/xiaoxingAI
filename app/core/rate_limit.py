import threading
import time
from typing import Dict, Tuple

from app.core import redis_client as rc


class RateLimiter:
    def __init__(self, *, limit: int, window_secs: int, prefix: str):
        self.limit = int(limit)
        self.window_secs = int(window_secs)
        self.prefix = str(prefix)
        self._lock = threading.Lock()
        self._mem: Dict[str, Tuple[float, int]] = {}

    def hit(self, key: str) -> int:
        k = f"{self.prefix}:{key}"
        n = rc.incr_with_ttl(k, self.window_secs)
        if n is not None:
            return int(n)
        now = time.time()
        with self._lock:
            reset_at, count = self._mem.get(k, (0.0, 0))
            if now > reset_at:
                reset_at = now + self.window_secs
                count = 0
            count += 1
            self._mem[k] = (reset_at, count)
            return count

    def reset(self, key: str) -> None:
        k = f"{self.prefix}:{key}"
        rc.delete_key(k)
        with self._lock:
            self._mem.pop(k, None)
