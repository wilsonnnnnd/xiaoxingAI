from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from app import db
from app.core import redis_client as rc
from app.core.telegram.client import send_message
from app.services.email_automation_rule_service import EmailAutomationRuleService
from app.services.email_reply_generation_service import EmailReplyGenerationService
from app.skills.gmail.client import mark_as_read
from app.skills.gmail.pipeline import process_email

logger = logging.getLogger("email.workflow")
automation_rule_service = EmailAutomationRuleService()
email_reply_generation_service = EmailReplyGenerationService()


class EmailMatchedRule(BaseModel):
    rule: str
    detail: str = ""
    action: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class EmailExecutedAction(BaseModel):
    action: str
    success: bool
    optional: bool = False
    message: str = ""
    metadata: Dict[str, Any] = Field(default_factory=dict)


class EmailProcessingRunResult(BaseModel):
    email_id: str = ""
    subject: str = ""
    sender: str = ""
    date: str = ""
    has_attachments: bool = False
    attachment_count: int = 0
    attachment_names: List[str] = Field(default_factory=list)
    analysis: Dict[str, Any] = Field(default_factory=dict)
    summary: Dict[str, Any] = Field(default_factory=dict)
    telegram_message: str = ""
    reply_drafts: Dict[str, Any] = Field(default_factory=dict)
    tokens: int = 0
    matched_rules: List[Dict[str, Any]] = Field(default_factory=list)
    executed_actions: List[Dict[str, Any]] = Field(default_factory=list)
    final_status: Literal["processed", "processed_with_fallback", "partially_failed", "failed"] = "processed"
    processed_at: str
    sent_telegram: bool = False


def _model_dump(instance: BaseModel) -> Dict[str, Any]:
    if hasattr(instance, "model_dump"):
        return instance.model_dump()
    return instance.dict()


def _priority_level(priority: str) -> int:
    return {"low": 0, "medium": 1, "high": 2, "urgent": 3}.get(str(priority or "").strip().lower(), 0)


def _build_base_result(email: Dict[str, Any]) -> EmailProcessingRunResult:
    attachment_names = email.get("attachment_names") or []
    if not isinstance(attachment_names, list):
        attachment_names = []
    attachment_names = [str(x) for x in attachment_names if str(x)]
    attachment_count = int(email.get("attachment_count") or 0)
    if attachment_count <= 0:
        attachment_count = len(attachment_names)
    has_attachments = bool(email.get("has_attachments")) or bool(attachment_count) or bool(attachment_names)
    return EmailProcessingRunResult(
        email_id=str(email.get("id") or ""),
        subject=str(email.get("subject") or ""),
        sender=str(email.get("from") or ""),
        date=str(email.get("date") or ""),
        has_attachments=has_attachments,
        attachment_count=attachment_count,
        attachment_names=attachment_names,
        processed_at=datetime.now().isoformat(timespec="seconds"),
    )


def _append_rule(result: EmailProcessingRunResult, rule: str, detail: str) -> None:
    result.matched_rules.append(_model_dump(EmailMatchedRule(rule=rule, detail=detail)))


def _append_persistent_rule(result: EmailProcessingRunResult, rule_row: Dict[str, Any]) -> None:
    result.matched_rules.append(
        _model_dump(
            EmailMatchedRule(
                rule="persistent_automation_rule",
                detail="matched persistent email automation rule",
                action=str(rule_row.get("action") or ""),
                metadata={
                    "rule_id": rule_row.get("id"),
                    "category": rule_row.get("category"),
                    "priority": rule_row.get("priority"),
                    "enabled": bool(rule_row.get("enabled")),
                },
            )
        )
    )


def _append_action(
    result: EmailProcessingRunResult,
    action: str,
    success: bool,
    message: str = "",
    metadata: Optional[Dict[str, Any]] = None,
    optional: bool = False,
) -> None:
    result.executed_actions.append(
        _model_dump(
            EmailExecutedAction(
                action=action,
                success=success,
                optional=optional,
                message=message,
                metadata=dict(metadata or {}),
            )
        )
    )


def _finalize_status(result: EmailProcessingRunResult) -> None:
    failures = [
        x for x in result.executed_actions
        if not bool(x.get("success")) and not bool(x.get("optional"))
    ]
    successes = [x for x in result.executed_actions if bool(x.get("success"))]
    if failures and successes:
        result.final_status = "partially_failed"
    elif failures and not successes:
        result.final_status = "failed"
    elif result.analysis.get("used_fallback") or result.summary.get("used_fallback"):
        result.final_status = "processed_with_fallback"
    else:
        result.final_status = "processed"


