"""
Gmail 邮件轮询 Worker — 多账号版本
每个 worker_enabled=True 的 user 独立运行一个异步轮询 Task：
  Gmail 拉取未读邮件 → AI 分析+摘要+格式化 → 发送到该用户的默认 Telegram Bot
已处理的邮件 ID 记录在数据库（user_id 隔离），避免重复推送。
"""
import asyncio
import dataclasses
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from app.core import ws as ws_pub

from app.core import config
from app import db
from app.skills.gmail.client import fetch_emails, mark_as_read
from app.skills.gmail.pipeline import process_email
from app.core.telegram import send_message

logger = logging.getLogger("worker")


# ── 每用户运行状态 ─────────────────────────────────────────────────

@dataclasses.dataclass
class _UserWorkerState:
    user_id: int
    task: Optional[asyncio.Task] = None
    running: bool = False
    session_start: Optional[datetime] = None
    lock: Optional[asyncio.Lock] = None
    stats: Dict[str, Any] = dataclasses.field(default_factory=lambda: {
        "started_at":    None,
        "last_poll":     None,
        "total_fetched": 0,
        "total_sent":    0,
        "total_errors":  0,
        "total_tokens":  0,
        "last_error":    None,
    })

    def get_lock(self) -> asyncio.Lock:
        if self.lock is None:
            self.lock = asyncio.Lock()
        return self.lock


# user_id → state
_workers: Dict[int, _UserWorkerState] = {}


def _wlog(msg: str, level: str = "info", tokens: int = 0,
           user_id: Optional[int] = None) -> None:
    """写 logger 和持久化步骤日志数据库"""
    ts = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    db.insert_log(ts, level, msg, db.LogType.EMAIL, tokens, user_id=user_id)
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


# ── 单用户单次轮询 ──────────────────────────────────────────────────

async def _process_with_retry(email: dict, max_retries: int = 3,
                               email_id: str = "",
                               user_id: Optional[int] = None) -> dict:
    """
    带指数退避的邮件处理重试。
    每次失败等待 2^attempt 秒（1s → 2s → 4s）。
    全部失败后向上抛出最后一个异常。
    """
    subj = email.get('subject', '')
    last_err: Exception = RuntimeError("未知错误")
    for attempt in range(max_retries):
        try:
            _wlog(f"🔍 分析邮件：{subj}", user_id=user_id)
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
                    level="warn", user_id=user_id,
                )
                await asyncio.sleep(wait)
    raise last_err


