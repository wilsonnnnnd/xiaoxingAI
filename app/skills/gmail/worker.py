"""
Gmail 邮件轮询 Worker — Gmail Skill
流程：Gmail 拉取未读邮件 → AI 分析+摘要+格式化 → 发送 Telegram 通知
已处理的邮件 ID 记录在数据库，避免重复推送
"""
import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from app.core import ws as ws_pub

from app import config, db
from app.skills.gmail.client import fetch_emails, mark_as_read
from app.skills.gmail.pipeline import process_email
from app.core.telegram import send_message

logger = logging.getLogger("worker")

# ── 运行状态 ──────────────────────────────
_task:       asyncio.Task | None = None
_running:    bool = False
_poll_lock:  asyncio.Lock | None = None  # 防止并发轮询
_session_start: Optional[datetime] = None  # 本次会话启动时间
_stats: Dict[str, Any] = {
    "started_at":    None,
    "last_poll":     None,
    "total_fetched": 0,
    "total_sent":    0,
    "total_errors":  0,
    "total_tokens":  0,
    "last_error":    None,
}


def _get_lock() -> asyncio.Lock:
    """延迟初始化 poll lock，确保在事件循环启动后创建"""
    global _poll_lock
    if _poll_lock is None:
        _poll_lock = asyncio.Lock()
    return _poll_lock


def _wlog(msg: str, level: str = "info", tokens: int = 0) -> None:
    """写 logger 和持久化步骤日志数据库"""
    ts = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    db.insert_log(ts, level, msg, db.LogType.EMAIL, tokens)
    if level == "error":
        logger.error(msg)
    elif level == "warn":
        logger.warning(msg)
    else:
        logger.info(msg)


def get_logs(limit: int = 100, log_type: Optional[str] = None) -> List[dict]:
    """返回最近 limit 条步骤日志（持久化），供 /worker/logs 接口使用"""
    lt = db.LogType(log_type) if log_type else None
    return db.get_recent_logs(limit, lt)


# ── 单次轮询 ────────────────────────────────
async def _process_with_retry(email: dict, max_retries: int = 3, email_id: str = "") -> dict:
    """
    带指数退避的邮件处理重试。
    每次失败等待 2^attempt 秒（1s → 2s → 4s）。
    全部失败后向上抛出最后一个异常。
    """
    subj = email.get('subject', '')
    last_err: Exception = RuntimeError("未知错误")
    for attempt in range(max_retries):
        try:
            _wlog(f"🔍 分析邮件：{subj}")
            result = await asyncio.to_thread(
                process_email,
                email["subject"],
                email["body"] or email["snippet"],
                email.get("from", ""),
                email.get("date", ""),
                email_id,
            )
            return result
        except Exception as e:
            last_err = e
            if attempt < max_retries - 1:
                wait = 2 ** attempt
                _wlog(
                    f"⚠️ 第{attempt + 1}次失败，{wait}s 后重试 [{subj}]: {e}",
                    level="warn"
                )
                await asyncio.sleep(wait)
    raise last_err