def _run_ai_pipeline_with_retry(
    email: Dict[str, Any],
    *,
    user_id: int,
    max_retries: int,
) -> Dict[str, Any]:
    subject = str(email.get("subject") or "")
    last_err: Exception = RuntimeError("unknown email processing error")
    for attempt in range(max(1, int(max_retries))):
        try:
            return process_email(
                subject,
                str(email.get("body") or ""),
                snippet=str(email.get("snippet") or ""),
                sender=str(email.get("from") or ""),
                date=str(email.get("date") or ""),
                email_id=str(email.get("id") or ""),
                attachment_count=int(email.get("attachment_count") or 0),
                user_id=user_id,
            )
        except Exception as exc:
            last_err = exc
            if attempt >= max(1, int(max_retries)) - 1:
                break
            logger.warning(
                "email AI pipeline retry %d/%d failed for %s: %s",
                attempt + 1,
                max_retries,
                subject or "(no subject)",
                exc,
            )
    raise last_err


def run_email_processing_flow(
    email: Dict[str, Any],
    *,
    user_id: int,
    notify_bots: Optional[List[Dict[str, Any]]] = None,
    send_telegram_enabled: bool = False,
    mark_read_enabled: bool = False,
    persist_result: bool = True,
    min_priority: Optional[str] = None,
    notify_priorities: Optional[List[str]] = None,
    bind_notify_refs: bool = False,
    max_ai_retries: int = 1,
) -> Dict[str, Any]:
    result = _build_base_result(email)
    processed = _run_ai_pipeline_with_retry(email, user_id=user_id, max_retries=max_ai_retries)

    result.analysis = dict(processed.get("analysis") or {})
    result.summary = dict(processed.get("summary") or {})
    result.telegram_message = str(processed.get("telegram_message") or "")
    result.tokens = int(processed.get("tokens") or 0)
    if bool(processed.get("used_fallback")):
        result.analysis["used_fallback"] = True

    if result.has_attachments:
        names = [str(x) for x in (result.attachment_names or []) if str(x)]
        if names:
            note = f"\n\nAttachments detected: {', '.join(names)}. Attachment contents were not analyzed yet."
        else:
            count = int(result.attachment_count or 0)
            hint = f"{count} file(s)" if count > 0 else "attachment(s)"
            note = f"\n\nThis email includes {hint}. Attachment contents were not analyzed yet."
        result.telegram_message = (result.telegram_message or "").rstrip() + note

    priority = str(result.analysis.get("priority") or "low").strip().lower()
    matched_automation_rules = automation_rule_service.find_matching_rules(user_id=user_id, analysis=result.analysis)
    for matched_rule in matched_automation_rules:
        _append_persistent_rule(result, matched_rule)

    rule_actions = {str(rule.get("action") or "").strip().lower() for rule in matched_automation_rules}
    has_notify_rule = "notify" in rule_actions
    has_mark_read_rule = "mark_read" in rule_actions

    should_send_telegram = bool(send_telegram_enabled or has_notify_rule)
    should_mark_read = bool(mark_read_enabled or has_mark_read_rule)
    notify_bots = list(notify_bots or [])
    configured_notify_priorities = [str(x).strip().lower() for x in (notify_priorities or []) if str(x).strip()]

    if min_priority and not has_notify_rule:
        min_priority_value = str(min_priority).strip().lower()
        if _priority_level(priority) < _priority_level(min_priority_value):
            should_send_telegram = False
            _append_rule(
                result,
                "min_priority_filter",
                f"priority={priority or 'low'} below min_priority={min_priority_value}",
            )

    if configured_notify_priorities and priority not in configured_notify_priorities and not has_notify_rule:
        should_send_telegram = False
        _append_rule(
            result,
            "notify_priority_filter",
            f"priority={priority or 'low'} not in notify_priorities",
        )

    if send_telegram_enabled and not notify_bots:
        should_send_telegram = False
        _append_rule(result, "missing_notify_bots", "telegram sending requested but no notify bots are configured")

    if should_send_telegram:
        _append_rule(result, "telegram_delivery", f"send to {len(notify_bots)} notify bot(s)")
    elif send_telegram_enabled:
        _append_action(
            result,
            "notify",
            True,
            "Telegram notification skipped by workflow rules",
            {"channel": "telegram", "skipped": True},
        )

    if should_mark_read and result.email_id:
        _append_rule(result, "mark_read", "mark email as read after processing")
    elif should_mark_read:
        _append_action(
            result,
            "mark_as_read",
            True,
            "Mark-as-read skipped because email id is missing",
            {"skipped": True},
        )

    if persist_result and result.email_id:
        _append_rule(result, "persist_record", "save processing result to email_records")
    elif persist_result:
        _append_action(
            result,
            "persist_record",
            True,
            "Persistence skipped because email id is missing",
            {"skipped": True},
        )

    if str(result.analysis.get("action") or "").strip().lower() == "reply":
        _append_rule(result, "generate_reply_drafts", "generate structured reply draft options")
        try:
            reply_result = email_reply_generation_service.generate_reply_drafts(
                subject=result.subject,
                content=str(email.get("body") or email.get("snippet") or ""),
                sender_name=result.sender,
                user_style_preference=None,
                user_id=user_id,
            )
            result.reply_drafts = dict(reply_result.get("reply_drafts") or {})
            result.tokens += int(reply_result.get("tokens") or 0)
            _append_action(
                result,
                "generate_reply_drafts",
                True,
                "Reply draft options generated",
                {"option_count": len(result.reply_drafts.get("options") or [])},
            )
        except Exception as exc:
            logger.warning("reply draft generation failed for %s: %s", result.email_id, exc)
            metadata = {"error": str(exc)}
            if hasattr(exc, "validation_error"):
                metadata["validation_error"] = str(getattr(exc, "validation_error") or "")
            if hasattr(exc, "raw_response"):
                metadata["raw_response"] = str(getattr(exc, "raw_response") or "")
            _append_action(
                result,
                "generate_reply_drafts",
                False,
                optional=True,
                message=str(exc) or "Failed to generate reply draft options",
                metadata=metadata,
            )

    if should_send_telegram:
        successful_sends = 0
        for bot in notify_bots:
            bot_id = int(bot.get("id") or 0)
            chat_id = str(bot.get("chat_id") or "")
            token = str(bot.get("token") or "")
            try:
                resp = send_message(result.telegram_message, chat_id=chat_id, parse_mode="HTML", token=token)
                successful_sends += 1
                _append_action(
                    result,
                    "notify",
                    True,
                    "Telegram notification sent",
                    {"channel": "telegram", "bot_id": bot_id or None, "chat_id": chat_id},
                )
                if bind_notify_refs:
                    msg_id = int(resp.get("result", {}).get("message_id") or 0)
                    if msg_id:
                        rc.set_email_notify_ref(
                            bot_id=bot_id,
                            message_id=msg_id,
                            user_id=int(user_id),
                            email_id=result.email_id,
                        )
                        rc.set_tg_message_cache(
                            bot_id=bot_id,
                            chat_id=chat_id,
                            message_id=msg_id,
                            payload={
                                "type": "sent",
                                "bot_id": bot_id,
                                "chat_id": chat_id,
                                "message_id": msg_id,
                                "email_id": result.email_id,
                                "text": result.telegram_message[:2000],
                            },
                        )
            except Exception as exc:
                logger.warning("telegram send failed for email %s bot %s: %s", result.email_id, bot_id or "?", exc)
                _append_action(
                    result,
                    "notify",
                    False,
                    "Telegram notification failed",
                    {"channel": "telegram", "bot_id": bot_id or None, "chat_id": chat_id, "error": str(exc)},
                )
        result.sent_telegram = successful_sends > 0

    if should_mark_read and result.email_id:
        try:
            mark_as_read(result.email_id, user_id=user_id)
            _append_action(
                result,
                "mark_as_read",
                True,
                "Email marked as read",
                {"email_id": result.email_id},
            )
        except Exception as exc:
            logger.warning("mark_as_read failed for %s: %s", result.email_id, exc)
            _append_action(
                result,
                "mark_as_read",
                False,
                "Failed to mark email as read",
                {"email_id": result.email_id, "error": str(exc)},
            )

    _finalize_status(result)
    result_payload = _model_dump(result)

    if persist_result and result.email_id:
        try:
            db.save_email_record(
                email_id=result.email_id,
                subject=result.subject,
                sender=result.sender,
                date=result.date,
                body=str(email.get("body") or email.get("snippet") or ""),
                analysis=result.analysis,
                summary=result.summary,
                telegram_msg=result.telegram_message,
                tokens=result.tokens,
                priority=priority,
                sent_telegram=result.sent_telegram,
                final_status=result.final_status,
                processed_at=result.processed_at,
                reply_drafts=result.reply_drafts,
                processing_result=result_payload,
                user_id=user_id,
            )
            _append_action(
                result,
                "persist_record",
                True,
                "Processing result persisted",
                {"email_id": result.email_id},
            )
            result_payload = _model_dump(result)
            db.save_email_record(
                email_id=result.email_id,
                subject=result.subject,
                sender=result.sender,
                date=result.date,
                body=str(email.get("body") or email.get("snippet") or ""),
                analysis=result.analysis,
                summary=result.summary,
                telegram_msg=result.telegram_message,
                tokens=result.tokens,
                priority=priority,
                sent_telegram=result.sent_telegram,
                final_status=result.final_status,
                processed_at=result.processed_at,
                reply_drafts=result.reply_drafts,
                processing_result=result_payload,
                user_id=user_id,
            )
        except Exception as exc:
            logger.warning("email record persistence failed for %s: %s", result.email_id, exc)
            _append_action(
                result,
                "persist_record",
                False,
                "Failed to persist processing result",
                {"email_id": result.email_id, "error": str(exc)},
            )
            _finalize_status(result)

    return _model_dump(result)
