from pathlib import Path
from typing import Optional


BASE_DIR = Path(__file__).resolve().parent.parent
PROMPTS_DIR = BASE_DIR / "prompts"

_SYSTEM_PROMPT_TYPE_BY_PATH = {
    "gmail/email_analysis.txt": "email_analysis",
    "gmail/email_summary.txt": "email_summary",
    "gmail/telegram_notify.txt": "telegram_notify",
    "outgoing/email_compose.txt": "outgoing_email",
    "outgoing/email_edit.txt": "email_edit",
    "outgoing/email_reply_compose.txt": "email_reply_compose",
}


def _sanitize_filename(filename: str) -> str:
    """Normalize a filename from user/config input.
    - strip whitespace and trailing/leading slashes
    - reject absolute paths or parent traversal
    Returns a safe relative path string.
    """
    if not filename:
        return ""
    s = filename.strip().strip("/\\")
    p = Path(s)
    if p.is_absolute() or ".." in p.parts:
        raise ValueError("Invalid prompt filename")
    return s


def load_prompt(filename: str, user_id: Optional[int] = None) -> str:
    """Load a prompt file from `app/prompts/`.

    Behavior:
    - sanitize `filename` (reject absolute or parent paths)
    - try DB override (user_prompts -> system_prompts) first
    - fallback to `app/prompts/{filename}` on disk
    - if not found, try `app/prompts/gmail/{filename}` as a fallback
    - raise FileNotFoundError with the attempted path on failure
    """
    name = _sanitize_filename(filename)
    if not name:
        raise FileNotFoundError(f"Prompt file not specified: {filename}")

    candidates = [name]
    if "/" not in name:
        candidates.append(f"gmail/{name}")

    try:
        from app import db
    except Exception:
        db = None

    if db is not None:
        for cand in candidates:
            if user_id is not None:
                try:
                    override = db.get_user_prompt(user_id, cand)
                    if override is not None:
                        return override
                except Exception:
                    pass

            try:
                types = [cand, _SYSTEM_PROMPT_TYPE_BY_PATH.get(cand)]
                types = [t for t in types if t]
                with db._cur() as cur:
                    for t in types:
                        cur.execute(
                            "SELECT content FROM system_prompts"
                            " WHERE type = %s ORDER BY updated_at DESC, id DESC LIMIT 1",
                            (t,),
                        )
                        row = cur.fetchone()
                        if row and row[0]:
                            return row[0]
            except Exception:
                pass

    for cand in candidates:
        prompt_path = PROMPTS_DIR / cand
        if prompt_path.exists():
            return prompt_path.read_text(encoding="utf-8")

    raise FileNotFoundError(f"Prompt file not found: {PROMPTS_DIR / name}")
