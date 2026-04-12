from typing import Optional


def apply_reply_format(
    *,
    content: str,
    body_template: Optional[str],
    signature: str,
    closing: Optional[str] = None,
) -> str:
    base = (content or "").strip()
    sig = (signature or "").strip()
    clo = (closing or "").strip() if closing is not None else ""

    tpl = (body_template or "").strip()
    if not tpl:
        if sig:
            return f"{base}\n\n{sig}".strip()
        return base

    out = tpl
    if "{{content}}" in out:
        out = out.replace("{{content}}", base)
    else:
        out = f"{out.rstrip()}\n\n{base}".strip()

    if clo:
        if "{{closing}}" in out:
            out = out.replace("{{closing}}", clo)
        else:
            out = f"{out.rstrip()}\n\n{clo}".strip()
    else:
        out = out.replace("{{closing}}", "")

    if "{{signature}}" in out:
        out = out.replace("{{signature}}", sig)
    else:
        if sig:
            out = f"{out.rstrip()}\n\n{sig}".strip()

    return out.strip()

