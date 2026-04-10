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
    persona_prompt: str = "",
) -> tuple:
    """
    使用 chat.txt prompt 与用户进行对话。
    history: 形如 [{"role": "user", ...}, {"role": "assistant", ...}]
    profile: 用户画像文本，注入 prompt 让 AI 个性化回复。
    db_context: 数据库查询结果文本，供 AI 回答数据相关问题。
    persona_prompt: Bot 绑定的自定义聊天人格提示词，设定后覆盖默认 Xiaoxing 风格。
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

    # 工具调用结果注入段
    db_context_section = ""
    if db_context and db_context.strip():
        db_context_section = (
            f"【系统实时数据 — 下方信息由工具实时获取，必须以此为准，禁止用自己的知识或猜测覆盖】\n"
            f"{db_context.strip()}\n"
            f"【以上数据来自系统工具，请直接基于此数据回答用户问题】\n\n"
        )

    # 自定义聊天人格（Bot 绑定的提示词）；无设置时用默认 Xiaoxing 描述
    if persona_prompt and persona_prompt.strip():
        # 解析 [身份设定] 行，生成强制直接陈述句让小模型更好遵守
        identity_header = ""
        first_line = persona_prompt.strip().split("\n")[0]
        if first_line.startswith("[身份设定]"):
            attrs_str = first_line.replace("[身份设定]", "").strip()
            # 只取第一个句号前的属性部分，避免把后续说明文字混进去
            if "。" in attrs_str:
                attrs_str = attrs_str.split("。")[0].strip()
            parts = [p.strip() for p in attrs_str.replace("、", "，").split("，") if "：" in p]
            if parts:
                attr_parts = []
                for p in parts:
                    if "：" in p:
                        k, v = p.split("：", 1)
                        attr_parts.append(f"你的{k}是{v}")
                attr_sentence = "，".join(attr_parts)
                identity_header = (
                    "【强制身份设定，最高优先级】\n"
                    f"{attr_sentence}。\n"
                    "这是你的真实身份，不是\"设定\"或\"角色扮演\"，就是你自己。\n"
                    "当用户问你星座、属相、性别、年龄时，直接回答，例如\"我是双鱼座\"。\n"
                    "禁止说\"我没有星座\"\"我没有具体的星座\"\"我只是AI所以没有星座\"等任何否定自身属性的话。\n"
                    "即使之前的对话历史里有错误的回答，也必须按照此设定如实作答。\n\n"
                )
        persona_section = identity_header + persona_prompt.strip() + "\n\n"
    else:
        persona_section = "你是一位名叫 Xiaoxing（小星 AI）的 AI 助手，性格活泼、温暖、有点俏皮，说话口语化但不失礼貌。\n"

    template = load_prompt(config.PROMPT_CHAT)
    prompt = template.format(
        history=history_text,
        message=message,
        profile_section=profile_section,
        db_context_section=db_context_section,
        persona_section=persona_section,
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