async def _poll_once(state: _UserWorkerState) -> None:
    """对单个用户执行一次轮询"""
    user_id = state.user_id

    # 读取用户配置（DB 中的 per-user 设置）
    user_row = db.get_user_by_id(user_id)
    if not user_row:
        return

    poll_query    = config.GMAIL_POLL_QUERY
    max_emails    = user_row.get("max_emails_per_run") or config.GMAIL_POLL_MAX
    min_priority  = user_row.get("min_priority") or None  # e.g. "high"
    mark_read     = config.GMAIL_MARK_READ

    # 获取该用户的 Gmail 通知 Bot（mode='all' 或 'notify'）
    notify_bots = db.get_notify_bots(user_id)

    async with state.get_lock():
        state.stats["last_poll"] = datetime.now().isoformat(timespec="seconds")

        _wlog(
            f"📥 开始拉取邮件（查询：{poll_query}，最多 {max_emails} 封）",
            user_id=user_id,
        )
        try:
            emails = await asyncio.to_thread(
                fetch_emails, poll_query, max_emails, user_id
            )
        except Exception as e:
            _wlog(f"❌ 拉取 Gmail 失败: {e}",
                  level="error", user_id=user_id)
            state.stats["last_error"] = str(e)
            return

        new_emails = [e for e in emails if not db.is_email_processed(e["id"], user_id)]
        skipped_dup = len(emails) - len(new_emails)
        state.stats["total_fetched"] += len(new_emails)
        _wlog(
            f"📬 拉取完成：共 {len(emails)} 封，"
            f"新邮件 {len(new_emails)} 封，已处理(跳过) {skipped_dup} 封",
            user_id=user_id,
        )

        if not new_emails:
            _wlog(f"✅ 无新邮件，本轮结束", user_id=user_id)

        for email in new_emails:
            subj = email.get('subject', '(无主题)')
            try:
                _wlog(f"📧 处理邮件：{subj}", user_id=user_id)
                result = await _process_with_retry(
                    email, email_id=email["id"], user_id=user_id
                )

                state.stats["total_tokens"] += result.get("tokens", 0)

                # 优先级过滤
                priority = result.get("analysis", {}).get("priority", "low")
                notify_priorities = config.NOTIFY_PRIORITIES
                if min_priority:
                    _LEVEL = {"low": 0, "medium": 1, "high": 2, "urgent": 3}
                    min_lvl = _LEVEL.get(min_priority, 0)
                    if _LEVEL.get(priority, 0) < min_lvl:
                        notify_priorities = []  # 强制跳过

                if notify_priorities and priority not in notify_priorities:
                    _wlog(f"⏭️ 跳过低优先级 [{priority}]：{subj}",
                          level="warn", user_id=user_id)
                    db.save_email_record(
                        email_id=email["id"], subject=subj,
                        sender=email.get("from", ""), date=email.get("date", ""),
                        body=email.get("body") or email.get("snippet", ""),
                        analysis=result.get("analysis", {}),
                        summary=result.get("summary", {}),
                        telegram_msg=result.get("telegram_message", ""),
                        tokens=result.get("tokens", 0), priority=priority,
                        sent_telegram=False, user_id=user_id,
                    )
                    continue

                # 发送 Telegram（发送给所有通知 Bot）
                if not notify_bots:
                    _wlog(f"⚠️ 无通知 Bot（mode='all'/'notify'），跳过 Telegram 发送：{subj}",
                          level="warn", user_id=user_id)
                else:
                    _wlog(f"✈️ 发送 Telegram：{subj}", user_id=user_id)
                    for n_bot in notify_bots:
                        await asyncio.to_thread(
                            send_message,
                            result["telegram_message"],
                            n_bot["chat_id"],
                            "HTML",
                            n_bot["token"],
                        )
                    state.stats["total_sent"] += 1
                    _wlog(f"✅ 已发送：{subj}",
                          tokens=result.get("tokens", 0), user_id=user_id)

                db.save_email_record(
                    email_id=email["id"], subject=subj,
                    sender=email.get("from", ""), date=email.get("date", ""),
                    body=email.get("body") or email.get("snippet", ""),
                    analysis=result.get("analysis", {}),
                    summary=result.get("summary", {}),
                    telegram_msg=result.get("telegram_message", ""),
                    tokens=result.get("tokens", 0), priority=priority,
                    sent_telegram=True, user_id=user_id,
                )

                if mark_read:
                    try:
                        await asyncio.to_thread(mark_as_read, email["id"], user_id)
                        _wlog(f"📌 已标记已读：{subj}", user_id=user_id)
                    except Exception as mark_err:
                        _wlog(f"⚠️ 标记已读失败 [{subj}]: {mark_err}",
                              level="warn", user_id=user_id)

            except Exception as e:
                state.stats["total_errors"] += 1
                state.stats["last_error"] = str(e)
                _wlog(f"❌ 处理失败 [{subj}]: {e}",
                      level="error", user_id=user_id)

        db.cleanup_old_logs()
        try:
            ws_pub.publish_worker_status(get_status())
        except Exception:
            pass


# ── 单用户轮询循环 ────────────────────────────────────────────────

async def _user_loop(state: _UserWorkerState) -> None:
    user_id = state.user_id
    user_row = db.get_user_by_id(user_id)
    poll_interval = (user_row.get("poll_interval") if user_row else None) or config.GMAIL_POLL_INTERVAL

    _wlog(f"🚀 Worker 已启动，轮询间隔 {poll_interval}s", user_id=user_id)
    while state.running:
        try:
            await _poll_once(state)
        except Exception as e:
            state.stats["last_error"] = str(e)
            _wlog(f"❌ 轮询异常: {e}", level="error", user_id=user_id)
            logger.error(f"[worker] user#{user_id} 轮询异常: {e}", exc_info=True)
        # 重新读取 poll_interval（可能被热更新）
        user_row = db.get_user_by_id(user_id)
        poll_interval = (user_row.get("poll_interval") if user_row else None) or config.GMAIL_POLL_INTERVAL
        for _ in range(poll_interval):
            if not state.running:
                break
            await asyncio.sleep(1)
    _wlog(f"⏹️ Worker 已停止", user_id=user_id)


# ── 公开控制接口 ────────────────────────────────────────────────────

async def start() -> bool:
    """启动所有 worker_enabled 用户的轮询 Worker。"""
    users = db.list_worker_enabled_users()
    if not users:
        raise RuntimeError("当前无 worker_enabled=True 的用户，请先在用户设置中开启")

    started_any = False
    for user in users:
        user_id = user["id"]
        if user_id in _workers and _workers[user_id].running:
            continue  # 已运行，跳过

        state = _workers.setdefault(user_id, _UserWorkerState(user_id=user_id))
        now = datetime.now()
        state.running = True
        state.session_start = now
        state.stats.update({
            "started_at":    now.isoformat(timespec="seconds"),
            "last_poll":     None,
            "total_fetched": 0,
            "total_sent":    0,
            "total_errors":  0,
            "total_tokens":  0,
            "last_error":    None,
        })
        state.task = asyncio.create_task(_user_loop(state))
        started_any = True

    try:
        ws_pub.publish_worker_status(get_status())
    except Exception:
        pass
    return started_any


