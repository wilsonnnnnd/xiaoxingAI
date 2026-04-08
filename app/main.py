import importlib
import os
from contextlib import asynccontextmanager
from typing import Dict, List, Optional

from dotenv import set_key
from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from pathlib import Path
from pydantic import BaseModel

from app import config as app_config
from app import db
from app.core import auth as auth_mod
from app.skills.gmail.schemas import EmailRequest, GmailFetchRequest, GmailProcessRequest
from app.skills.gmail.pipeline import analyze_email, summarize_email, write_telegram_message, process_email
from app.core.telegram import send_message, test_connection, get_latest_chat_id
from app.skills.gmail import worker
from app.core import bot_worker as tg_bot_worker
from app.skills.gmail.auth import get_oauth_url, exchange_code_for_token
from app.skills.gmail.client import fetch_emails, fetch_unread_emails, mark_as_read
from app.core.auth import get_current_user_or_none


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 初始化数据库（建表 + 自动迁移旧 JSON 文件）
    db.init_db()
    auth_mod.ensure_admin_exists()
    yield
    # 关闭时优雅停止 worker 和 tg bot
    await worker.shutdown()
    await tg_bot_worker.stop()


app = FastAPI(
    title="Gmail AI Manager",
    version="0.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[app_config.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ai/ping")
def ai_ping():
    """测试 LLM 连接：发送最小 prompt，验证 API 可达且返回正常"""
    from app.core.llm import call_llm
    try:
        reply, _ = call_llm("Reply with the single word: pong", max_tokens=10)
        return {"ok": True, "backend": app_config.LLM_BACKEND, "reply": reply.strip()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/ai/analyze")
def ai_analyze(payload: EmailRequest):
    try:
        result = analyze_email(payload.subject, payload.body)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"analyze failed: {str(e)}")


@app.post("/ai/summary")
def ai_summary(payload: EmailRequest):
    try:
        analysis = analyze_email(payload.subject, payload.body)
        result = summarize_email(payload.subject, payload.body, analysis["result"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"summary failed: {str(e)}")


@app.post("/ai/process")
def ai_process(payload: EmailRequest):
    """完整流程：分析 → 摘要 → 生成 Telegram 通知"""
    try:
        result = process_email(payload.subject, payload.body)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"process failed: {str(e)}")


# ─────────────────────────────────────────
# Gmail OAuth
# ─────────────────────────────────────────

@app.get("/gmail/auth/url")
def gmail_auth_get_url(request: Request, user: dict = Depends(auth_mod.current_user)):
    """返回 Gmail OAuth 授权 URL（JSON）。前端用此接口获取 URL 后由 JS 跳转，可携带 user_id。"""
    try:
        redirect_uri = str(request.base_url).rstrip("/") + "/gmail/callback"
        url = get_oauth_url(redirect_uri, user_id=user["id"])
        return {"url": url}
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/gmail/auth")
def gmail_auth(request: Request, user: Optional[dict] = Depends(auth_mod.get_current_user_or_none)):
    """跳转到 Google OAuth 授权页面（浏览器直接跳转的兼容路由，无 JWT 时 user_id=None）"""
    user_id = user["id"] if user else None
    try:
        redirect_uri = str(request.base_url).rstrip("/") + "/gmail/callback"
        url = get_oauth_url(redirect_uri, user_id=user_id)
        return RedirectResponse(url=url)
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/gmail/callback")
def gmail_callback(request: Request, code: str,
                   state: Optional[str] = None,
                   user: Optional[dict] = Depends(auth_mod.get_current_user_or_none)):
    """返回 Google OAuth 回调，保存 token。优先从 state 参数恢复 user_id。"""
    # 优先从 OAuth state 参数恢复 user_id（由 /gmail/auth/url 编码进去）
    user_id = None
    if state:
        try:
            user_id = int(state)
        except (ValueError, TypeError):
            pass
    # 降级：若 state 未携带（旧路由 /gmail/auth 直接跳转），尝试 JWT
    if user_id is None and user:
        user_id = user["id"]
    try:
        redirect_uri = str(request.base_url).rstrip("/") + "/gmail/callback"
        exchange_code_for_token(code, redirect_uri, user_id=user_id)
        return RedirectResponse(url=f"{app_config.FRONTEND_URL}?auth=success")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth 回调失败: {str(e)}")


