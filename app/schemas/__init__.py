from .auth import AdminLoginRequest, ChangePasswordRequest, RegisterRequest
from .user import UserCreate, UserUpdate
from .bot import BotCreate, BotUpdate
from .email_analysis import EmailAnalysis
from .email_reply import EmailReplyDrafts, EmailReplyOption
from .processed_email import (
    ProcessedEmailDetail,
    ProcessedEmailListItem,
    ProcessedEmailListResponse,
    ProcessedEmailStats,
)
from .email_automation_rule import (
    EmailAutomationRule,
    EmailAutomationRuleCreate,
    EmailAutomationRuleUpdate,
)
from .prompt import PromptCreate, PromptUpdate
from .outgoing_email import OutgoingComposeRequest, OutgoingComposeResponse
from .reply_format import (
    ReplyTemplate,
    ReplyTemplateCreate,
    ReplyTemplateUpdate,
    ReplyFormatUpdate,
    ReplyFormatState,
)
from .invite import InviteCreateRequest
