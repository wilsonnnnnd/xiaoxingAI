from __future__ import annotations

from app import db
from app.core.step_log import write_step_log
from app.core.telegram.client import send_message


def notify_admin_new_user(*, user: dict) -> None:
    uid = user.get("id")
    email = str(user.get("email") or "")
    display_name = str(user.get("display_name") or "")

    msg = (
        "🆕 新用户注册\n"
        f"- id: {uid}\n"
        f"- email: {email}\n"
        f"- name: {display_name or '（无）'}\n"
        "\n"
        "需要管理员授权开启邮箱助手：请到「Users」页面将该用户的 Worker Enabled 打开。"
    )

    sent = 0
    try:
        admins = db.list_admin_users()
    except Exception:
        admins = []

    for a in admins:
        admin_id = a.get("id")
        if admin_id is None:
            continue
        try:
            bots = db.get_notify_bots(int(admin_id))
        except Exception:
            bots = []
        for b in bots:
            try:
                send_message(
                    msg,
                    token=str(b.get("token") or ""),
                    chat_id=str(b.get("chat_id") or ""),
                    parse_mode=None,
                )
                sent += 1
            except Exception:
                continue

    write_step_log(
        msg=f"[register] new user id={uid} email={email} notify_sent={sent}",
        level="info",
        tokens=0,
        user_id=None,
        log_type=db.LogType.EMAIL,
    )

