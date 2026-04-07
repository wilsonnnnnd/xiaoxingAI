import json
import re
from typing import Any, Dict


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