"""
Telegram Bot 聊天 Worker — 多 Bot 版本
每个 DB 中注册的 Bot 独立运行一个 getUpdates 长轮询 Task：
- 用各自 Bot Token 拉取 Telegram 更新
- 按各自 chat_id 做安全过滤
- 用各自绑定的 chat_prompt_id 做 AI 回复（未设则用系统默认）
- 共用一个 Redis 任务队列消费者和每日画像调度器
"""
import asyncio
import dataclasses
import logging
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import requests

from app import config, db
from app.core.chat import build_user_profile, chat_reply, CHAT_HISTORY_MAX
from app.core.tools import route_and_execute
from app.core.telegram import TELEGRAM_API
from app.core import ws as ws_pub
from app.core import redis_client as rc

logger = logging.getLogger("tg_bot")


# ── 每 Bot 状态 ──────────────────────────────────────────────────

@dataclasses.dataclass
class _BotState:
    bot_id: int
    token: str
    chat_id: str           # 安全过滤白名单（Telegram chat_id 字符串）
    user_id: Optional[int] = None    # 所属用户 ID（用于 Gmail OAuth 等）
    chat_prompt_id: Optional[int] = None
    bot_mode: str = "all"            # 'all'（全能）/ 'notify'（仅通知）/ 'chat'（仅聊天）
    poll_task: Optional[asyncio.Task] = None
    running: bool = False


# bot_id → state
_bots: Dict[int, _BotState] = {}

# 共享任务
_consumer_task:  Optional[asyncio.Task] = None
_schedule_task:  Optional[asyncio.Task] = None
_shared_running: bool = False

# bot_id → 对话窗口历史（内存 + Redis 持久化）
_histories:       Dict[int, List[Dict[str, str]]] = {}
# bot_id → 今日完整对话历史（内存 + Redis 持久化，画像更新后清空）
_histories_today: Dict[int, List[Dict[str, str]]] = {}
# bot_id → 历史读写锁（防止多线程并发竞态）
_history_locks:   Dict[int, threading.Lock] = {}


def _wlog(msg: str, level: str = "info", tokens: int = 0) -> None:
    ts = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    db.insert_log(ts, level, msg, db.LogType.CHAT, tokens)
    if level == "error":
        logger.error(msg)
    elif level == "warn":
        logger.warning(msg)
    else:
        logger.info(msg)


def _sender_label(from_user: dict | None) -> str:
    """Format a Telegram sender as '@username(id)' or 'FirstName(id)'."""
    if not from_user:
        return "用户"
    tg_id = from_user.get("id", "?")
    name = from_user.get("username") or from_user.get("first_name") or "用户"
    prefix = "@" if from_user.get("username") else ""
    return f"{prefix}{name}({tg_id})"


# ── Telegram 通信 ────────────────────────────────────────────────

def _get_updates(token: str, offset: int, timeout: int = 30) -> list:
    url = TELEGRAM_API.format(token=token, method="getUpdates")
    try:
        resp = requests.get(
            url,
            params={"offset": offset, "timeout": timeout, "allowed_updates": '["message"]'},
            timeout=timeout + 5,
        )
        data = resp.json()
        if data.get("ok"):
            return data.get("result", [])
    except Exception as e:
        logger.warning(f"[tg_bot] getUpdates 失败 (token=...{token[-6:]}): {e}")
    return []


def _send_reply(token: str, chat_id: str, text: str) -> None:
    url = TELEGRAM_API.format(token=token, method="sendMessage")
    try:
        requests.post(url, json={"chat_id": chat_id, "text": text}, timeout=15)
    except Exception as e:
        logger.warning(f"[tg_bot] 发送回复失败: {e}")


# ── 会话历史（内存 + Redis） ─────────────────────────────────────

def _get_lock(bot_id: int) -> threading.Lock:
    if bot_id not in _history_locks:
        _history_locks[bot_id] = threading.Lock()
    return _history_locks[bot_id]


def _get_history(bot_id: int) -> list:
    if bot_id not in _histories:
        _histories[bot_id] = rc.load_history(bot_id)
    return _histories[bot_id]


