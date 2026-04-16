from __future__ import annotations

import asyncio
import logging
import threading
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from app import db


@dataclass(frozen=True)
class StepLogEntry:
    ts: str
    level: str
    msg: str
    log_type: str
    tokens: int
    user_id: Optional[int]


class StepLogBuffer:
    def __init__(self, *, flush_interval_secs: float = 1.0, max_batch: int = 200, max_pending: int = 5000) -> None:
        self.flush_interval_secs = float(flush_interval_secs)
        self.max_batch = int(max_batch)
        self.max_pending = int(max_pending)
        self._lock = threading.Lock()
        self._buf: deque[StepLogEntry] = deque()
        self._task: Optional[asyncio.Task] = None
        self._running = False

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        self._running = False
        t = self._task
        if t and not t.done():
            t.cancel()
            try:
                await t
            except asyncio.CancelledError:
                pass
        self._task = None
        await self.flush()

    def enqueue(self, entry: StepLogEntry) -> None:
        with self._lock:
            if len(self._buf) >= self.max_pending:
                self._buf.popleft()
            self._buf.append(entry)

    async def flush(self) -> None:
        batch: list[StepLogEntry] = []
        with self._lock:
            while self._buf and len(batch) < self.max_batch:
                batch.append(self._buf.popleft())
        if not batch:
            return
        rows = [
            {
                "user_id": e.user_id,
                "ts": e.ts,
                "level": e.level,
                "log_type": e.log_type,
                "tokens": e.tokens,
                "msg": e.msg,
            }
            for e in batch
        ]
        await asyncio.to_thread(db.insert_logs_bulk, rows)

    async def _run(self) -> None:
        while self._running:
            await asyncio.sleep(self.flush_interval_secs)
            try:
                await self.flush()
            except Exception:
                continue


_buffer: Optional[StepLogBuffer] = None


def start_step_log_buffer(*, flush_interval_secs: float = 1.0, max_batch: int = 200, max_pending: int = 5000) -> None:
    global _buffer
    if _buffer is None:
        _buffer = StepLogBuffer(
            flush_interval_secs=flush_interval_secs,
            max_batch=max_batch,
            max_pending=max_pending,
        )
    _buffer.start()


async def stop_step_log_buffer() -> None:
    global _buffer
    if _buffer is None:
        return
    await _buffer.stop()


def write_step_log(
    *,
    msg: str,
    level: str = "info",
    tokens: int = 0,
    user_id: Optional[int] = None,
    log_type: db.LogType = db.LogType.EMAIL,
    py_logger: Optional[logging.Logger] = None,
) -> None:
    ts = datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    entry = StepLogEntry(
        ts=ts,
        level=level,
        msg=msg,
        log_type=str(log_type.value),
        tokens=int(tokens or 0),
        user_id=user_id,
    )
    buf = _buffer
    if buf is None:
        db.insert_log(ts, level, msg, log_type, tokens=tokens, user_id=user_id)
    else:
        buf.enqueue(entry)

    if py_logger is None:
        return
    if level == "error":
        py_logger.error(msg)
    elif level == "warn":
        py_logger.warning(msg)
    else:
        py_logger.info(msg)
