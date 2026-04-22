"""
认证与授权模块 — JWT + bcrypt

功能：
- 签发 / 验证 JWT（Access Token，1小时过期）
- JWT 版本校验（Redis jwt:version:<user_id>，支持主动吊销）
- bcrypt 密码哈希（admin 账号使用）
- FastAPI 依赖注入：current_user / require_admin
- 启动时自动创建 admin 账号（若不存在）
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import bcrypt as _bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app import db
from app.core import config
from app.core import redis_client as rc

logger = logging.getLogger("auth")

# ── 密码哈希 ──────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ── JWT ──────────────────────────────────────────────────────────
_ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def create_access_token(user: Dict[str, Any]) -> str:
    """签发 JWT，payload 包含 sub / email / role / version / exp。"""
    version = _get_jwt_version(user["id"])
    payload = {
        "sub":     str(user["id"]),
        "email":   user["email"],
        "role":    user["role"],
        "version": version,
        "exp":     datetime.now(tz=timezone.utc) + timedelta(minutes=config.JWT_EXPIRE_MINUTES),
        "iat":     datetime.now(tz=timezone.utc),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=_ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    """解码并验证 JWT。抛出 HTTPException 表示无效。"""
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired, please log in again",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    # 版本校验（Redis 可用时）
    user_id = int(payload["sub"])
    current_version = _get_jwt_version(user_id)
    if current_version != payload.get("version", 0):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is no longer valid, please log in again",
        )

    return payload


def invalidate_user_tokens(user_id: int) -> None:
    """使指定用户的所有 JWT 失效（版本号 +1）。"""
    rc.bump_jwt_version(user_id)


def _get_jwt_version(user_id: int) -> int:
    """从 Redis 获取 JWT 版本号，不可达时返回 0（降级：仅验证签名）。"""
    return rc.get_jwt_version(user_id)


# ── FastAPI 依赖 ──────────────────────────────────────────────────

async def current_user(token: Optional[str] = Depends(oauth2_scheme)) -> Dict[str, Any]:
    """依赖注入：返回当前已登录用户信息。未提供或无效 token 则 401。"""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(token)
    user = db.get_user_by_id(int(payload["sub"]))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


async def require_admin(user: Dict[str, Any] = Depends(current_user)) -> Dict[str, Any]:
    """依赖注入：要求 admin 权限，否则 403。"""
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return user


def get_current_user_or_none(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[Dict[str, Any]]:
    """可选认证：token 有效则返回用户，无 token 或无效则返回 None（不抛异常）。"""
    if not token:
        return None
    try:
        payload = decode_token(token)
        return db.get_user_by_id(int(payload["sub"]))
    except HTTPException:
        return None


# ── 权限辅助 ─────────────────────────────────────────────────────

def assert_self_or_admin(current: Dict[str, Any], target_user_id: int) -> None:
    """断言：当前用户是本人或 admin，否则抛 403。"""
    if current["role"] == "admin":
        return
    if current["id"] == target_user_id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authorized to access other users' data",
    )


# ── 启动时创建 admin ──────────────────────────────────────────────

def ensure_admin_exists() -> None:
    """
    服务启动时调用。
    若数据库中不存在 role='admin' 的用户，则使用环境变量创建默认 admin。
    """
    users = db.list_users()
    has_admin = any(u["role"] == "admin" for u in users)
    if has_admin:
        return

    email = config.ADMIN_USER.strip()
    password = config.ADMIN_PASSWORD.strip()

    if not email or not password:
        logger.warning(
            "[auth] no admin user found and ADMIN_USER / ADMIN_PASSWORD are not configured; "
            "create an admin manually or set env vars and restart."
        )
        return

    db.create_user(
        email=email,
        display_name="Admin",
        role="admin",
        password_hash=hash_password(password),
    )
    logger.info("[auth] auto-created admin user: %s", email)
