"""
Telegram Bot 聊天 Worker — 核心模块
功能：长轮询 getUpdates，接收用户发来的消息，调用本地 AI 回复
- 仅响应来自已配置 TELEGRAM_CHAT_ID 的消息（安全过滤）
- 维护每个 chat 的对话历史（内存，最多 CHAT_HISTORY_MAX 轮）
- 支持 /clear 命令清空对话历史
- 支持 /start 命令打招呼
- 每日午夜自动生成/更新用户画像
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List

import requests

from app import config, db
from app.core.chat import build_user_profile, chat_reply, CHAT_HISTORY_MAX
from app.core.telegram import TELEGRAM_API

logger = logging.getLogger("tg_bot")


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
_running:        bool = False

# chat_id → 对话历史列表（窗口，用于 prompt 注入）
_histories: Dict[str, List[Dict[str, str]]] = {}

# chat_id → 今日完整对话历史（用于生成用户画像，重置于每次画像更新后）
_histories_today: Dict[str, List[Dict[str, str]]] = {}


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


def _handle_message(token: str, chat_id: str, text: str) -> None:
    """处理单条消息，调用 AI 并回复"""
    text = text.strip()

    # 内置命令
    if text in ("/start", "/hi", "/hello"):
        _send_reply(token, chat_id, "👋 你好！我是小星（Xiaoxing），有什么可以帮你的吗？")
        return
    if text == "/clear":
        _histories.pop(chat_id, None)
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

    history = _histories.get(chat_id, [])

    # 读取用户画像
    profile = db.get_profile(chat_id)

    # 记录用户消息
    _wlog(f"💬 用户: {text[:80]}")

    try:
        reply, tokens = chat_reply(text, history, profile=profile)
    except Exception as e:
        logger.error(f"[tg_bot] AI 回复失败: {e}")
        _wlog(f"❌ AI 回复失败 [{chat_id}]: {e}", level="error")
        _send_reply(token, chat_id, "⚠️ AI 暂时无法回复，请稍后再试。")
        return

    # 更新窗口历史
    history.append({"role": "user",      "content": text})
    history.append({"role": "assistant", "content": reply})
    if len(history) > CHAT_HISTORY_MAX * 2:
        history = history[-(CHAT_HISTORY_MAX * 2):]
    _histories[chat_id] = history

    # 追加今日完整历史（用于画像生成）
    today = _histories_today.setdefault(chat_id, [])
    today.append({"role": "user",      "content": text})
    today.append({"role": "assistant", "content": reply})

    # 记录 AI 回复（含 token 数）
    _wlog(f"🤖 Xiaoxing: {reply[:80]}", tokens=tokens)
    _send_reply(token, chat_id, reply)


async def _loop() -> None:
    global _running
    token       = config.TELEGRAM_BOT_TOKEN
    allowed_id  = str(config.TELEGRAM_CHAT_ID).strip()
    offset      = 0

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
            chat_id = str(msg.get("chat", {}).get("id", ""))
            text    = msg.get("text", "").strip()
            if not text:
                continue

            # 安全过滤：只响应已授权的 chat_id
            if allowed_id and chat_id != allowed_id:
                logger.warning(f"[tg_bot] 忽略未授权消息，来自 chat_id={chat_id}")
                continue

            logger.info(f"[tg_bot] 收到消息 [{chat_id}]: {text[:60]}")
            await asyncio.to_thread(_handle_message, token, chat_id, text)

        # 如果没有 updates，短暂 yield 控制权（getUpdates 本身已经长轮询 30s）
        await asyncio.sleep(0)

    logger.info("[tg_bot] Bot Worker 已停止")
    _wlog("⏹️ Bot Worker 已停止")


async def _profile_update_job() -> None:
    """遍历所有今日有记录的 chat，生成/更新用户画像并存库。"""
    if not _histories_today:
        logger.info("[tg_bot] 画像更新：今日无聊天记录，跳过。")
        return

    for chat_id, today_history in list(_histories_today.items()):
        if not today_history:
            continue
        try:
            existing = db.get_profile(chat_id)
            logger.info(f"[tg_bot] 正在为 {chat_id} 生成用户画像（{len(today_history)//2} 轮对话）…")
            new_profile, profile_tokens = await asyncio.to_thread(
                build_user_profile, today_history, existing
            )
            if new_profile:
                db.save_profile(chat_id, new_profile)
                logger.info(f"[tg_bot] 用户画像已更新：{chat_id}")
                _wlog(f"👤 用户画像已更新 [{chat_id}]", tokens=profile_tokens)
        except Exception as e:
            logger.error(f"[tg_bot] 画像生成失败 [{chat_id}]: {e}")

    # 清空今日历史，开始下一天的累积
    _histories_today.clear()


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
    global _task, _schedule_task, _running
    if _running:
        return False
    if not config.TELEGRAM_BOT_TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN 未配置")
    _running = True
    _task          = asyncio.create_task(_loop())
    _schedule_task = asyncio.create_task(_schedule_loop())
    return True


async def stop() -> None:
    global _running, _task, _schedule_task
    _running = False
    for t in (_task, _schedule_task):
        if t:
            t.cancel()
            try:
                await t
            except asyncio.CancelledError:
                pass
    _task          = None
    _schedule_task = None


def clear_history(chat_id: str | None = None) -> None:
    """清空指定 chat 或所有 chat 的对话历史（供 API 调用）"""
    if chat_id:
        _histories.pop(str(chat_id), None)
    else:
        _histories.clear()


def generate_profile_now(chat_id: str) -> tuple[str, int]:
    """
    立即根据聊天记录生成/更新用户画像，并清空今日历史。
    供调试接口调用。
    """
    today_history = _histories_today.get(str(chat_id), [])
    # Fallback to recent window history so debug button always calls AI
    if not today_history:
        today_history = _histories.get(str(chat_id), [])
    existing = db.get_profile(str(chat_id))
    new_profile, tokens = build_user_profile(today_history, existing)
    if new_profile:
        db.save_profile(str(chat_id), new_profile)
        _wlog(f"👤 用户画像已更新（手动触发）[{chat_id}]", tokens=tokens)
    # 清空今日历史，下次只累积新对话
    _histories_today.pop(str(chat_id), None)
    return new_profile or existing or "", tokens
