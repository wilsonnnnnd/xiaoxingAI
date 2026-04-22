"""Tool: get_time — 返回服务器当前日期、时间和星期。"""
import logging
from datetime import datetime

from app.core.tools import register

logger = logging.getLogger("tools")


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
    result = f"Server time: {now.strftime('%Y-%m-%d %a %H:%M:%S')}"
    logger.info(f"[tools] get_time → {result}")
    return result
