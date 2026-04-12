from app import db


def resolve_sender_name(*, user_id: int) -> str:
    row = db.get_user_by_id(int(user_id))
    if row:
        name = (row.get("display_name") or "").strip()
        if name:
            return name
        email = (row.get("email") or "").strip()
        if "@" in email:
            return email.split("@", 1)[0]
    return ""


def fill_sender_name(text: str, *, sender_name: str) -> str:
    if not text:
        return text
    name = (sender_name or "").strip()
    if not name:
        return text
    return text.replace("{{sender_name}}", name)

