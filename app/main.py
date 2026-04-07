import importlib
import os
from contextlib import asynccontextmanager
from typing import Dict, Optional

from dotenv import set_key
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pathlib import Path

from app import config as app_config
from app import db
from app.skills.gmail.schemas import EmailRequest, GmailFetchRequest, GmailProcessRequest
from app.skills.gmail.pipeline import analyze_email, summarize_email, write_telegram_message, process_email
from app.core.telegram import send_message, test_connection, get_latest_chat_id
from app.skills.gmail import worker
from app.core import bot_worker as tg_bot_worker
from app.skills.gmail.auth import get_oauth_url, exchange_code_for_token
from app.skills.gmail.client import fetch_emails, fetch_unread_emails, mark_as_read


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 初始化数据库（建表 + 自动迁移旧 JSON 文件）
    db.init_db()
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

@app.get("/gmail/auth")
def gmail_auth(request: Request):
    """跳转到 Google OAuth 授权页面"""
    try:
        redirect_uri = str(request.base_url).rstrip("/") + "/gmail/callback"
        url = get_oauth_url(redirect_uri)
        return RedirectResponse(url=url)
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/gmail/callback")
def gmail_callback(request: Request, code: str):
    """Google OAuth 回调，保存 token"""
    try:
        redirect_uri = str(request.base_url).rstrip("/") + "/gmail/callback"
        exchange_code_for_token(code, redirect_uri)
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
def worker_logs(limit: int = 100, log_type: Optional[str] = None):
    """返回 Worker 最近步骤日志（最多 200 条），可按 log_type 过滤（email/chat）"""
    return {"logs": worker.get_logs(min(limit, 200), log_type)}


@app.delete("/worker/logs")
def worker_logs_clear():
    """清空 Worker 步骤日志（数据库）"""
    deleted = db.clear_logs()
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


@app.post("/telegram/bot/clear_history")
def tg_bot_clear_history():
    """清空所有对话历史记录"""
    tg_bot_worker.clear_history()
    return {"ok": True}


@app.get("/telegram/bot/profile")
def tg_bot_profile_get():
    """获取当前 TELEGRAM_CHAT_ID 的用户画像"""
    chat_id = str(app_config.TELEGRAM_CHAT_ID).strip()
    if not chat_id:
        raise HTTPException(status_code=400, detail="TELEGRAM_CHAT_ID 未配置")
    profile     = db.get_profile(chat_id)
    updated_at  = db.get_profile_updated_at(chat_id)
    return {"chat_id": chat_id, "profile": profile, "updated_at": updated_at}


@app.delete("/telegram/bot/profile")
def tg_bot_profile_delete():
    """删除当前 TELEGRAM_CHAT_ID 的用户画像"""
    chat_id = str(app_config.TELEGRAM_CHAT_ID).strip()
    if not chat_id:
        raise HTTPException(status_code=400, detail="TELEGRAM_CHAT_ID 未配置")
    db.delete_profile(chat_id)
    return {"ok": True}


@app.post("/telegram/bot/generate_profile")
def tg_bot_generate_profile():
    """手动触发用户画像生成（基于今日聊天记录），生成后清空今日记录，供调试使用"""
    chat_id = str(app_config.TELEGRAM_CHAT_ID).strip()
    if not chat_id:
        raise HTTPException(status_code=400, detail="TELEGRAM_CHAT_ID 未配置")
    try:
        profile, tokens = tg_bot_worker.generate_profile_now(chat_id)
        return {"ok": True, "chat_id": chat_id, "profile": profile, "tokens": tokens}
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
def config_get():
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
def config_update(payload: Dict[str, str]):
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
def prompts_list():
    """列出 prompts 目录下所有 .txt 文件（含子目录）"""
    files = sorted(
        str(p.relative_to(_PROMPTS_DIR)).replace("\\", "/")
        for p in _PROMPTS_DIR.rglob("*.txt")
        if p.is_file()
    )
    return {"files": files, "defaults": sorted(_DEFAULT_PROMPTS)}


@app.get("/prompts/{filename}")
def prompt_get(filename: str):
    """读取指定 prompt 文件内容"""
    _check_prompt_filename(filename)
    path = _PROMPTS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"{filename} 不存在")
    return {"filename": filename, "content": path.read_text(encoding="utf-8")}


@app.post("/prompts/{filename}")
def prompt_save(filename: str, payload: Dict[str, str]):
    """新建或覆盖保存 prompt 文件内容"""
    _check_prompt_filename(filename)
    content = payload.get("content")
    if content is None:
        raise HTTPException(status_code=422, detail="缺少 content 字段")
    path = _PROMPTS_DIR / filename
    path.write_text(content, encoding="utf-8")
    return {"ok": True, "filename": filename}


@app.delete("/prompts/{filename}")
def prompt_delete(filename: str):
    """删除自定义 prompt 文件（内置文件不可删除）"""
    _check_prompt_filename(filename)
    if filename in _DEFAULT_PROMPTS:
        raise HTTPException(status_code=403, detail="内置文件不可删除")
    path = _PROMPTS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"{filename} 不存在")
    path.unlink()
    return {"ok": True, "filename": filename}