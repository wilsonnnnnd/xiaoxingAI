from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
PROMPTS_DIR = BASE_DIR / "prompts"


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


def load_prompt(filename: str) -> str:
    """Load a prompt file from `app/prompts/`.

    Behavior:
    - sanitize `filename` (reject absolute or parent paths)
    - try `app/prompts/{filename}` first
    - if not found, try `app/prompts/gmail/{filename}` as a fallback
    - raise FileNotFoundError with the attempted path on failure
    """
    name = _sanitize_filename(filename)
    if not name:
        raise FileNotFoundError(f"Prompt file not specified: {filename}")

    prompt_path = PROMPTS_DIR / name
    if not prompt_path.exists():
        # fallback to gmail subfolder for built-in gmail prompts
        alt = PROMPTS_DIR / "gmail" / name
        if alt.exists():
            prompt_path = alt
        else:
            raise FileNotFoundError(f"Prompt file not found: {prompt_path}")

    return prompt_path.read_text(encoding="utf-8")