import json
import re
from typing import Any, Dict, Optional


def extract_json_from_text(text: str) -> Dict[str, Any]:
    text = text.strip()

    # 1️⃣ 直接解析
    try:
        return json.loads(text)
    except Exception:
        pass

    # 2️⃣ 去掉 ```json ``` 包裹
    text = re.sub(r"```json", "", text, flags=re.IGNORECASE)
    text = re.sub(r"```", "", text)

    # 3️⃣ 找所有 JSON 块（非贪婪）
    matches = re.findall(r"\{.*?\}", text, re.DOTALL)

    for m in matches:
        try:
            return json.loads(m)
        except Exception:
            continue

    raise ValueError(f"无法解析JSON: {text}")



def _parse_schema_hint(schema_hint: str) -> Optional[Dict[str, Any]]:
    hint = (schema_hint or "").strip()
    if not hint:
        return None
    try:
        parsed = json.loads(hint)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        return None
    return None


def _apply_schema(obj: Any, schema_defaults: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(obj, dict):
        obj = {}

    out: Dict[str, Any] = {}
    for k, default in schema_defaults.items():
        v = obj.get(k, default)
        if isinstance(default, bool):
            if isinstance(v, bool):
                out[k] = v
            elif isinstance(v, str):
                s = v.strip().lower()
                if s in {"true", "1", "yes", "y"}:
                    out[k] = True
                elif s in {"false", "0", "no", "n"}:
                    out[k] = False
                else:
                    out[k] = default
            else:
                out[k] = default
            continue

        if isinstance(default, list):
            out[k] = v if isinstance(v, list) else default
            continue

        if isinstance(default, str):
            out[k] = str(v) if v is not None else default
            continue

        out[k] = v

    return out


def extract_json_with_repair(
    text: str,
    *,
    schema_hint: str = "",
    max_repair_tokens: int = 256,
    max_repair_input_chars: int = 4000,
) -> Dict[str, Any]:
    schema_defaults = _parse_schema_hint(schema_hint)
    try:
        parsed = extract_json_from_text(text)
        return _apply_schema(parsed, schema_defaults) if schema_defaults else parsed
    except Exception as original_err:
        raw = (text or "").strip()
        raw = raw[:max_repair_input_chars]

        hint = (schema_hint or "").strip()
        prompt = (
            "你是 JSON 修复器。\n"
            "将下面的文本转换为“单个合法 JSON 对象”。\n"
            "只输出 JSON 本身，不要任何解释、前缀、后缀、代码块或 Markdown。\n"
            "规则：\n"
            "1) 只保留原文本中已有的信息，禁止编造；缺失字段按 schema_hint 的默认值填充。\n"
            "2) 只允许输出 schema_hint 里出现的 key，其他 key 一律丢弃；必须输出 schema_hint 中的所有 key。\n"
            "2) key 必须使用双引号；不得有尾随逗号；必须是严格 JSON（不是 JSON5）。\n"
        )
        if hint:
            prompt += f"\nschema_hint（严格遵守字段与默认值）：\n{hint}\n"
        prompt += f"\n待修复文本：\n{raw}\n"

        try:
            from app.core.llm import call_llm
        except Exception:
            raise ValueError(f"无法解析JSON: {raw}") from original_err

        repaired, _ = call_llm(prompt, max_tokens=max_repair_tokens, use_cache=False)
        try:
            parsed = extract_json_from_text(repaired)
            return _apply_schema(parsed, schema_defaults) if schema_defaults else parsed
        except Exception as repair_err:
            raise ValueError(f"无法解析JSON: {raw}") from repair_err