# ─────────────────────────────────────────
# Gmail 拉取邮件
# ─────────────────────────────────────────

@app.post("/gmail/fetch")
def gmail_fetch(payload: GmailFetchRequest):
    """从 Gmail 拉取邮件列表（不做 AI 处理）"""
    try:
        emails = fetch_emails(query=payload.query, max_results=payload.max_results)
        return {"count": len(emails), "emails": emails}
    except RuntimeError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"拉取失败: {str(e)}")


@app.post("/gmail/process")
def gmail_process(payload: GmailProcessRequest):
    """从 Gmail 拉取邮件并对每封执行完整 AI 处理流程"""
    try:
        emails = fetch_emails(query=payload.query, max_results=payload.max_results)
    except RuntimeError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"拉取失败: {str(e)}")

    results = []
    for email in emails:
        try:
            processed = process_email(
                email["subject"],
                email["body"] or email["snippet"],
                sender=email.get("from", ""),
                date=email.get("date", ""),
                email_id=email.get("id", ""),
            )
            processed["id"]   = email["id"]
            processed["from"] = email["from"]
            processed["date"] = email["date"]

            sent = False
            if payload.send_telegram:
                send_message(processed["telegram_message"], parse_mode="HTML")
                processed["telegram_sent"] = True
                sent = True

            if payload.mark_read and email["id"]:
                mark_as_read(email["id"])

            if email.get("id"):
                db.save_email_record(
                    email_id=email["id"],
                    subject=email["subject"],
                    sender=email.get("from", ""),
                    date=email.get("date", ""),
                    body=email.get("body") or email.get("snippet", ""),
                    analysis=processed.get("analysis", {}),
                    summary=processed.get("summary", {}),
                    telegram_msg=processed.get("telegram_message", ""),
                    tokens=processed.get("tokens", 0),
                    priority=processed.get("analysis", {}).get("priority", ""),
                    sent_telegram=sent,
                )

            results.append({"status": "ok", **processed})
        except Exception as e:
            results.append({
                "status": "error",
                "id":      email["id"],
                "subject": email["subject"],
                "error":   str(e)
            })

    return {"count": len(results), "results": results}


# ─────────────────────────────────────────
# Worker 调度控制
# ─────────────────────────────────────────

@app.post("/worker/start")
async def worker_start():
    """启动自动轮询 Worker"""
    try:
        started = await worker.start()
        return {"ok": True, "started": started, "status": worker.get_status()}
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/worker/stop")
def worker_stop():
    """停止自动轮询 Worker"""
    stopped = worker.stop()
    return {"ok": True, "stopped": stopped, "status": worker.get_status()}


@app.get("/worker/status")
def worker_status():
    """获取 Worker 当前状态和统计"""
    return worker.get_status()


@app.get("/worker/logs")
def worker_logs(limit: int = 100, log_type: Optional[str] = None,
                user: dict = Depends(auth_mod.current_user)):
    """返回 Worker 最近步骤日志。admin 可见全部，普通用户只见自己的。"""
    uid = None if user.get("role") == "admin" else user["id"]
    lt = db.LogType(log_type) if log_type else None
    return {"logs": db.get_recent_logs(min(limit, 200), lt, user_id=uid)}


@app.delete("/worker/logs")
def worker_logs_clear(log_type: Optional[str] = None,
                      user: dict = Depends(auth_mod.current_user)):
    """清空日志。admin 删全部（或按 log_type），普通用户只删自己的。"""
    uid = None if user.get("role") == "admin" else user["id"]
    deleted = db.clear_logs(log_type, user_id=uid)
    return {"ok": True, "deleted": deleted}