def stop() -> bool:
    """停止所有正在运行的 Worker。"""
    stopped_any = False
    for user_id, state in list(_workers.items()):
        if not state.running:
            continue
        state.running = False
        runtime_secs = 0
        if state.session_start is not None:
            runtime_secs = int((datetime.now() - state.session_start).total_seconds())
            state.session_start = None
        db.save_worker_stats(
            started_at=state.stats.get("started_at", ""),
            total_sent=state.stats["total_sent"],
            total_fetched=state.stats["total_fetched"],
            total_errors=state.stats["total_errors"],
            total_tokens=state.stats.get("total_tokens", 0),
            runtime_secs=runtime_secs,
            last_poll=state.stats.get("last_poll"),
            user_id=user_id,
        )
        if state.task and not state.task.done():
            state.task.cancel()
        stopped_any = True
    try:
        ws_pub.publish_worker_status(get_status())
    except Exception:
        pass
    return stopped_any


async def shutdown() -> None:
    """优雅停止所有 Worker，等待当前轮询完成（最多 10 秒）。"""
    tasks = [s.task for s in _workers.values() if s.task and not s.task.done()]
    stop()
    if tasks:
        try:
            await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=10.0)
        except (asyncio.CancelledError, asyncio.TimeoutError):
            pass


def get_status() -> Dict[str, Any]:
    """返回所有 Worker 的聚合状态。"""
    any_running = False
    total_sent = total_fetched = total_errors = total_tokens = 0
    last_poll = None
    last_error = None
    started_at = None
    total_runtime_secs = 0

    for user_id, state in _workers.items():
        # 任务意外退出时同步状态
        if state.running and state.task is not None and state.task.done():
            state.running = False
            if not state.task.cancelled():
                exc = state.task.exception()
                if exc:
                    state.stats["last_error"] = f"[task crashed] {exc}"

        if state.running:
            any_running = True

        db_s = db.get_worker_stats(user_id=user_id)
        session_secs = 0
        if state.running and state.session_start:
            session_secs = int((datetime.now() - state.session_start).total_seconds())
        total_runtime_secs += db_s.get("total_runtime_secs", 0) + session_secs

        total_sent    += db_s.get("total_sent", 0)    + state.stats["total_sent"]
        total_fetched += db_s.get("total_fetched", 0) + state.stats["total_fetched"]
        total_errors  += db_s.get("total_errors", 0)  + state.stats["total_errors"]
        total_tokens  += db_s.get("total_tokens", 0)  + state.stats.get("total_tokens", 0)

        poll = state.stats.get("last_poll") or db_s.get("last_poll")
        if poll and (last_poll is None or poll > last_poll):
            last_poll = poll
        if state.stats.get("last_error"):
            last_error = state.stats["last_error"]
        if state.stats.get("started_at"):
            started_at = state.stats["started_at"]

    return {
        "running":   any_running,
        "interval":  config.GMAIL_POLL_INTERVAL,
        "query":     config.GMAIL_POLL_QUERY,
        "priorities": config.NOTIFY_PRIORITIES or ["all"],
        "started_at": started_at,
        "last_poll":  last_poll,
        "last_error": last_error,
        "total_sent":          total_sent,
        "total_fetched":       total_fetched,
        "total_errors":        total_errors,
        "total_tokens":        total_tokens,
        "total_runtime_hours": round(total_runtime_secs / 3600, 1),
    }


async def poll_now() -> Dict[str, Any]:
    """立即触发一次全用户轮询（不受调度间隔限制）。"""
    users = db.list_worker_enabled_users()
    if not users:
        raise RuntimeError("当前无 worker_enabled=True 的用户")

    before_sent = sum(s.stats["total_sent"] for s in _workers.values())
    before_err  = sum(s.stats["total_errors"] for s in _workers.values())

    tasks = []
    for user in users:
        user_id = user["id"]
        state = _workers.setdefault(user_id, _UserWorkerState(user_id=user_id))
        tasks.append(_poll_once(state))
    await asyncio.gather(*tasks, return_exceptions=True)

    after_sent = sum(s.stats["total_sent"] for s in _workers.values())
    after_err  = sum(s.stats["total_errors"] for s in _workers.values())
    try:
        ws_pub.publish_worker_status(get_status())
    except Exception:
        pass
    return {
        "sent_this_run":   after_sent - before_sent,
        "errors_this_run": after_err  - before_err,
        "last_poll":       datetime.now().isoformat(timespec="seconds"),
    }
