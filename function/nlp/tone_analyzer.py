"""Simple tone analyzer used by main_chat minimal flow.

Provides `analyze_tone(text: str) -> dict`.
This is a lightweight heuristic fallback so the CLI works without extra deps.
"""
from typing import Dict


def analyze_tone(text: str) -> Dict[str, object]:
    """Return a simple tone classification for `text`.

    Returns a dict like: {"tone": "positive"/"negative"/"neutral", "score": float}
    """
    if not text:
        return {"tone": "neutral", "score": 0.0}

    t = text.lower()
    positive_keywords = ("喜欢", "好", "不错", "喜欢你", "高兴", "快乐", "感谢", "谢谢")
    negative_keywords = ("讨厌", "不行", "差", "生气", "愤怒", "伤心", "难过", "不喜欢")

    for k in positive_keywords:
        if k in t:
            return {"tone": "positive", "score": 0.8}
    for k in negative_keywords:
        if k in t:
            return {"tone": "negative", "score": 0.8}

    return {"tone": "neutral", "score": 0.5}