@app.get("/db/stats")
def db_stats():
    """返回数据库统计信息"""
    return db.get_stats()


# ─────────────────────────────────────────
# 邮件记录
# ─────────────────────────────────────────

@app.get("/email/records")
def email_records_list(limit: int = 50, priority: Optional[str] = None):
    """返回邮件处理记录列表（按处理时间倒序）"""
    return {"count": db.count_email_records(), "records": db.get_email_records(limit=limit, priority=priority)}


@app.get("/email/records/{email_id}")
def email_record_detail(email_id: str):
    """返回单条邮件处理记录详情"""
    record = db.get_email_record(email_id)
    if record is None:
        raise HTTPException(status_code=404, detail="邮件记录不存在")
    return record


@app.post("/worker/poll")
async def worker_poll():
    """立即触发一次轮询（无论 worker 是否在运行）"""
    try:
        result = await worker.poll_now()
        return {"ok": True, **result}
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"轮询失败: {str(e)}")


@app.websocket("/ws/worker/status")
async def ws_worker_status(websocket: WebSocket):
    await websocket.accept()
    from app.core import ws as ws_pub
    q = ws_pub.subscribe_worker()
    try:
        # send current status immediately
        await websocket.send_json(worker.get_status())
        while True:
            status = await q.get()
            await websocket.send_json(status)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        ws_pub.unsubscribe_worker(q)


@app.websocket("/ws/bot/status")
async def ws_bot_status(websocket: WebSocket):
    await websocket.accept()
    from app.core import ws as ws_pub
    q = ws_pub.subscribe_bot()
    try:
        # send current bot status immediately
        await websocket.send_json({"running": tg_bot_worker.is_running()})
        while True:
            status = await q.get()
            await websocket.send_json(status)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        ws_pub.unsubscribe_bot(q)


# ─────────────────────────────────────────
# Telegram 配置测试
# ─────────────────────────────────────────

@app.post("/telegram/test")
def telegram_test():
    """发送测试消息验证 Telegram 配置是否正确"""
    try:
        ok = test_connection()
        return {"ok": ok}
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"发送失败: {str(e)}")


@app.get("/telegram/chat_id")
def telegram_get_chat_id(token: str = ""):
    """
    使用给定的 Bot Token 调用 getUpdates，返回最新一条消息的 chat_id。
    前端轮询此接口以自动获取 TELEGRAM_CHAT_ID。
    """
    use_token = token.strip() or app_config.TELEGRAM_BOT_TOKEN
    if not use_token:
        raise HTTPException(status_code=400, detail="请先填写 TELEGRAM_BOT_TOKEN")
    try:
        chat_id = get_latest_chat_id(use_token)
        return {"chat_id": chat_id}   # None 表示暂无消息
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


# ─────────────────────────────────────────
# Telegram Bot 聊天 Worker
# ─────────────────────────────────────────

@app.post("/telegram/bot/start")
async def tg_bot_start():
    """启动 Telegram Bot 聊天 Worker（长轮询）"""
    try:
        started = await tg_bot_worker.start()
        return {"ok": True, "started": started, "running": tg_bot_worker.is_running()}
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/telegram/bot/stop")
async def tg_bot_stop():
    """停止 Telegram Bot 聊天 Worker"""
    await tg_bot_worker.stop()
    return {"ok": True, "running": False}


@app.get("/telegram/bot/status")
def tg_bot_status():
    """返回 Bot Worker 运行状态"""
    return {"running": tg_bot_worker.is_running()}


# Backwards-compatible wrappers exposing explicit endpoints for separated statuses
@app.get("/gmail/workstatus")
def gmail_work_status():
    """Wrapper for Gmail worker status (frontend-friendly name)."""
    return worker.get_status()


@app.get("/chat/workstatus")
def chat_work_status():
    """Wrapper for Chat (Telegram bot) worker status (frontend-friendly name)."""
    return {"running": tg_bot_worker.is_running()}