def _save_history(bot_id: int, history: list) -> None:
    _histories[bot_id] = history
    rc.save_history(bot_id, history)


def _get_today(bot_id: int) -> list:
    if bot_id not in _histories_today:
        _histories_today[bot_id] = rc.load_history_today(bot_id)
    return _histories_today[bot_id]


def _append_today(bot_id: int, user_msg: str, ai_msg: str) -> None:
    today = _get_today(bot_id)
    today.append({"role": "user",      "content": user_msg})
    today.append({"role": "assistant", "content": ai_msg})
    _histories_today[bot_id] = today
    rc.save_history_today(bot_id, today)


# ── 消息处理 ─────────────────────────────────────────────────────

def _handle_message(token: str, bot_id: int, chat_id: str, text: str,
                    chat_prompt_id: Optional[int] = None,
                    from_user: Optional[dict] = None,
                    user_id: Optional[int] = None) -> None:
    """处理单条消息，调用 AI 并回复"""
    text = text.strip()

    if text in ("/start", "/hi", "/hello"):
        _send_reply(token, chat_id, "👋 你好！我是小星（Xiaoxing），有什么可以帮你的吗？")
        return
    if text == "/clear":
        _histories.pop(bot_id, None)
        _histories_today.pop(bot_id, None)
        rc.delete_history(bot_id)
        _send_reply(token, chat_id, "🗑️ 对话历史已清空！重新开始聊天吧~")
        return
    if text == "/help":
        _send_reply(
            token, chat_id,
            "💡 可用命令：\n/clear — 清空对话历史\n/start — 打招呼\n\n直接发消息即可与 AI 聊天 😊"
        )
        return

    history = _get_history(bot_id)
    profile = db.get_profile(bot_id) if bot_id else ""

    # 工具路由和 AI 回复（耗时操作，放锁外）
    tool_context, tool_tokens = route_and_execute(text, user_id=user_id)
    db_context = tool_context

    # 如果 bot 绑定了特定 prompt，加载人格提示词
    persona_prompt = ""
    if chat_prompt_id:
        try:
            prompt_row = db.get_prompt(chat_prompt_id)
            if prompt_row:
                persona_prompt = prompt_row["content"]
        except Exception:
            pass

    _wlog(f"💬 [bot#{bot_id}] {_sender_label(from_user)}: {text[:80]}")
    try:
        reply, tokens = chat_reply(text, history, profile=profile, db_context=db_context, persona_prompt=persona_prompt)
    except Exception as e:
        logger.error(f"[tg_bot] AI 回复失败 [bot#{bot_id}]: {e}")
        _wlog(f"❌ AI 回复失败 [bot#{bot_id}]: {e}", level="error")
        _send_reply(token, chat_id, "⚠️ AI 暂时无法回复，请稍后再试。")
        return

    # 加锁写历史，防止并发竞态
    with _get_lock(bot_id):
        history = _get_history(bot_id)   # 重新读取，防止锁等待期间被其他线程修改
        history.append({"role": "user",      "content": text})
        history.append({"role": "assistant", "content": reply})
        if len(history) > CHAT_HISTORY_MAX * 2:
            history = history[-(CHAT_HISTORY_MAX * 2):]
        _save_history(bot_id, history)
        _append_today(bot_id, text, reply)

    _wlog(f"🤖 [bot#{bot_id}] Xiaoxing → {_sender_label(from_user)}: {reply[:80]}", tokens=tokens)
    _send_reply(token, chat_id, reply)


# ── 每 Bot 轮询 Loop ─────────────────────────────────────────────