async def _poll_once() -> None:
    global _stats
    # 加锁防止 worker 定时轮询与 /worker/poll 手动触发并发竞争
    async with _get_lock():
        _stats["last_poll"] = datetime.now().isoformat(timespec="seconds")

        _wlog(f"📥 开始拉取邮件（查询：{config.GMAIL_POLL_QUERY}，最多 {config.GMAIL_POLL_MAX} 封）")
        try:
            emails = await asyncio.to_thread(
                fetch_emails,
                config.GMAIL_POLL_QUERY,
                config.GMAIL_POLL_MAX,
            )
        except Exception as e:
            _wlog(f"❌ 拉取 Gmail 失败: {e}", level="error")
            _stats["last_error"] = str(e)
            return

        new_emails = [e for e in emails if not db.is_sent(e["id"])]
        skipped_dup = len(emails) - len(new_emails)
        _stats["total_fetched"] += len(new_emails)
        _wlog(
            f"📬 拉取完成：共 {len(emails)} 封，"
            f"新邮件 {len(new_emails)} 封，"
            f"已处理(跳过) {skipped_dup} 封"
        )

        if not new_emails:
            _wlog("✅ 无新邮件，本轮结束")

        for email in new_emails:
            subj = email.get('subject', '(无主题)')
            try:
                _wlog(f"📧 处理邮件：{subj}")
                result = await _process_with_retry(email, email_id=email["id"])

                # 累积本会话 token 消耗
                _stats["total_tokens"] += result.get("tokens", 0)

                # 优先级过滤
                priority = result.get("analysis", {}).get("priority", "low")
                if config.NOTIFY_PRIORITIES and priority not in config.NOTIFY_PRIORITIES:
                    _wlog(f"⏭️ 跳过低优先级 [{priority}]：{subj}", level="warn")
                    db.save_email_record(
                        email_id=email["id"],
                        subject=subj,
                        sender=email.get("from", ""),
                        date=email.get("date", ""),
                        body=email.get("body") or email.get("snippet", ""),
                        analysis=result.get("analysis", {}),
                        summary=result.get("summary", {}),
                        telegram_msg=result.get("telegram_message", ""),
                        tokens=result.get("tokens", 0),
                        priority=priority,
                        sent_telegram=False,
                    )
                    db.add_sent_id(email["id"])
                    continue

                # 发送 Telegram（同步阻塞，放到线程池）
                _wlog(f"✈️ 发送 Telegram：{subj}")
                await asyncio.to_thread(send_message, result["telegram_message"], None, "HTML")
                _stats["total_sent"] += 1
                _wlog(f"✅ 已发送：{subj}", tokens=result.get("tokens", 0))

                db.save_email_record(
                    email_id=email["id"],
                    subject=subj,
                    sender=email.get("from", ""),
                    date=email.get("date", ""),
                    body=email.get("body") or email.get("snippet", ""),
                    analysis=result.get("analysis", {}),
                    summary=result.get("summary", {}),
                    telegram_msg=result.get("telegram_message", ""),
                    tokens=result.get("tokens", 0),
                    priority=priority,
                    sent_telegram=True,
                )
                db.add_sent_id(email["id"])

                # 标记已读（独立 try，失败只警告，不影响主流程）
                if config.GMAIL_MARK_READ:
                    try:
                        await asyncio.to_thread(mark_as_read, email["id"])
                        _wlog(f"📌 已标记已读：{subj}")
                    except Exception as mark_err:
                        _wlog(f"⚠️ 标记已读失败 [{subj}]: {mark_err}", level="warn")

            except Exception as e:
                _stats["total_errors"] += 1
                _stats["last_error"] = str(e)
                _wlog(f"❌ 处理失败 [{subj}]: {e}", level="error")
                # 即使失败也记录，避免死循环重试同一封邮件
                db.add_sent_id(email["id"])

        db.cleanup_old_logs()
        # notify websocket subscribers about updated status
        try:
            ws_pub.publish_worker_status(get_status())
        except Exception:
            pass


# ── 轮询循环 ────────────────────────────────
async def _loop() -> None:
    global _running
    _wlog(f"🚀 Worker 已启动，轮询间隔 {config.GMAIL_POLL_INTERVAL}s")
    while _running:
        try:
            await _poll_once()
        except Exception as e:
            _stats["last_error"] = str(e)
            _wlog(f"❌ 轮询异常: {e}", level="error")
            logger.error(f"[worker] 轮询异常: {e}", exc_info=True)
        for _ in range(config.GMAIL_POLL_INTERVAL):
            if not _running:
                break
            await asyncio.sleep(1)
    _wlog("⏹️ Worker 已停止")