@app.post("/telegram/bot/clear_history")
def tg_bot_clear_history():
    """清空所有对话历史记录"""
    tg_bot_worker.clear_history()
    return {"ok": True}


@app.get("/telegram/bot/profile")
def tg_bot_profile_get():
    """获取当前默认 Bot 的用户画像（多账号迁移中：暂用 bot_id=1 查找）"""
    try:
        bots = db.get_all_bots()
        if not bots:
            return {"chat_id": None, "profile": "", "updated_at": None}
        first_bot = bots[0]
        bot_id = first_bot["id"]
        profile    = db.get_profile(bot_id)
        updated_at = db.get_profile_updated_at(bot_id)
        return {"chat_id": first_bot["chat_id"], "profile": profile, "updated_at": updated_at}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/telegram/bot/profile")
def tg_bot_profile_delete():
    """删除当前默认 Bot 的用户画像"""
    try:
        bots = db.get_all_bots()
        if not bots:
            raise HTTPException(status_code=404, detail="暂无已注册的 Bot")
        db.delete_profile(bots[0]["id"])
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/telegram/bot/generate_profile")
def tg_bot_generate_profile():
    """手动触发用户画像生成（基于今日聊天记录），生成后清空今日记录，供调试使用"""
    bots = db.get_all_bots()
    if not bots:
        raise HTTPException(status_code=400, detail="暂无已注册的 Bot")
    bot_id = bots[0]["id"]
    try:
        profile, tokens = tg_bot_worker.generate_profile_now(bot_id)
        return {"ok": True, "bot_id": bot_id, "profile": profile, "tokens": tokens}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"画像生成失败: {str(e)}")


# ─────────────────────────────────────────
# 配置读写
# ─────────────────────────────────────────

_ALLOWED_CONFIG_KEYS = {
    "LLM_BACKEND", "LLM_API_URL", "LLM_MODEL", "OPENAI_API_KEY",
    "GMAIL_POLL_INTERVAL", "GMAIL_POLL_QUERY", "GMAIL_POLL_MAX",
    "GMAIL_MARK_READ", "NOTIFY_MIN_PRIORITY",
    "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID",
    "PROMPT_ANALYZE", "PROMPT_SUMMARY", "PROMPT_TELEGRAM", "PROMPT_CHAT", "PROMPT_PROFILE",
    "UI_LANG",
}

_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


@app.get("/config")
def config_get(user: dict = Depends(auth_mod.require_admin)):
    """返回当前运行时配置（从内存读取，与 .env 一致）"""
    return {
        "LLM_BACKEND":        app_config.LLM_BACKEND,
        "LLM_API_URL":        app_config.LLM_API_URL,
        "LLM_MODEL":          app_config.LLM_MODEL,
        "OPENAI_API_KEY":     app_config.OPENAI_API_KEY,
        "GMAIL_POLL_INTERVAL": str(app_config.GMAIL_POLL_INTERVAL),
        "GMAIL_POLL_QUERY":   app_config.GMAIL_POLL_QUERY,
        "GMAIL_POLL_MAX":     str(app_config.GMAIL_POLL_MAX),
        "GMAIL_MARK_READ":    str(app_config.GMAIL_MARK_READ).lower(),
        "NOTIFY_MIN_PRIORITY": ",".join(app_config.NOTIFY_PRIORITIES),
        "TELEGRAM_BOT_TOKEN": app_config.TELEGRAM_BOT_TOKEN,
        "TELEGRAM_CHAT_ID":   app_config.TELEGRAM_CHAT_ID,
        "PROMPT_ANALYZE":     app_config.PROMPT_ANALYZE,
        "PROMPT_SUMMARY":     app_config.PROMPT_SUMMARY,
        "PROMPT_TELEGRAM":    app_config.PROMPT_TELEGRAM,
        "PROMPT_CHAT":        app_config.PROMPT_CHAT,
        "PROMPT_PROFILE":     app_config.PROMPT_PROFILE,
        "UI_LANG":            app_config.UI_LANG,
    }


