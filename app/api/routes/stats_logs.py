from typing import Optional
from fastapi import APIRouter, Depends
from app import db
from app.core import auth as auth_mod

router = APIRouter()

@router.get("/worker/logs")
def worker_logs(limit: int = 20, log_type: Optional[str] = None, before_id: Optional[int] = None,
                from_ts: Optional[str] = None, to_ts: Optional[str] = None,
                user: dict = Depends(auth_mod.current_user)):
    """返回 Worker 最近步骤日志。admin 可见全部，普通用户只见自己的。"""
    uid = None if user.get("role") == "admin" else user["id"]
    lt = db.LogType(log_type) if log_type else None
    safe_limit = max(1, min(limit, 100))
    return {"logs": db.get_recent_logs(safe_limit, lt, user_id=uid, before_id=before_id, from_ts=from_ts, to_ts=to_ts)}

@router.get("/worker/logs/window")
def worker_logs_window(limit: int = 20, log_type: Optional[str] = None, before_id: Optional[int] = None,
                       from_ts: Optional[str] = None, to_ts: Optional[str] = None,
                       user: dict = Depends(auth_mod.current_user)):
    uid = None if user.get("role") == "admin" else user["id"]
    lt = db.LogType(log_type) if log_type else None
    safe_limit = max(1, min(limit, 100))
    logs = db.get_recent_logs(safe_limit, lt, user_id=uid, before_id=before_id, from_ts=from_ts, to_ts=to_ts)
    return {
        "logs": logs,
        "from_ts": logs[0]["ts"] if logs else None,
        "to_ts": logs[-1]["ts"] if logs else None,
    }


@router.delete("/worker/logs")
def worker_logs_clear(log_type: Optional[str] = None,
                      user: dict = Depends(auth_mod.current_user)):
    """清空日志。admin 删全部（或按 log_type），普通用户只删自己的。"""
    uid = None if user.get("role") == "admin" else user["id"]
    deleted = db.clear_logs(log_type, user_id=uid)
    return {"ok": True, "deleted": deleted}


@router.get("/db/stats")
def db_stats(user: dict = Depends(auth_mod.current_user)):
    """返回数据库统计信息，has_token 按当前用户 ID 过滤"""
    return db.get_stats(user_id=user["id"])
