from fastapi import APIRouter
from app.core import redis_client as rc
from app.db.session import _cur
from app import db

router = APIRouter()


@router.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}


@router.get("/health")
def health():
    db_ok = False
    try:
        with _cur() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
        db_ok = True
    except Exception:
        db_ok = False
    redis_ok = rc.is_available()
    status = "ok" if db_ok else "error"
    user_count = None
    if db_ok:
        try:
            user_count = db.count_users()
        except Exception:
            user_count = None
    return {"status": status, "db": db_ok, "redis": redis_ok, "user_count": user_count}
