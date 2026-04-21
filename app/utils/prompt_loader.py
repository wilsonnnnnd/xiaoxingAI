from pathlib import Path
from typing import Optional
import re


BASE_DIR = Path(__file__).resolve().parent.parent
PROMPTS_DIR = BASE_DIR / "prompts"

_SYSTEM_PROMPT_TYPE_BY_PATH = {
    "gmail/email_analysis.txt": "email_analysis",
    "gmail/email_summary.txt": "email_summary",
    "gmail/telegram_notify.txt": "telegram_notify",
    "gmail/telegram_notify.en.txt": "telegram_notify_en",
    "outgoing/email_compose.txt": "outgoing_email",
    "outgoing/email_edit.txt": "email_edit",
    "outgoing/email_reply_compose.txt": "email_reply_compose",
    "outgoing/email_reply_drafts.txt": "email_reply_drafts",
}

_LOCALIZED_PROMPTS = {"gmail/telegram_notify.txt"}

_PLACEHOLDER_RE = re.compile(r"\{[a-zA-Z_][a-zA-Z0-9_]*\}")


def _make_format_safe(template: str) -> str:
    if not template or ("{" not in template and "}" not in template):
        return template

    s = template
    l_sentinel = "\u0000LBRACE\u0000"
    r_sentinel = "\u0000RBRACE\u0000"
    s = s.replace("{{", l_sentinel).replace("}}", r_sentinel)

    placeholders = {}

    def _ph(m: re.Match) -> str:
        k = f"\u0000PH{len(placeholders)}\u0000"
        placeholders[k] = m.group(0)
        return k

    s = _PLACEHOLDER_RE.sub(_ph, s)

    s = s.replace("{", "{{").replace("}", "}}")

    for k, v in placeholders.items():
        s = s.replace(k, v)

    s = s.replace(l_sentinel, "{{").replace(r_sentinel, "}}")
    return s


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


def _localized_variant(name: str, notify_lang: str) -> str:
    if name not in _LOCALIZED_PROMPTS:
        return ""
    l = (notify_lang or "").strip().lower()
    if l == "en":
        if name.endswith(".txt"):
            return name[:-4] + ".en.txt"
    return ""


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
        notify_lang = ""
        if user_id is not None:
            try:
                with db._cur() as cur:
                    try:
                        cur.execute("SELECT notify_lang FROM user_settings WHERE user_id = %s", (int(user_id),))
                        row = cur.fetchone()
                        notify_lang = str(row[0] or "") if row else ""
                    except Exception:
                        cur.execute("SELECT ui_lang FROM user_settings WHERE user_id = %s", (int(user_id),))
                        row = cur.fetchone()
                        notify_lang = str(row[0] or "") if row else ""
            except Exception:
                notify_lang = ""

        if notify_lang:
            enriched: list[str] = []
            for cand in candidates:
                v = _localized_variant(cand, notify_lang)
                if v:
                    enriched.append(v)
                enriched.append(cand)
            candidates = enriched

        for cand in candidates:
            if user_id is not None:
                try:
                    override = db.get_user_prompt(user_id, cand)
                    if override is not None:
                        return _make_format_safe(str(override))
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
                            return _make_format_safe(str(row[0]))
            except Exception:
                pass

    for cand in candidates:
        prompt_path = PROMPTS_DIR / cand
        if prompt_path.exists():
            return _make_format_safe(prompt_path.read_text(encoding="utf-8"))

    raise FileNotFoundError(f"Prompt file not found: {PROMPTS_DIR / name}")
