"""
Tool registry — public API.

Import this package anywhere you need routing:
    from app.core.tools import route_and_execute

Add a new tool by creating a file under this directory and registering it here.

两种工具类型：
  零参数工具: fn()          → 适合 get_time, get_emails
  带消息工具: fn(message)   → 适合需要从用户消息提取参数的工具（如 fetch_email）
"""
import json
import logging
import re
from typing import Callable

from app.core.llm import call_router

logger = logging.getLogger("tools")


# ── Registry ──────────────────────────────────────────────────────

class _Tool:
    def __init__(self, name: str, description: str,
                 fn: Callable,
                 keywords: list[str],
                 takes_message: bool = False,
                 takes_user_id: bool = False):
        self.name = name
        self.description = description
        self.fn = fn
        self.keywords = [kw.lower() for kw in keywords]
        self.takes_message = takes_message
        self.takes_user_id = takes_user_id


_registry: dict[str, _Tool] = {}


def register(name: str, description: str,
             keywords: list[str] | None = None,
             takes_message: bool = False,
             takes_user_id: bool = False):
    """
    Decorator: register a function as a callable tool.

    takes_message=False (default): fn() — 无参数
    takes_message=True:            fn(message: str) — 接收原始用户消息
    takes_user_id=True:            fn(..., user_id=int|None) — 接收当前用户 ID

    Usage:
        @register("tool_name", "工具描述", keywords=["触发词"])
        def my_tool() -> str:
            return "结果"

        @register("tool_name", "工具描述", keywords=["触发词"],
                  takes_message=True, takes_user_id=True)
        def my_tool(message: str, user_id=None) -> str:
            return "结果"
    """
    def decorator(fn: Callable) -> Callable:
        _registry[name] = _Tool(name, description, fn, keywords or [],
                                takes_message, takes_user_id)
        return fn
    return decorator


# ── Load all tool modules (each self-registers via @register) ─────

from app.core.tools import time_tool    # noqa: E402, F401
from app.core.tools import emails_tool  # noqa: E402, F401
from app.core.tools import fetch_email_tool  # noqa: E402, F401


# ── Router ────────────────────────────────────────────────────────

_ROUTER_PROMPT = """\
你是一个工具调度器。根据用户消息，从下面的可用工具中选出需要调用的工具。

可用工具：
{tools}

用户消息：{message}

只输出 JSON 数组，不要任何其他文字。不需要任何工具时输出 []。
正确示例：["get_time"]  ["get_emails"]  ["get_emails","get_time"]  []
"""


def _keyword_match(message: str) -> list[str]:
    lower = message.lower()
    return [
        name for name, tool in _registry.items()
        if any(kw in lower for kw in tool.keywords)
    ]


def _llm_route(message: str) -> tuple[list[str], int]:
    tools_desc = "\n".join(
        f"- {t.name}: {t.description}" for t in _registry.values()
    )
    prompt = _ROUTER_PROMPT.format(tools=tools_desc, message=message)
    try:
        raw, tokens = call_router(prompt)
        m = re.search(r"\[.*?\]", raw, re.DOTALL)
        names: list[str] = json.loads(m.group()) if m else []
        return [n for n in names if n in _registry], tokens
    except Exception as e:
        logger.debug(f"[tools] Router 调用失败: {e}")
        return [], 0


def route_and_execute(message: str, user_id: int | None = None) -> tuple[str, int]:
    """
    路由并执行工具，返回 (合并结果字符串, 消耗 token 数)。
    1. LLM Router 分析意图（AI 优先）
    2. 无结果时降级为关键词匹配

    user_id: 当前用户 ID，传给声明了 takes_user_id=True 的工具（用于多用户 OAuth）。
    """
    if not _registry:
        return "", 0

    tool_names, tokens = _llm_route(message)
    logger.info(f"[tools] LLM路由: msg={message!r} → {tool_names}")

    if not tool_names:
        tool_names = _keyword_match(message)
        logger.info(f"[tools] 关键词降级: msg={message!r} → {tool_names}")

    results: list[str] = []
    for name in tool_names:
        try:
            tool = _registry[name]
            kwargs = {}
            if tool.takes_user_id:
                kwargs["user_id"] = user_id
            result = tool.fn(message, **kwargs) if tool.takes_message else tool.fn(**kwargs)
            logger.info(f"[tools] {name} → {result[:80]}")
            results.append(result)
        except Exception as e:
            logger.warning(f"[tools] {name} 执行失败: {e}")
            results.append(f"【工具 {name} 调用失败，无法获取实时数据，请如实告知用户】")

    return "\n\n".join(results), tokens
