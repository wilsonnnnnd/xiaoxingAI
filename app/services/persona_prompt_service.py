import json
import re
from fastapi import HTTPException
from app.core import config as app_config
from app.core.constants import PERSONA_LABEL_MAP
from app.schemas import ChatPersonaRequest
from app import db
from app.core.llm import call_llm

class PersonaPromptService:
    def _extract_json(self, text: str) -> dict:
        """从 LLM 输出中提取 JSON 对象，兼容 markdown 代码块。"""
        text = text.strip()
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
        text = re.sub(r"\s*```\s*$", "", text, flags=re.MULTILINE)
        text = text.strip()
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            text = text[start:end + 1]
        try:
            return json.loads(text)
        except Exception:
            return {}

    def _fmt(self, val) -> str:
        if isinstance(val, list):
            return "、".join(str(v) for v in val) if val else "—"
        return str(val) if val not in (None, "") else "—"

    def generate(self, payload: ChatPersonaRequest) -> dict:
        keywords = payload.keywords.strip()
        if not keywords:
            raise HTTPException(status_code=422, detail="keywords 不能为空")

        # ── 拼入星座 / 属相 / 性别 风格补充 ──────────────────────────
        persona_configs = db.get_persona_configs()
        supplements: list[str] = []

        for cat_key, selection in [
            ("zodiac",         payload.zodiac),
            ("chinese_zodiac", payload.chinese_zodiac),
            ("gender",         payload.gender),
        ]:
            if selection:
                content = persona_configs.get(cat_key, {}).get(selection, "").strip()
                if content:
                    supplements.append(f"[{PERSONA_LABEL_MAP[cat_key]}]\n{content}")

        # age 直接追加到 keywords，无需 DB 配置
        if payload.age and payload.age.strip():
            supplements.append(f"[年龄感参考]\n目标年龄感：{payload.age.strip()}")

        enriched_keywords = keywords
        if supplements:
            enriched_keywords = keywords + "\n\n" + "\n\n".join(supplements)

        tools_dir = app_config.PROMPTS_DIR / "tools"
        try:
            tone_tpl     = (tools_dir / "tonePersonaGenerator.txt").read_text(encoding="utf-8")
            portrait_tpl = (tools_dir / "characterPortraitGeneration.txt").read_text(encoding="utf-8")
            chat_tpl     = (tools_dir / "chatPrompt.txt").read_text(encoding="utf-8")
            style_tpl    = (tools_dir / "specificChatStyle.txt").read_text(encoding="utf-8")
        except FileNotFoundError as e:
            raise HTTPException(status_code=500, detail=f"提示词模板缺失: {e}")

        total_tokens = 0
        try:
            # Step 1: 语气/风格分析 → tone JSON
            tone_result, t1 = call_llm(tone_tpl.replace("{{user_input}}", enriched_keywords), max_tokens=512)
            total_tokens += t1
            tone_data = self._extract_json(tone_result)

            # Step 2: 角色画像 → portrait JSON
            portrait_prompt = (portrait_tpl
                               .replace("{{user_input}}", enriched_keywords)
                               .replace("{{tone_json}}", tone_result.strip()))
            portrait_result, t2 = call_llm(portrait_prompt, max_tokens=1024)
            total_tokens += t2
            portrait_data = self._extract_json(portrait_result)

            # Step 3: 自由叙述型 system prompt (chatPrompt.txt)
            narrative_prompt, t3 = call_llm(
                chat_tpl.replace("{{persona_json}}", portrait_result.strip()),
                max_tokens=1024,
            )
            total_tokens += t3

            # Step 4: 结构化模板填充 (specificChatStyle.txt) — 无需 LLM
            final_prompt = (style_tpl
                .replace("{{personality_traits}}",    self._fmt(portrait_data.get("personality_traits")))
                .replace("{{overall_persona_summary}}", self._fmt(portrait_data.get("overall_persona_summary")))
                .replace("{{social_persona}}",        self._fmt(portrait_data.get("social_persona")))
                .replace("{{role_impression}}",       self._fmt(portrait_data.get("role_impression")))
                .replace("{{tone}}",                  self._fmt(tone_data.get("tone")))
                .replace("{{style}}",                 self._fmt(tone_data.get("style")))
                .replace("{{communication_style}}",   self._fmt(portrait_data.get("communication_style")))
                .replace("{{rhythm}}",                self._fmt(tone_data.get("rhythm")))
                .replace("{{emotional_pattern}}",     self._fmt(portrait_data.get("emotional_pattern")))
                .replace("{{language_features}}",     self._fmt(tone_data.get("language_features")))
                .replace("{{expression_habits}}",     self._fmt(tone_data.get("expression_habits")))
                .replace("{{humor_style}}",           self._fmt(portrait_data.get("humor_style")))
                .replace("{{age_vibe}}",              self._fmt(portrait_data.get("age_vibe")))
                .replace("{{gender_style}}",          self._fmt(portrait_data.get("gender_style")))
                .replace("{{zodiac_style}}",          self._fmt(portrait_data.get("zodiac_style")))
                .replace("{{zodiac_animal_style}}",   self._fmt(portrait_data.get("zodiac_animal_style")))
                .replace("{{values_vibe}}",           self._fmt(portrait_data.get("values_vibe")))
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"AI 生成失败: {str(e)}")

        return {"prompt": final_prompt.strip(), "tokens": total_tokens}