async def _bot_loop(state: _BotState) -> None:
    offset = 0
    logger.info(f"[tg_bot] bot#{state.bot_id} 已启动（chat_id={state.chat_id}）")
    _wlog(f"▶️ bot#{state.bot_id} 已启动")

    while state.running:
        updates = await asyncio.to_thread(_get_updates, state.token, offset)
        for upd in updates:
            offset = upd["update_id"] + 1
            msg = upd.get("message") or upd.get("edited_message")
            if not msg:
                continue
            chat_id   = str(msg.get("chat", {}).get("id", ""))
            from_user = msg.get("from", {})
            text      = msg.get("text", "").strip()
            update_id = upd["update_id"]
            if not text:
                continue

            # 安全过滤：只响应已注册的 chat_id
            if state.chat_id and chat_id != state.chat_id:
                logger.debug(f"[tg_bot] bot#{state.bot_id} 忽略未授权 chat_id={chat_id}")
                continue

            # 防重复（Redis SET NX）
            if not rc.mark_update(update_id):
                logger.debug(f"[tg_bot] bot#{state.bot_id} 跳过重复 update_id={update_id}")
                continue

            logger.info(f"[tg_bot] bot#{state.bot_id} 收到消息 [{chat_id}]: {text[:60]}")

            # 入队或直接处理
            if not rc.enqueue(update_id, state.bot_id, chat_id, text, from_user):
                # 通知专用 Bot：不响应聊天消息
                if state.bot_mode == "notify":
                    logger.debug(f"[tg_bot] bot#{state.bot_id} [notify-only] 忽略聊天: {text[:40]}")
                    continue
                await asyncio.to_thread(
                    _handle_message,
                    state.token, state.bot_id, chat_id, text, state.chat_prompt_id, from_user,
                    state.user_id,
                )

        await asyncio.sleep(0)

    logger.info(f"[tg_bot] bot#{state.bot_id} 已停止")
    _wlog(f"⏹️ bot#{state.bot_id} 已停止")


# ── 共享消费者 ────────────────────────────────────────────────────

async def _consumer_loop() -> None:
    """从 Redis queue:chat BRPOP 取消息，按 bot_id 分发到对应 Bot 处理。"""
    logger.info("[tg_bot] 消费者任务已启动")
    while _shared_running:
        try:
            item = await rc.dequeue(timeout=2)
            if item is None:
                continue
            bot_id    = int(item.get("bot_id", 0))
            chat_id   = item.get("chat_id", "")
            text      = item.get("text", "")
            from_user = item.get("from_user", {})
            if not chat_id or not text:
                continue
            state = _bots.get(bot_id)
            token = state.token if state else config.TELEGRAM_BOT_TOKEN
            prompt_id = state.chat_prompt_id if state else None
            uid = state.user_id if state else None
            # 通知专用 Bot：不处理聊天消息
            if state and state.bot_mode == "notify":
                continue
            await asyncio.to_thread(_handle_message, token, bot_id, chat_id, text, prompt_id, from_user, uid)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning(f"[tg_bot] 消费者异常: {e}")
            await asyncio.sleep(1)
    logger.info("[tg_bot] 消费者任务已停止")


# ── 共享画像调度 ──────────────────────────────────────────────────

async def _profile_update_job() -> None:
    all_bot_ids = set(_histories_today.keys()) | set(rc.get_today_bot_ids())
    if not all_bot_ids:
        logger.info("[tg_bot] 画像更新：今日无聊天记录，跳过。")
        return
    for bot_id in all_bot_ids:
        today_history = _get_today(bot_id)
        if not today_history:
            continue
        try:
            existing = db.get_profile(bot_id)
            logger.info(f"[tg_bot] 为 bot#{bot_id} 生成画像（{len(today_history)//2} 轮对话）…")
            new_profile, profile_tokens = await asyncio.to_thread(
                build_user_profile, today_history, existing
            )
            if new_profile:
                try:
                    db.save_profile(bot_id, new_profile)
                    _wlog(f"👤 用户画像已更新 [bot#{bot_id}]", tokens=profile_tokens)
                except Exception as save_err:
                    logger.warning(f"[tg_bot] 画像存储失败 [bot#{bot_id}]: {save_err}")
        except Exception as e:
            logger.error(f"[tg_bot] 画像生成失败 [bot#{bot_id}]: {e}")
    _histories_today.clear()
    rc.clear_today_histories()


