"""
Tool registry and keyword+LLM hybrid router for Function Calling.

添加新工具只需在本文件末尾用 @register 装饰器注册：

    @register(
        "tool_name",
        "工具功能描述（中文，供路由 LLM 理解）",
        keywords=["触发关键词1", "触发关键词2"],  # 关键词命中时跳过 LLM 直接调用
    )
    def my_tool() -> str:
        return "工具执行结果字符串"

路由优先级：关键词匹配（快/可靠）→ LLM 路由（兜底/复杂意图）
"""
import json
import logging
import re
from datetime import datetime
from typing import Callable

from app.core.llm import call_router

logger = logging.getLogger("tools")


# ── Registry ──────────────────────────────────────────────────────

class _Tool:
    def __init__(self, name: str, description: str, fn: Callable[[], str],
                 keywords: list[str]):
        self.name = name
        self.description = description
        self.fn = fn
        self.keywords = [kw.lower() for kw in keywords]


_registry: dict[str, _Tool] = {}


def register(name: str, description: str, keywords: list[str] | None = None):
    """Decorator: register a zero-argument function as a callable tool."""
    def decorator(fn: Callable[[], str]) -> Callable[[], str]:
        _registry[name] = _Tool(name, description, fn, keywords or [])
        return fn
    return decorator


# ── Built-in Tools ────────────────────────────────────────────────

@register(
    "get_time",
    "获取当前服务器日期、时间和星期几",
    keywords=[
        "几点", "时间", "现在", "当前时间",
        "今天", "今日", "日期", "几号",
        "星期", "周几", "礼拜",
        "明天", "昨天", "几月",
        "time", "date", "day", "get time",
    ],
)
def get_time() -> str:
    now = datetime.now()
    weekdays = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
    wd = weekdays[now.weekday()]
    result = f"当前服务器时间：{now.strftime('%Y年%m月%d日')} {wd} {now.strftime('%H:%M:%S')}"
    logger.info(f"[tools] get_time 调用成功 → {result}")
    return result


@register(
    "get_emails",
    "查询最近的邮件处理记录和统计数据",
    keywords=[
        "邮件", "邮箱", "email", "mail", "收件", "发件", "信件",
        "高优先级", "重要", "紧急", "优先",
        "已发送", "未读", "已处理",
        "邮件摘要", "邮件总结", "邮件统计",
    ],
)
def get_emails() -> str:
    from app import db
    try:
        records = db.get_email_records(limit=5)
        stats = db.get_stats()
        if not records:
            return f"邮件记录总数：{stats.get('email_records_count', 0)} 封，暂无详细记录。"
        lines = [f"邮件记录总数：{stats.get('email_records_count', 0)} 封，最近 {len(records)} 封如下：\n"]
        for i, r in enumerate(records, 1):
            summary = r.get("summary", {})
            brief = summary.get("brief", "") or r.get("telegram_msg", "")[:100]
            lines.append(
                f"{i}. [{r.get('priority', '')}] {r.get('subject', '（无主题）')}\n"
                f"   发件人：{r.get('sender', '未知')}  时间：{r.get('date', '')}\n"
                f"   摘要：{brief}"
            )
        return "\n".join(lines)
    except Exception as e:
        return f"（查询邮件失败: {e}）"


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
    """关键词路由：O(n) 扫描，命中即返回工具名列表。"""
    lower = message.lower()
    return [
        name for name, tool in _registry.items()
        if any(kw in lower for kw in tool.keywords)
    ]


def _llm_route(message: str) -> tuple[list[str], int]:
    """Router 小模型兜底：解析 JSON 数组，失败返回空列表。"""
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


def route_and_execute(message: str) -> tuple[str, int]:
    """
    两步走：
    1. LLM 分析用户意图 → 决定调用哪些工具（AI 优先）
    2. 执行工具，返回 (合并结果字符串, 消耗 token 数)
    若 LLM 路由失败则降级为关键词匹配。
    """
    if not _registry:
        return "", 0

    # Step 1: AI 分析意图
    tool_names, tokens = _llm_route(message)
    logger.info(f"[tools] LLM路由: msg={message!r} → {tool_names}")

    # 降级：LLM 无结果时用关键词匹配
    if not tool_names:
        tool_names = _keyword_match(message)
        logger.info(f"[tools] 关键词降级: msg={message!r} → {tool_names}")

    # Step 2: 执行工具
    results: list[str] = []
    for name in tool_names:
        try:
            result = _registry[name].fn()
            logger.info(f"[tools] {name} → {result}")
            results.append(result)
        except Exception as e:
            results.append(f"（{name} 执行失败: {e}）")

    return "\n\n".join(results), tokens

