from __future__ import annotations

from typing import Callable, Optional, TypeVar

from fastapi import HTTPException

T = TypeVar("T")


def run_http(
    fn: Callable[[], T],
    *,
    runtime_error_status: Optional[int] = None,
    error_status: int = 500,
    error_prefix: Optional[str] = None,
) -> T:
    try:
        return fn()
    except HTTPException:
        raise
    except RuntimeError as e:
        if runtime_error_status is None:
            raise
        raise HTTPException(status_code=runtime_error_status, detail=str(e))
    except Exception as e:
        detail = str(e) if error_prefix is None else f"{error_prefix}: {e}"
        raise HTTPException(status_code=error_status, detail=detail)