async def _schedule_loop() -> None:
    while _shared_running:
        now = datetime.now()
        tomorrow_midnight = (now + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        wait_secs = (tomorrow_midnight - now).total_seconds()
        logger.info(f"[tg_bot] 画像调度：距下次更新 {wait_secs/3600:.1f} 小时")
        try:
            await asyncio.sleep(wait_secs)
        except asyncio.CancelledError:
            return
        if _shared_running:
            await _profile_update_job()


# ── 公开控制接口 ─────────────────────────────────────────────────

def is_running() -> bool:
    return any(s.running for s in _bots.values()) or _shared_running


async def start() -> bool:
    global _consumer_task, _schedule_task, _shared_running

    bots_rows = db.get_all_bots()
    if not bots_rows:
        raise RuntimeError("数据库中尚未注册任何 Bot，请先通过 /users/{id}/bots 添加")

    started_any = False
    for row in bots_rows:
        bot_id = row["id"]
        token  = row.get("token", "").strip()
        chat_id = str(row.get("chat_id", "")).strip()
        if not token:
            logger.warning(f"[tg_bot] bot#{bot_id} 缺少 Token，跳过")
            continue

        if bot_id in _bots and _bots[bot_id].running:
            continue  # 已运行

        state = _BotState(
            bot_id=bot_id,
            token=token,
            chat_id=chat_id,
            user_id=row.get("user_id"),
            chat_prompt_id=row.get("chat_prompt_id"),
            bot_mode=row.get("bot_mode", "all"),
        )
        state.running = True
        state.poll_task = asyncio.create_task(_bot_loop(state))
        _bots[bot_id] = state
        started_any = True

    if not started_any and not _shared_running:
        # 所有 bot 已在运行
        return False

    if not _shared_running:
        _shared_running = True
        _consumer_task = asyncio.create_task(_consumer_loop())
        _schedule_task = asyncio.create_task(_schedule_loop())

    try:
        ws_pub.publish_bot_status({"running": True})
    except Exception:
        pass
    return started_any or _shared_running


async def stop() -> None:
    global _shared_running, _consumer_task, _schedule_task

    for state in list(_bots.values()):
        state.running = False
        if state.poll_task and not state.poll_task.done():
            state.poll_task.cancel()
            try:
                await state.poll_task
            except asyncio.CancelledError:
                pass
        state.poll_task = None

    _shared_running = False
    for t in (_consumer_task, _schedule_task):
        if t:
            t.cancel()
            try:
                await t
            except asyncio.CancelledError:
                pass
    _consumer_task = None
    _schedule_task = None

    try:
        ws_pub.publish_bot_status({"running": False})
    except Exception:
        pass


def clear_history(bot_id: int | None = None) -> None:
    """清空指定 bot 或所有 bot 的对话历史（内存 + Redis）"""
    if bot_id:
        _histories.pop(bot_id, None)
        _histories_today.pop(bot_id, None)
        rc.delete_history(bot_id)
    else:
        _histories.clear()
        _histories_today.clear()
        rc.clear_today_histories()


def generate_profile_now(bot_id: int) -> tuple[str, int]:
    """立即根据聊天记录生成/更新用户画像，供调试接口调用。"""
    today_history = _histories_today.get(bot_id, [])
    if not today_history:
        today_history = _histories.get(bot_id, [])
    existing = db.get_profile(bot_id) if bot_id else ""
    new_profile, tokens = build_user_profile(today_history, existing)
    if new_profile and bot_id:
        try:
            db.save_profile(bot_id, new_profile)
            _wlog(f"👤 用户画像已更新（手动触发）[bot#{bot_id}]", tokens=tokens)
        except Exception as e:
            logger.warning(f"[tg_bot] 画像存储失败 [bot#{bot_id}]: {e}")
    _histories_today.pop(bot_id, None)
    return new_profile or existing or "", tokens


def _wlog(msg: str, level: str = "info", tokens: int = 0) -> None:
    """写 logger 和持久化日志数据库（log_type=chat）"""
    ts = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    db.insert_log(ts, level, msg, db.LogType.CHAT, tokens)
    if level == "error":
        logger.error(msg)
    elif level == "warn":
        logger.warning(msg)
    else:
        logger.info(msg)


_task:           asyncio.Task | None = None
_schedule_task:  asyncio.Task | None = None
_consumer_task:  asyncio.Task | None = None
_running:        bool = False

# 当前运行的 Bot DB ID（单 bot 模式，Task 7 改为多 bot）
_bot_id: int = 0
_user_id: Optional[int] = None   # 当前 Bot 所属用户 ID（用于 Gmail OAuth 等）

# bot_id → 对话历史列表（窗口，内存缓存 + Redis 持久化）
_histories: Dict[int, List[Dict[str, str]]] = {}

# bot_id → 今日完整对话历史（内存缓存 + Redis 持久化，画像更新后清空）
_histories_today: Dict[int, List[Dict[str, str]]] = {}


def _get_updates(token: str, offset: int, timeout: int = 30) -> list:
    """调用 Telegram getUpdates（长轮询）"""
    url = TELEGRAM_API.format(token=token, method="getUpdates")
    try:
        resp = requests.get(
            url,
            params={"offset": offset, "timeout": timeout, "allowed_updates": '["message"]'},
            timeout=timeout + 5,
        )
        data = resp.json()
        if data.get("ok"):
            return data.get("result", [])
    except Exception as e:
        logger.warning(f"[tg_bot] getUpdates 失败: {e}")
    return []


def _send_reply(token: str, chat_id: str, text: str) -> None:
    """发送回复消息"""
    url = TELEGRAM_API.format(token=token, method="sendMessage")
    try:
        requests.post(
            url,
            json={"chat_id": chat_id, "text": text},
            timeout=15,
        )
    except Exception as e:
        logger.warning(f"[tg_bot] 发送回复失败: {e}")


# ── 会话历史辅助函数（内存缓存 + Redis 持久化） ──────────────────

def _get_history(bot_id: int) -> list:
    """读取对话窗口历史：内存命中直接返回，否则从 Redis 加载（重启恢复）。"""
    if bot_id not in _histories:
        _histories[bot_id] = rc.load_history(bot_id)
    return _histories[bot_id]


def _save_history(bot_id: int, history: list) -> None:
    _histories[bot_id] = history
    rc.save_history(bot_id, history)


def _get_today(bot_id: int) -> list:
    if bot_id not in _histories_today:
        _histories_today[bot_id] = rc.load_history_today(bot_id)
    return _histories_today[bot_id]


def _append_today(bot_id: int, user_msg: str, ai_msg: str) -> None:
    today = _get_today(bot_id)
    today.append({"role": "user",      "content": user_msg})
    today.append({"role": "assistant", "content": ai_msg})
    _histories_today[bot_id] = today
    rc.save_history_today(bot_id, today)


def _handle_message(token: str, bot_id: int, chat_id: str, text: str,
                    from_user: Optional[dict] = None,
                    user_id: Optional[int] = None) -> None:
    """处理单条消息，调用 AI 并回复"""
    text = text.strip()

    # 内置命令
    if text in ("/start", "/hi", "/hello"):
        _send_reply(token, chat_id, "👋 你好！我是小星（Xiaoxing），有什么可以帮你的吗？")
        return
    if text == "/clear":
        _histories.pop(bot_id, None)
        _histories_today.pop(bot_id, None)
        rc.delete_history(bot_id)
        _send_reply(token, chat_id, "🗑️ 对话历史已清空！重新开始聊天吧~")
        return
    if text == "/help":
        _send_reply(
            token, chat_id,
            "💡 可用命令：\n"
            "/clear — 清空对话历史\n"
            "/start — 打招呼\n\n"
            "直接发消息即可与 AI 聊天 😊"
        )
        return

    history = _get_history(bot_id)

    # 读取用户画像
    profile = db.get_profile(bot_id) if bot_id else ""

    # 工具路由和 AI 回复（耗时操作，放锁外）
    db_context, tool_tokens = route_and_execute(text, user_id=user_id)

    # 记录用户消息
    _wlog(f"💬 {_sender_label(from_user)}: {text[:80]}")

    try:
        reply, tokens = chat_reply(text, history, profile=profile, db_context=db_context)
    except Exception as e:
        logger.error(f"[tg_bot] AI 回复失败: {e}")
        _wlog(f"❌ AI 回复失败 [{chat_id}]: {e}", level="error")
        _send_reply(token, chat_id, "⚠️ AI 暂时无法回复，请稍后再试。")
        return

    # 加锁写历史，防止并发竞态
    with _get_lock(bot_id):
        history = _get_history(bot_id)   # 重新读取，防止锁等待期间被其他线程修改
        history.append({"role": "user",      "content": text})
        history.append({"role": "assistant", "content": reply})
        if len(history) > CHAT_HISTORY_MAX * 2:
            history = history[-(CHAT_HISTORY_MAX * 2):]
        _save_history(bot_id, history)
        # 追加今日完整历史（内存 + Redis）
        _append_today(bot_id, text, reply)

    # 记录 AI 回复（含 token 数）
    _wlog(f"🤖 Xiaoxing → {_sender_label(from_user)}: {reply[:80]}", tokens=tokens)
    _send_reply(token, chat_id, reply)


async def _loop() -> None:
    global _running, _bot_id, _user_id
    token       = config.TELEGRAM_BOT_TOKEN
    allowed_id  = str(config.TELEGRAM_CHAT_ID).strip()
    offset      = 0

    # 解析当前运行的 bot_id（从 DB 取默认 bot，Task 7 改为多 bot 迭代）
    try:
        bots = db.get_all_bots()
        if bots:
            _bot_id  = bots[0]["id"]
            _user_id = bots[0].get("user_id")
    except Exception:
        pass

    logger.info("[tg_bot] Bot Worker 已启动，开始监听消息…")
    _wlog("▶️ Bot Worker 已启动")

    while _running:
        if not token:
            await asyncio.sleep(5)
            continue

        updates = await asyncio.to_thread(_get_updates, token, offset)
        for upd in updates:
            offset = upd["update_id"] + 1
            msg = upd.get("message") or upd.get("edited_message")
            if not msg:
                continue
            chat_id   = str(msg.get("chat", {}).get("id", ""))
            from_user = msg.get("from", {})
            text      = msg.get("text", "").strip()
            update_id = upd["update_id"]
            if not text:
                continue

            # 安全过滤：只响应已授权的 chat_id
            if allowed_id and chat_id != allowed_id:
                logger.warning(f"[tg_bot] 忽略未授权消息，来自 chat_id={chat_id}")
                continue

            # 防重复处理（Redis SET NX）
            if not rc.mark_update(update_id):
                logger.debug(f"[tg_bot] 跳过重复 update_id={update_id}")
                continue

            logger.info(f"[tg_bot] 收到消息 [{chat_id}]: {text[:60]}")

            # 入队（Redis 可用时）；失败则降级为直接处理
            if not rc.enqueue(update_id, _bot_id, chat_id, text, from_user):
                await asyncio.to_thread(_handle_message, token, _bot_id, chat_id, text, from_user, _user_id)

        # 如果没有 updates，短暂 yield 控制权（getUpdates 本身已经长轮询 30s）
        await asyncio.sleep(0)

    logger.info("[tg_bot] Bot Worker 已停止")
    _wlog("⏹️ Bot Worker 已停止")


async def _consumer_loop() -> None:
    """
    任务队列消费者：从 Redis queue:chat BRPOP 消息并调用 _handle_message。
    当 Redis 不可达时，此 loop 空转（消息已在 _loop 中降级为直接处理）。
    """
    token = config.TELEGRAM_BOT_TOKEN
    logger.info("[tg_bot] 消费者任务已启动")
    while _running:
        try:
            item = await rc.dequeue(timeout=2)
            if item is None:
                continue
            bot_id    = int(item.get("bot_id", 0))
            chat_id   = item.get("chat_id", "")
            text      = item.get("text", "")
            from_user = item.get("from_user", {})
            if chat_id and text:
                await asyncio.to_thread(_handle_message, token, bot_id, chat_id, text, from_user, _user_id)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning(f"[tg_bot] 消费者异常: {e}")
            await asyncio.sleep(1)
    logger.info("[tg_bot] 消费者任务已停止")


async def _profile_update_job() -> None:
    """遍历所有今日有记录的 bot，生成/更新用户画像并存库。"""
    # 合并内存和 Redis 中的 bot_id（跨重启恢复）
    all_bot_ids = set(_histories_today.keys()) | set(rc.get_today_bot_ids())
    if not all_bot_ids:
        logger.info("[tg_bot] 画像更新：今日无聊天记录，跳过。")
        return

    for bot_id in all_bot_ids:
        today_history = _get_today(bot_id)
        if not today_history:
            continue
        try:
            existing = db.get_profile(bot_id)
            logger.info(f"[tg_bot] 正在为 bot#{bot_id} 生成用户画像（{len(today_history)//2} 轮对话）…")
            new_profile, profile_tokens = await asyncio.to_thread(
                build_user_profile, today_history, existing
            )
            if new_profile:
                try:
                    db.save_profile(bot_id, new_profile)
                    logger.info(f"[tg_bot] 用户画像已更新：bot#{bot_id}")
                    _wlog(f"👤 用户画像已更新 [bot#{bot_id}]", tokens=profile_tokens)
                except Exception as save_err:
                    logger.warning(f"[tg_bot] 画像存储失败 [bot#{bot_id}]: {save_err}")
        except Exception as e:
            logger.error(f"[tg_bot] 画像生成失败 [bot#{bot_id}]: {e}")

    # 清空今日历史（内存 + Redis）
    _histories_today.clear()
    rc.clear_today_histories()


async def _schedule_loop() -> None:
    """每天 00:00 触发一次画像更新任务。"""
    while _running:
        now = datetime.now()
        tomorrow_midnight = (now + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        wait_seconds = (tomorrow_midnight - now).total_seconds()
        logger.info(f"[tg_bot] 画像调度：距下次更新 {wait_seconds/3600:.1f} 小时")
        try:
            await asyncio.sleep(wait_seconds)
        except asyncio.CancelledError:
            return
        if _running:
            await _profile_update_job()


# ── 公开控制接口 ────────────────────────────

def is_running() -> bool:
    return _running


async def start() -> bool:
    global _task, _schedule_task, _consumer_task, _running
    if _running:
        return False
    missing = config.validate_telegram()
    if missing:
        raise RuntimeError(f"缺少 Telegram 配置项：{', '.join(missing)}，请检查 .env 文件")
    _running = True
    _task          = asyncio.create_task(_loop())
    _schedule_task = asyncio.create_task(_schedule_loop())
    _consumer_task = asyncio.create_task(_consumer_loop())
    try:
        ws_pub.publish_bot_status({"running": True})
    except Exception:
        pass
    return True


async def stop() -> None:
    global _running, _task, _schedule_task, _consumer_task
    _running = False
    for t in (_task, _schedule_task, _consumer_task):
        if t:
            t.cancel()
            try:
                await t
            except asyncio.CancelledError:
                pass
    _task          = None
    _schedule_task = None
    _consumer_task = None
    try:
        ws_pub.publish_bot_status({"running": False})
    except Exception:
        pass


def clear_history(bot_id: int | None = None) -> None:
    """清空指定 bot 或所有 bot 的对话历史（内存 + Redis，供 API 调用）"""
    if bot_id:
        _histories.pop(bot_id, None)
        _histories_today.pop(bot_id, None)
        rc.delete_history(bot_id)
    else:
        _histories.clear()
        _histories_today.clear()
        rc.clear_today_histories()


def generate_profile_now(bot_id: int) -> tuple[str, int]:
    """
    立即根据聊天记录生成/更新用户画像，并清空今日历史。
    供调试接口调用。
    """
    today_history = _histories_today.get(bot_id, [])
    # Fallback to recent window history so debug button always calls AI
    if not today_history:
        today_history = _histories.get(bot_id, [])
    existing = db.get_profile(bot_id) if bot_id else ""
    new_profile, tokens = build_user_profile(today_history, existing)
    if new_profile and bot_id:
        try:
            db.save_profile(bot_id, new_profile)
            _wlog(f"👤 用户画像已更新（手动触发）[bot#{bot_id}]", tokens=tokens)
        except Exception as e:
            logger.warning(f"[tg_bot] 画像存储失败 [bot#{bot_id}]: {e}")
    # 清空今日历史，下次只累积新对话
    _histories_today.pop(bot_id, None)
    return new_profile or existing or "", tokens
