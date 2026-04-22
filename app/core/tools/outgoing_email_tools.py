from app.core.tools import register
from app.domains.outgoing.tools.email_tools import (
    outgoing_draft_cancel as _outgoing_draft_cancel,
    outgoing_draft_confirm as _outgoing_draft_confirm,
    outgoing_draft_modify as _outgoing_draft_modify,
    reply_email as _reply_email,
)


@register(
    "reply_email",
    "根据用户回复意图，为指定收件邮件生成回复草稿并发送预览",
    keywords=["回复邮件", "回邮件", "回复这封", "reply email", "回复"],
    takes_message=True,
    takes_user_id=True,
)
def reply_email(message: str, user_id: int | None = None) -> str:
    return _reply_email(message, user_id=user_id)


@register(
    "outgoing_draft_confirm",
    "确认并发送指定 draft（需带 __draft_id__ 上下文）",
    keywords=["确认", "发送", "confirm"],
    takes_message=True,
    takes_user_id=True,
)
def outgoing_draft_confirm(message: str, user_id: int | None = None) -> str:
    return _outgoing_draft_confirm(message, user_id=user_id)


@register(
    "outgoing_draft_cancel",
    "取消指定 draft（需带 __draft_id__ 上下文）",
    keywords=["取消", "不发", "cancel"],
    takes_message=True,
    takes_user_id=True,
)
def outgoing_draft_cancel(message: str, user_id: int | None = None) -> str:
    return _outgoing_draft_cancel(message, user_id=user_id)


@register(
    "outgoing_draft_modify",
    "根据用户修改指令重写指定 draft（需带 __draft_id__ 上下文）",
    keywords=["修改", "改一下", "补充", "调整", "重写", "rewrite"],
    takes_message=True,
    takes_user_id=True,
)
def outgoing_draft_modify(message: str, user_id: int | None = None) -> str:
    return _outgoing_draft_modify(message, user_id=user_id)