# ── 公开控制接口 ────────────────────────────
async def start() -> bool:
    """启动 worker，已在运行则返回 False"""
    global _task, _running, _stats, _session_start
    if _running:
        return False

    missing = config.validate_gmail()
    if missing:
        raise RuntimeError(f"缺少 Gmail 所需配置项：{', '.join(missing)}，请检查 .env 文件")

    _running = True
    _session_start = datetime.now()
    _stats.update({
        "started_at":    _session_start.isoformat(timespec="seconds"),
        "last_poll":     None,
        "total_fetched": 0,
        "total_sent":    0,
        "total_errors":  0,
        "total_tokens":  0,
        "last_error":    None,
    })
    _task = asyncio.create_task(_loop())
    try:
        ws_pub.publish_worker_status(get_status())
    except Exception:
        pass
    return True


def stop() -> bool:
    """停止 worker，未在运行则返回 False"""
    global _running, _task, _session_start
    if not _running:
        return False
    _running = False
    runtime_secs = 0
    started_at = _stats.get("started_at", "")
    if _session_start is not None:
        runtime_secs = int((datetime.now() - _session_start).total_seconds())
        _session_start = None
    db.save_worker_stats(
        started_at=started_at,
        total_sent=_stats["total_sent"],
        total_fetched=_stats["total_fetched"],
        total_errors=_stats["total_errors"],
        total_tokens=_stats.get("total_tokens", 0),
        runtime_secs=runtime_secs,
        last_poll=_stats.get("last_poll"),
    )
    if _task and not _task.done():
        _task.cancel()
    try:
        ws_pub.publish_worker_status(get_status())
    except Exception:
        pass
    return True


async def shutdown() -> None:
    """优雅停止 worker，等待当前轮询完成（最多 10 秒）"""
    stop()
    global _task
    if _task and not _task.done():
        try:
            await asyncio.wait_for(asyncio.shield(_task), timeout=10.0)
        except (asyncio.CancelledError, asyncio.TimeoutError):
            pass


def get_status() -> Dict[str, Any]:
    global _running, _task, _session_start
    # 任务意外退出时自动更新状态，避免 UI 永远显示「运行中」
    if _running and _task is not None and _task.done():
        _running = False
        if not _task.cancelled():
            exc = _task.exception()
            if exc:
                _stats["last_error"] = f"[task crashed] {exc}"
    # 历史 DB 各会话累积统计
    db_s = db.get_worker_stats()
    # 当前会话已经运行的时长
    session_secs = 0
    if _running and _session_start is not None:
        session_secs = int((datetime.now() - _session_start).total_seconds())
    return {
        "running":  _running,
        "interval": config.GMAIL_POLL_INTERVAL,
        "query":    config.GMAIL_POLL_QUERY,
        "priorities": config.NOTIFY_PRIORITIES or ["all"],
        # 当前会话信息
        "started_at":  _stats["started_at"],
        "last_poll":   _stats.get("last_poll") or db_s.get("last_poll"),
        "last_error":  _stats["last_error"],
        # 历史累积 + 当前会话增量
        "total_sent":          db_s["total_sent"]    + _stats["total_sent"],
        "total_fetched":       db_s["total_fetched"] + _stats["total_fetched"],
        "total_errors":        db_s["total_errors"]  + _stats["total_errors"],
        "total_tokens":        db_s["total_tokens"]  + _stats.get("total_tokens", 0),
        "total_runtime_hours": round((db_s["total_runtime_secs"] + session_secs) / 3600, 1),
    }


async def poll_now() -> Dict[str, Any]:
    """立即触发一次轮询（不受调度间隔限制）"""
    missing = config.validate_gmail()
    if missing:
        raise RuntimeError(f"缺少 Gmail 所需配置项：{', '.join(missing)}")
    before_sent = _stats["total_sent"]
    before_err  = _stats["total_errors"]
    await _poll_once()
    try:
        ws_pub.publish_status(get_status())
    except Exception:
        pass
    return {
        "sent_this_run":   _stats["total_sent"]   - before_sent,
        "errors_this_run": _stats["total_errors"]  - before_err,
        "last_poll":       _stats["last_poll"],
    }
