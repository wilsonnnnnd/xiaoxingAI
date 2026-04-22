from app.core.tools import register
from app.domains.gmail.tools.fetch_email import fetch_email as _fetch_email


@register(
    "fetch_email",
    "从 Gmail 拉取指定邮件并进行 AI 分析处理，返回邮件摘要",
    keywords=[
        "帮我看看",
        "拉取邮件",
        "查一下邮件",
        "fetch email",
        "拉一下",
        "有没有邮件",
        "帮我查邮件",
        "最新邮件",
        "新邮件",
        "未读邮件",
    ],
    takes_message=True,
    takes_user_id=True,
)
def fetch_email(message: str, user_id=None) -> str:
    return _fetch_email(message, user_id=user_id)