@app.post("/config")
def config_update(payload: Dict[str, str], user: dict = Depends(auth_mod.require_admin)):
    """更新 .env 文件并热重载配置，无需重启服务"""
    if not _ENV_PATH.exists():
        raise HTTPException(status_code=500, detail=".env 文件不存在，请先创建")

    unknown = set(payload.keys()) - _ALLOWED_CONFIG_KEYS
    if unknown:
        raise HTTPException(status_code=422, detail=f"不允许修改的配置项: {unknown}")

    for key, value in payload.items():
        set_key(str(_ENV_PATH), key, value)
        os.environ[key] = value

    importlib.reload(app_config)
    return {"ok": True, "config": config_get()}


# ─────────────────────────────────────────
# Prompt 文件读写
# ─────────────────────────────────────────

_PROMPTS_DIR    = Path(__file__).resolve().parent / "prompts"
_DEFAULT_PROMPTS = {
    "gmail/email_analysis.txt",
    "gmail/email_summary.txt",
    "gmail/telegram_notify.txt",
    "chat.txt",
    "user_profile.txt",
}


def _check_prompt_filename(filename: str) -> None:
    """拒绝路径穿越或非 .txt 文件名，允许一级子目录（如 gmail/xxx.txt）"""
    if not filename or filename.strip() != filename:
        raise HTTPException(status_code=400, detail="文件名不合法")
    if ".." in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="文件名不合法")
    if not filename.endswith(".txt"):
        raise HTTPException(status_code=400, detail="仅支持 .txt 文件")
    # 防止路径穿越：解析后必须仍在 prompts 目录内
    resolved = (_PROMPTS_DIR / filename).resolve()
    if not str(resolved).startswith(str(_PROMPTS_DIR.resolve())):
        raise HTTPException(status_code=400, detail="文件名不合法")


@app.get("/prompts")
def prompts_list(user: dict = Depends(auth_mod.current_user)):
    """列出所有可用 Prompt 文件：磁盘内置 + 用户在 DB 中创建的自定义文件。"""
    disk_files = sorted(
        str(p.relative_to(_PROMPTS_DIR)).replace("\\", "/")
        for p in _PROMPTS_DIR.rglob("*.txt")
        if p.is_file()
    )
    user_names = db.list_user_prompt_names(user["id"])
    disk_set = set(disk_files)
    extra = [n for n in user_names if n not in disk_set]
    all_files = sorted(disk_set | set(extra))
    return {
        "files": all_files,
        "defaults": sorted(_DEFAULT_PROMPTS),
        "custom": sorted(user_names),
    }


@app.get("/prompts/{filename:path}")
def prompt_get(filename: str, user: dict = Depends(auth_mod.current_user)):
    """读取 Prompt：优先返回用户专属（DB），无则回退到磁盘默认文件。"""
    _check_prompt_filename(filename)
    override = db.get_user_prompt(user["id"], filename)
    if override is not None:
        return {"filename": filename, "content": override, "is_custom": True}
    path = _PROMPTS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"{filename} 不存在")
    return {"filename": filename, "content": path.read_text(encoding="utf-8"), "is_custom": False}


@app.post("/prompts/{filename:path}")
def prompt_save(filename: str, payload: Dict[str, str], user: dict = Depends(auth_mod.current_user)):
    """保存用户专属 Prompt 到 DB（不修改磁盘文件）。"""
    _check_prompt_filename(filename)
    content = payload.get("content")
    if content is None:
        raise HTTPException(status_code=422, detail="缺少 content 字段")
    db.save_user_prompt(user["id"], filename, content)
    return {"ok": True, "filename": filename}


@app.delete("/prompts/{filename:path}")
def prompt_delete(filename: str, user: dict = Depends(auth_mod.current_user)):
    """删除用户专属 Prompt：默认文件则清除覆盖（恢复默认），自定义文件则彻底删除。"""
    _check_prompt_filename(filename)
    deleted = db.delete_user_prompt(user["id"], filename)
    if not deleted:
        detail = "该文件没有个人修改记录" if filename in _DEFAULT_PROMPTS else f"{filename} 不存在"
        raise HTTPException(status_code=404, detail=detail)
    return {"ok": True, "filename": filename}


