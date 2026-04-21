from typing import Dict, List, Optional

from fastapi import HTTPException

from app import db


SUPPORTED_EMAIL_AUTOMATION_ACTIONS = {"notify", "mark_read"}
SUPPORTED_EMAIL_RULE_CATEGORIES = {"job", "finance", "social", "spam", "other"}
SUPPORTED_EMAIL_RULE_PRIORITIES = {"high", "medium", "low"}


def _normalize_optional(value: Optional[str]) -> Optional[str]:
    s = str(value or "").strip().lower()
    return s or None


def _validate_rule_inputs(*, category: Optional[str], priority: Optional[str], action: str) -> tuple[Optional[str], Optional[str], str]:
    normalized_category = _normalize_optional(category)
    normalized_priority = _normalize_optional(priority)
    normalized_action = _normalize_optional(action)

    if normalized_category is None and normalized_priority is None:
        raise HTTPException(status_code=422, detail="At least one of category or priority is required")
    if normalized_category is not None and normalized_category not in SUPPORTED_EMAIL_RULE_CATEGORIES:
        raise HTTPException(status_code=422, detail="Invalid category")
    if normalized_priority is not None and normalized_priority not in SUPPORTED_EMAIL_RULE_PRIORITIES:
        raise HTTPException(status_code=422, detail="Invalid priority")
    if normalized_action not in SUPPORTED_EMAIL_AUTOMATION_ACTIONS:
        raise HTTPException(status_code=422, detail="Invalid action")
    return normalized_category, normalized_priority, str(normalized_action)


class EmailAutomationRuleService:
    def create_rule(
        self,
        *,
        user_id: int,
        category: Optional[str],
        priority: Optional[str],
        action: str,
        enabled: bool = True,
    ) -> Dict:
        category, priority, action = _validate_rule_inputs(category=category, priority=priority, action=action)
        duplicate = db.find_duplicate_email_automation_rule(
            user_id=int(user_id),
            category=category,
            priority=priority,
            action=action,
        )
        if duplicate:
            raise HTTPException(status_code=409, detail="Duplicate automation rule")
        return db.create_email_automation_rule(
            user_id=int(user_id),
            category=category,
            priority=priority,
            action=action,
            enabled=bool(enabled),
        )

    def list_rules(self, *, user_id: int) -> List[Dict]:
        return db.list_email_automation_rules(int(user_id))

    def update_rule(self, *, rule_id: int, user_id: int, updates: Dict) -> Dict:
        existing = db.get_email_automation_rule(int(rule_id), int(user_id))
        if not existing:
            raise HTTPException(status_code=404, detail="Automation rule not found")

        next_category = existing.get("category") if "category" not in updates else _normalize_optional(updates.get("category"))
        next_priority = existing.get("priority") if "priority" not in updates else _normalize_optional(updates.get("priority"))
        next_action = existing.get("action") if "action" not in updates else str(updates.get("action"))
        next_enabled = bool(existing.get("enabled")) if "enabled" not in updates else bool(updates.get("enabled"))

        next_category, next_priority, next_action = _validate_rule_inputs(
            category=next_category,
            priority=next_priority,
            action=next_action,
        )
        duplicate = db.find_duplicate_email_automation_rule(
            user_id=int(user_id),
            category=next_category,
            priority=next_priority,
            action=next_action,
            exclude_rule_id=int(rule_id),
        )
        if duplicate:
            raise HTTPException(status_code=409, detail="Duplicate automation rule")

        row = db.update_email_automation_rule(
            rule_id=int(rule_id),
            user_id=int(user_id),
            category=next_category,
            priority=next_priority,
            action=next_action,
            enabled=next_enabled,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Automation rule not found")
        return row

    def delete_rule(self, *, rule_id: int, user_id: int) -> None:
        ok = db.delete_email_automation_rule(int(rule_id), int(user_id))
        if not ok:
            raise HTTPException(status_code=404, detail="Automation rule not found")

    def find_matching_rules(self, *, user_id: int, analysis: Dict) -> List[Dict]:
        category = _normalize_optional((analysis or {}).get("category"))
        priority = _normalize_optional((analysis or {}).get("priority"))
        return db.find_matching_email_automation_rules(
            user_id=int(user_id),
            category=category,
            priority=priority,
        )
