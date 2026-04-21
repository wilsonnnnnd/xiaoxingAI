from fastapi import APIRouter, Depends

from app.core import auth as auth_mod
from app.schemas import EmailAutomationRuleCreate, EmailAutomationRuleUpdate
from app.services.email_automation_rule_service import EmailAutomationRuleService

router = APIRouter()
service = EmailAutomationRuleService()


@router.get("/users/{user_id}/email-automation-rules")
def email_automation_rules_list(user_id: int, user: dict = Depends(auth_mod.current_user)):
    auth_mod.assert_self_or_admin(user, user_id)
    return {"rules": service.list_rules(user_id=int(user_id))}


@router.post("/users/{user_id}/email-automation-rules", status_code=201)
def email_automation_rules_create(
    user_id: int,
    payload: EmailAutomationRuleCreate,
    user: dict = Depends(auth_mod.current_user),
):
    auth_mod.assert_self_or_admin(user, user_id)
    row = service.create_rule(
        user_id=int(user_id),
        category=payload.category,
        priority=payload.priority,
        action=payload.action,
        enabled=payload.enabled,
    )
    return row


@router.patch("/users/{user_id}/email-automation-rules/{rule_id}")
def email_automation_rules_set_enabled(
    user_id: int,
    rule_id: int,
    payload: EmailAutomationRuleUpdate,
    user: dict = Depends(auth_mod.current_user),
):
    auth_mod.assert_self_or_admin(user, user_id)
    return service.update_rule(
        rule_id=int(rule_id),
        user_id=int(user_id),
        updates=payload.model_dump(exclude_unset=True),
    )


@router.delete("/users/{user_id}/email-automation-rules/{rule_id}")
def email_automation_rules_delete(
    user_id: int,
    rule_id: int,
    user: dict = Depends(auth_mod.current_user),
):
    auth_mod.assert_self_or_admin(user, user_id)
    service.delete_rule(rule_id=int(rule_id), user_id=int(user_id))
    return {"ok": True}
