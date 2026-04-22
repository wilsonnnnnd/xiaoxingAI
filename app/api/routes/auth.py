import logging

from fastapi import APIRouter, Depends, HTTPException, Request

from app import db
from app.core import auth as auth_mod
from app.core import config as app_config
from app.core.rate_limit import RateLimiter
from app.schemas import AdminLoginRequest, ChangePasswordRequest, RegisterRequest
from app.services.admin_notify import notify_admin_new_user

router = APIRouter()

logger = logging.getLogger("main")
_login_limiter = RateLimiter(limit=10, window_secs=900, prefix="rl:login")
_register_ip_limiter = RateLimiter(limit=12, window_secs=900, prefix="rl:register:ip")
_register_email_limiter = RateLimiter(limit=5, window_secs=900, prefix="rl:register:email")
_register_global_limiter = RateLimiter(limit=60, window_secs=900, prefix="rl:register:global")


@router.post("/auth/login")
def admin_login(payload: AdminLoginRequest, request: Request):
    """账号密码登录，返回 JWT（admin 和普通用户均可登录）"""
    ip = request.client.host if request.client else "unknown"
    key = f"{ip}:{(payload.email or '').strip().lower()}"
    n = _login_limiter.hit(key)
    if n > 10:
        raise HTTPException(status_code=429, detail="Too many login attempts, please try again later")
    user = db.get_user_by_email(payload.email)
    if not user or not user.get("password_hash"):
        logger.warning("[auth] login failed (user not found): %s", payload.email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not auth_mod.verify_password(payload.password, user["password_hash"]):
        logger.warning("[auth] login failed (wrong password): %s", payload.email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = auth_mod.create_access_token(user)
    _login_limiter.reset(key)
    logger.info("[auth] login success: %s (role=%s)", payload.email, user["role"])
    return {"access_token": token, "token_type": "bearer"}


@router.post("/auth/register")
def auth_register(payload: RegisterRequest, request: Request):
    ip = request.client.host if request.client else "unknown"
    email = (payload.email or "").strip().lower()
    _register_global_limiter.hit("all")
    if _register_ip_limiter.hit(ip) > 12:
        raise HTTPException(status_code=429, detail="Too many registration attempts, please try again later")
    if email and _register_email_limiter.hit(email) > 5:
        raise HTTPException(status_code=429, detail="Too many registration attempts, please try again later")

    if not email or "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Invalid email address")
    if payload.website and str(payload.website).strip():
        raise HTTPException(status_code=400, detail="Invalid registration request")

    invite_code = (payload.invite_code or "").strip()
    invite_consumed = False
    if not app_config.ALLOW_PUBLIC_REGISTER:
        if not invite_code:
            raise HTTPException(status_code=403, detail="Invite code required")
        if app_config.REGISTER_INVITE_CODE and invite_code == app_config.REGISTER_INVITE_CODE:
            invite_consumed = False
        else:
            invite_consumed = bool(db.consume_register_invite(invite_code, email, ip))
            if not invite_consumed:
                raise HTTPException(status_code=403, detail="Invite code is invalid or expired")

    allowlist = {x.strip().lower() for x in (app_config.REGISTER_EMAIL_ALLOWLIST or "").split(",") if x.strip()}
    if allowlist:
        domain = email.split("@")[-1].lower()
        if domain not in allowlist:
            raise HTTPException(status_code=403, detail="Email domain is not allowed")

    pw = payload.password or ""
    if len(pw) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    has_letter = any(ch.isalpha() for ch in pw)
    has_digit = any(ch.isdigit() for ch in pw)
    if not (has_letter and has_digit):
        raise HTTPException(status_code=400, detail="Password must contain both letters and numbers")
    if db.get_user_by_email(email):
        raise HTTPException(status_code=409, detail="Email is already registered")

    try:
        new_user = db.create_user(
            email=email,
            display_name=(payload.display_name or "").strip() or None,
            role="user",
            password_hash=auth_mod.hash_password(payload.password),
            ui_lang=((payload.ui_lang or "").strip().lower() in {"zh", "en"} and (payload.ui_lang or "").strip().lower()) or "en",
            notify_lang=((payload.notify_lang or "").strip().lower() in {"zh", "en"} and (payload.notify_lang or "").strip().lower()) or "en",
        )
    except Exception:
        if invite_consumed and invite_code:
            try:
                db.release_register_invite(invite_code, email)
            except Exception:
                pass
        raise

    if invite_consumed and invite_code:
        try:
            db.finalize_register_invite(invite_code, int(new_user.get("id") or 0))
        except Exception:
            pass
    try:
        notify_admin_new_user(user=new_user)
    except Exception:
        pass

    token = auth_mod.create_access_token(db.get_user_by_email(email) or {})
    _register_ip_limiter.reset(ip)
    _register_email_limiter.reset(email)
    logger.info("[auth] registration success: %s", email)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/auth/me")
def auth_me(user: dict = Depends(auth_mod.current_user)):
    """返回当前登录用户信息"""
    safe = {k: v for k, v in user.items() if k != "password_hash"}
    return safe


@router.post("/auth/change-password")
def change_password(payload: ChangePasswordRequest, user: dict = Depends(auth_mod.current_user)):
    password_hash = user.get("password_hash")
    if not password_hash:
        raise HTTPException(status_code=400, detail="This account does not have a password set")
    if not auth_mod.verify_password(payload.old_password, password_hash):
        raise HTTPException(status_code=401, detail="Old password is incorrect")
    if not payload.new_password or len(payload.new_password) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters")
    if payload.new_password == payload.old_password:
        raise HTTPException(status_code=400, detail="New password must be different from the old password")
    db.update_user(user["id"], password_hash=auth_mod.hash_password(payload.new_password))
    auth_mod.invalidate_user_tokens(user["id"])
    token = auth_mod.create_access_token(db.get_user_by_id(user["id"]) or user)
    return {"ok": True, "access_token": token, "token_type": "bearer"}
