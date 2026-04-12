"""
Telegram 工具模块 — 核心模块
封装消息发送、连接测试、Chat ID 探测，以及 MarkdownV2 转义。
"""
import re

import requests

from app.core import config


TELEGRAM_API = "https://api.telegram.org/bot{token}/{method}"


def escape_markdown(text: str) -> str:
    """对字符串中的 MarkdownV2 特殊字符进行转义"""
    if not text:
        return ""
    escape_chars = r'_*[]()~`>#+-=|{}.!'
    return re.sub(
        f'([{re.escape(escape_chars)}])',
        r'\\\1',
        text
    )


def send_message(
    text: str,
    chat_id: str = None,
    parse_mode: str = "MarkdownV2",
    token: str = None,
    reply_markup: dict | None = None,
) -> dict:
    """
    发送消息到 Telegram。
    token   不传则使用 .env 中的 TELEGRAM_BOT_TOKEN（兼容旧调用）。
    chat_id 不传则使用 .env 中的 TELEGRAM_CHAT_ID。
    parse_mode 默认 MarkdownV2，传 None 则发纯文本。
    """
    token   = token or config.TELEGRAM_BOT_TOKEN
    chat_id = chat_id or config.TELEGRAM_CHAT_ID

    if not token or not chat_id:
        raise RuntimeError("TELEGRAM_BOT_TOKEN 或 TELEGRAM_CHAT_ID 未配置，请检查 .env 文件")

    url     = TELEGRAM_API.format(token=token, method="sendMessage")
    payload = {"chat_id": chat_id, "text": text}
    if parse_mode:
        payload["parse_mode"] = parse_mode
    if reply_markup:
        payload["reply_markup"] = reply_markup

    resp = requests.post(url, json=payload, timeout=15)
    data = resp.json()

    if not data.get("ok"):
        raise RuntimeError(f"Telegram API 错误: {data.get('description', data)}")

    return data


def edit_message_text(
    *,
    chat_id: str,
    message_id: int,
    text: str,
    token: str,
    parse_mode: str = "MarkdownV2",
    reply_markup: dict | None = None,
) -> dict:
    if not token or not chat_id:
        raise RuntimeError("TELEGRAM_BOT_TOKEN 或 TELEGRAM_CHAT_ID 未配置，请检查 .env 文件")
    url = TELEGRAM_API.format(token=token, method="editMessageText")
    payload = {"chat_id": chat_id, "message_id": message_id, "text": text}
    if parse_mode:
        payload["parse_mode"] = parse_mode
    if reply_markup:
        payload["reply_markup"] = reply_markup

    resp = requests.post(url, json=payload, timeout=15)
    data = resp.json()
    if not data.get("ok"):
        raise RuntimeError(f"Telegram API 错误: {data.get('description', data)}")
    return data


def test_connection() -> dict:
    """发送纯文本测试消息，验证 Token 和 Chat ID 是否有效"""
    return send_message(
        "✅ Gmail AI Manager 连接测试成功！",
        parse_mode=None
    )


def get_latest_chat_id(token: str) -> str | None:
    """
    调用 getUpdates 获取最新一条消息的 chat_id。
    仅使用传入的 token（不依赖已保存的 TELEGRAM_CHAT_ID）。
    返回 chat_id 字符串，或 None（暂无消息）。
    """
    url  = TELEGRAM_API.format(token=token, method="getUpdates")
    resp = requests.get(url, params={"limit": 1, "offset": -1}, timeout=10)
    data = resp.json()

    if not data.get("ok"):
        raise RuntimeError(f"Telegram API 错误: {data.get('description', data)}")

    results = data.get("result", [])
    if not results:
        return None

    msg = results[-1]
    # 支持普通消息和 channel_post
    for key in ("message", "channel_post", "edited_message", "edited_channel_post"):
        if key in msg:
            return str(msg[key]["chat"]["id"])

    return None
