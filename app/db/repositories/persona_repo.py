from typing import Dict
from ..session import _cur

def get_persona_configs() -> Dict[str, Dict[str, str]]:
    """Return all persona config prompts grouped by category (zodiac / chinese_zodiac / gender)."""
    with _cur() as cur:
        cur.execute(
            "SELECT name, content FROM system_prompts"
            " WHERE type = 'persona_config'"
        )
        rows = cur.fetchall()
    result: Dict[str, Dict[str, str]] = {"zodiac": {}, "chinese_zodiac": {}, "gender": {}}
    for name, content in rows:
        if ":" in name:
            cat, key = name.split(":", 1)
            if cat in result:
                result[cat][key] = content
    return result

def upsert_persona_config(category: str, key: str, content: str) -> None:
    """Save a persona config prompt in system_prompts. Update if exists, else insert."""
    name = f"{category}:{key}"
    with _cur() as cur:
        cur.execute(
            "UPDATE system_prompts SET content = %s, updated_at = NOW()"
            " WHERE type = 'persona_config' AND name = %s",
            (content, name),
        )
        if cur.rowcount == 0:
            cur.execute(
                "INSERT INTO system_prompts (name, type, content, is_default)"
                " VALUES (%s, 'persona_config', %s, FALSE)",
                (name, content),
            )
