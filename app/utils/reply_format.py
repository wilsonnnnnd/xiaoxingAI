from typing import Optional
import re


def strip_reply_footer(
    *,
    content: str,
    signature: str,
    closing: Optional[str] = None,
) -> str:
    base = (content or "").strip()
    if not base:
        return ""

    def _split_lines(s: str) -> list[str]:
        return [ln.rstrip() for ln in s.replace("\r\n", "\n").replace("\r", "\n").split("\n")]

    def _trim_trailing_blank(lines: list[str]) -> list[str]:
        i = len(lines)
        while i > 0 and not lines[i - 1].strip():
            i -= 1
        return lines[:i]

    def _pop_suffix(lines: list[str], suffix: list[str]) -> tuple[list[str], bool]:
        if not suffix:
            return lines, False
        if len(lines) < len(suffix):
            return lines, False
        if lines[-len(suffix):] == suffix:
            return lines[:-len(suffix)], True
        return lines, False

    lines = _trim_trailing_blank(_split_lines(base))

    sig_lines = _trim_trailing_blank(_split_lines((signature or "").strip()))
    clo_lines = _trim_trailing_blank(_split_lines((closing or "").strip()))
    closing_re = re.compile(
        r"^(best regards|kind regards|regards|thanks|thank you|sincerely)\s*,?$",
        re.IGNORECASE,
    )
    closing_zh_re = re.compile(
        r"^(谢谢|谢谢你|多谢|感谢|此致|敬礼|祝好|顺颂商祺|敬上)[，。!！]*$"
    )

    changed = True
    while changed:
        changed = False
        lines = _trim_trailing_blank(lines)
        if sig_lines:
            lines, did = _pop_suffix(lines, sig_lines)
            changed = changed or did
        lines = _trim_trailing_blank(lines)
        if clo_lines:
            lines, did = _pop_suffix(lines, clo_lines)
            changed = changed or did

    while True:
        lines = _trim_trailing_blank(lines)
        if not lines:
            break
        last = lines[-1].strip()
        if closing_re.match(last) or closing_zh_re.match(last):
            lines = lines[:-1]
            continue
        break

    return "\n".join(_trim_trailing_blank(lines)).strip()


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