# ─────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────

class AdminLoginRequest(BaseModel):
    email: str
    password: str


class UserCreate(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None


class UserUpdate(BaseModel):
    worker_enabled: Optional[bool] = None
    min_priority: Optional[str] = None
    max_emails_per_run: Optional[int] = None
    poll_interval: Optional[int] = None


class BotCreate(BaseModel):
    name: str
    token: str
    chat_id: str
    is_default: bool = False
    chat_prompt_id: Optional[int] = None


class BotUpdate(BaseModel):
    name: Optional[str] = None
    token: Optional[str] = None
    chat_id: Optional[str] = None
    is_default: Optional[bool] = None
    chat_prompt_id: Optional[int] = None


class PromptCreate(BaseModel):
    name: str
    type: str
    content: str
    is_default: bool = False


class PromptUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    is_default: Optional[bool] = None


# ─────────────────────────────────────────
# Auth
# ─────────────────────────────────────────

@app.post("/auth/login")
def admin_login(payload: AdminLoginRequest):
    """管理员账号密码登录，返回 JWT"""
    user = db.get_user_by_email(payload.email)
    if not user or user["role"] != "admin" or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if not auth_mod.verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = auth_mod.create_access_token(user)
    return {"access_token": token, "token_type": "bearer"}


@app.get("/auth/me")
def auth_me(user: dict = Depends(auth_mod.current_user)):
    """返回当前登录用户信息"""
    safe = {k: v for k, v in user.items() if k != "password_hash"}
    return safe


# ─────────────────────────────────────────
# User 管理
# ─────────────────────────────────────────

@app.get("/users")
def users_list(user: dict = Depends(auth_mod.require_admin)):
    """列出所有用户（仅限管理员）"""
    rows = db.list_users()
    return {"users": [{k: v for k, v in r.items() if k != "password_hash"} for r in rows]}


@app.post("/users", status_code=201)
def user_create(payload: UserCreate, user: dict = Depends(auth_mod.require_admin)):
    """创建普通用户（仅限管理员）"""
    if db.get_user_by_email(payload.email):
        raise HTTPException(status_code=409, detail="该邮箱已被注册")
    new_user = db.create_user(
        email=payload.email,
        display_name=payload.display_name,
        role="user",
        password_hash=auth_mod.hash_password(payload.password),
    )
    return {k: v for k, v in new_user.items() if k != "password_hash"}


@app.get("/users/{user_id}")
def user_get(user_id: int, user: dict = Depends(auth_mod.current_user)):
    """获取用户详情（本人或管理员）"""
    auth_mod.assert_self_or_admin(user, user_id)
    row = db.get_user_by_id(user_id)
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")
    return {k: v for k, v in row.items() if k != "password_hash"}


@app.put("/users/{user_id}")
def user_update(user_id: int, payload: UserUpdate, user: dict = Depends(auth_mod.current_user)):
    """更新用户设置（本人或管理员）"""
    auth_mod.assert_self_or_admin(user, user_id)
    if not db.get_user_by_id(user_id):
        raise HTTPException(status_code=404, detail="用户不存在")
    updates = payload.model_dump(exclude_unset=True)
    if updates:
        db.update_user(user_id, **updates)
    row = db.get_user_by_id(user_id)
    return {k: v for k, v in row.items() if k != "password_hash"}


# ─────────────────────────────────────────
# Bot 管理
# ─────────────────────────────────────────

@app.get("/users/{user_id}/bots")
def bots_list(user_id: int, user: dict = Depends(auth_mod.current_user)):
    """列出某用户的所有 Bot"""
    auth_mod.assert_self_or_admin(user, user_id)
    return {"bots": db.get_bots_by_user(user_id)}


@app.post("/users/{user_id}/bots", status_code=201)
def bot_create(user_id: int, payload: BotCreate, user: dict = Depends(auth_mod.current_user)):
    """为某用户创建 Bot"""
    auth_mod.assert_self_or_admin(user, user_id)
    if not db.get_user_by_id(user_id):
        raise HTTPException(status_code=404, detail="用户不存在")
    bot = db.create_bot(
        user_id=user_id,
        name=payload.name,
        token=payload.token,
        chat_id=payload.chat_id,
        is_default=payload.is_default,
        chat_prompt_id=payload.chat_prompt_id,
    )
    return bot


@app.put("/users/{user_id}/bots/{bot_id}")
def bot_update(user_id: int, bot_id: int, payload: BotUpdate, user: dict = Depends(auth_mod.current_user)):
    """更新 Bot 配置"""
    auth_mod.assert_self_or_admin(user, user_id)
    existing = db.get_bot(bot_id)
    if not existing or existing["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Bot 不存在")
    updates = payload.model_dump(exclude_unset=True)
    if updates:
        db.update_bot(bot_id, **updates)
    return db.get_bot(bot_id)


@app.delete("/users/{user_id}/bots/{bot_id}")
def bot_delete(user_id: int, bot_id: int, user: dict = Depends(auth_mod.current_user)):
    """删除 Bot"""
    auth_mod.assert_self_or_admin(user, user_id)
    existing = db.get_bot(bot_id)
    if not existing or existing["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Bot 不存在")
    db.delete_bot(bot_id)
    return {"ok": True}


@app.post("/users/{user_id}/bots/{bot_id}/set-default")
def bot_set_default(user_id: int, bot_id: int, user: dict = Depends(auth_mod.current_user)):
    """将指定 Bot 设为该用户的默认 Bot"""
    auth_mod.assert_self_or_admin(user, user_id)
    existing = db.get_bot(bot_id)
    if not existing or existing["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Bot 不存在")
    db.set_default_bot(user_id, bot_id)
    return {"ok": True}


# ─────────────────────────────────────────
# Prompt 管理（数据库版）
# ─────────────────────────────────────────

@app.get("/db/prompts")
def db_prompts_list(user: dict = Depends(auth_mod.current_user)):
    """列出当前用户可见的所有 Prompt（系统级 + 本人创建）"""
    rows = db.get_prompts(user_id=user["id"])
    return {"prompts": rows}


@app.post("/db/prompts", status_code=201)
def db_prompt_create(payload: PromptCreate, user: dict = Depends(auth_mod.current_user)):
    """为当前用户创建自定义 Prompt"""
    row = db.create_prompt(
        user_id=user["id"],
        name=payload.name,
        type=payload.type,
        content=payload.content,
        is_default=payload.is_default,
    )
    return row


@app.put("/db/prompts/{prompt_id}")
def db_prompt_update(prompt_id: int, payload: PromptUpdate, user: dict = Depends(auth_mod.current_user)):
    """更新 Prompt（本人创建的 or 管理员）"""
    existing = db.get_prompt(prompt_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Prompt 不存在")
    owner_id = existing.get("user_id")
    if owner_id is None and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="系统 Prompt 仅管理员可修改")
    if owner_id is not None and owner_id != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="无权修改")
    updates = payload.model_dump(exclude_unset=True)
    if updates:
        db.update_prompt(prompt_id, **updates)
    return db.get_prompt(prompt_id)


@app.delete("/db/prompts/{prompt_id}")
def db_prompt_delete(prompt_id: int, user: dict = Depends(auth_mod.current_user)):
    """删除 Prompt（本人创建的 or 管理员）"""
    existing = db.get_prompt(prompt_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Prompt 不存在")
    owner_id = existing.get("user_id")
    if owner_id is None and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="系统 Prompt 仅管理员可删除")
    if owner_id is not None and owner_id != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="无权删除")
    db.delete_prompt(prompt_id)
    return {"ok": True}
