"""
聊天核心模块 — 主要功能
- chat_reply(): 与用户实时对话（Xiaoxing 人格）
- build_user_profile(): 根据聊天历史生成/更新用户画像
"""
import re
from typing import Dict, List

from app import config
from app.core.llm import call_llm
from app.utils.prompt_loader import load_prompt


CHAT_HISTORY_MAX = 20   # 最多保留最近 N 条对话历史（每条 = 用户+助手一轮）


def chat_reply(
    message: str,
    history: List[Dict[str, str]] | None = None,
    profile: str = "",
    db_context: str = "",
) -> tuple:
    """
    使用 chat.txt prompt 与用户进行对话。
    history: 形如 [{"role": "user", ...}, {"role": "assistant", ...}]
    profile: 用户画像文本，注入 prompt 让 AI 个性化回复。
    db_context: 数据库查询结果文本，供 AI 回答数据相关问题。
    返回 (reply_str, token_count)。
    """
    if history is None:
        history = []

    # 构建历史对话文本
    history_text = ""
    for turn in history[-(CHAT_HISTORY_MAX * 2):]:
        if turn["role"] == "user":
            history_text += f"用户：{turn['content']}\n"
        else:
            history_text += f"Xiaoxing：{turn['content']}\n"

    # 用户画像注入段
    profile_section = ""
    if profile and profile.strip():
        profile_section = f"【用户画像参考（请据此调整回复风格和内容）】\n{profile.strip()}\n\n"

    # 数据库上下文注入段
    db_context_section = ""
    if db_context and db_context.strip():
        db_context_section = f"【数据库查询结果（请根据此数据回答用户问题）】\n{db_context.strip()}\n\n"

    template = load_prompt(config.PROMPT_CHAT)
    prompt = template.format(
        history=history_text,
        message=message,
        profile_section=profile_section,
        db_context_section=db_context_section,
    )

    raw, tokens = call_llm(prompt, max_tokens=400)
    reply = raw.strip()
    # 去掉模型可能重复输出的 "Xiaoxing：" 前缀
    reply = re.sub(r"^Xiaoxing[：:]\s*", "", reply)
    return reply, tokens


def build_user_profile(
    chat_history: List[Dict[str, str]],
    existing_profile: str = "",
) -> tuple:
    """
    根据今日聊天记录和已有画像，生成/更新用户画像文本。
    chat_history: 完整的对话历史列表（user/assistant 交替）
    existing_profile: 数据库中已有的画像文本
    返回 (profile_str, token_count)。
    """
    if not chat_history:
        return existing_profile, 0

    # 构建对话文本
    history_text = ""
    for turn in chat_history:
        if turn["role"] == "user":
            history_text += f"用户：{turn['content']}\n"
        else:
            history_text += f"Xiaoxing：{turn['content']}\n"

    template = load_prompt(config.PROMPT_PROFILE)
    prompt = template.format(
        existing_profile=existing_profile.strip() if existing_profile else "（暂无）",
        chat_history=history_text,
    )

    raw, tokens = call_llm(prompt, max_tokens=600)
    return raw.strip(), tokens
