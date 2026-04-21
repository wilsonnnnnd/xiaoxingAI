from typing import Any, Dict, List, Optional

from ..session import _cur

_SUPPORTED_ACTIONS = {"notify", "mark_read"}


def _normalize_str(value: Optional[str]) -> Optional[str]:
    s = str(value or "").strip().lower()
    return s or None


def _normalize_action(action: str) -> str:
    normalized = str(action or "").strip().lower()
    if normalized not in _SUPPORTED_ACTIONS:
        raise ValueError("invalid automation rule action")
    return normalized


def _row_to_email_automation_rule(r: tuple) -> Dict[str, Any]:
    return {
        "id": r[0],
        "user_id": r[1],
        "category": r[2],
        "priority": r[3],
        "action": r[4],
        "enabled": bool(r[5]),
        "created_at": str(r[6]),
        "updated_at": str(r[7]),
    }


def create_email_automation_rule(
    *,
    user_id: int,
    category: Optional[str],
    priority: Optional[str],
    action: str,
    enabled: bool = True,
) -> Dict[str, Any]:
    with _cur() as cur:
        cur.execute(
            """INSERT INTO email_automation_rules (user_id, category, priority, action, enabled)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING id, user_id, category, priority, action, enabled, created_at, updated_at""",
            (int(user_id), _normalize_str(category), _normalize_str(priority), _normalize_action(action), bool(enabled)),
        )
        return _row_to_email_automation_rule(cur.fetchone())


def list_email_automation_rules(user_id: int) -> List[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            """SELECT id, user_id, category, priority, action, enabled, created_at, updated_at
               FROM email_automation_rules
               WHERE user_id = %s
               ORDER BY updated_at DESC, id DESC""",
            (int(user_id),),
        )
        return [_row_to_email_automation_rule(r) for r in cur.fetchall()]


def set_email_automation_rule_enabled(rule_id: int, user_id: int, enabled: bool) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            """UPDATE email_automation_rules
                  SET enabled = %s, updated_at = NOW()
                WHERE id = %s AND user_id = %s
            RETURNING id, user_id, category, priority, action, enabled, created_at, updated_at""",
            (bool(enabled), int(rule_id), int(user_id)),
        )
        row = cur.fetchone()
        return _row_to_email_automation_rule(row) if row else None


def update_email_automation_rule(
    *,
    rule_id: int,
    user_id: int,
    category: Optional[str],
    priority: Optional[str],
    action: str,
    enabled: bool,
) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            """UPDATE email_automation_rules
                  SET category = %s,
                      priority = %s,
                      action = %s,
                      enabled = %s,
                      updated_at = NOW()
                WHERE id = %s AND user_id = %s
            RETURNING id, user_id, category, priority, action, enabled, created_at, updated_at""",
            (
                _normalize_str(category),
                _normalize_str(priority),
                _normalize_action(action),
                bool(enabled),
                int(rule_id),
                int(user_id),
            ),
        )
        row = cur.fetchone()
        return _row_to_email_automation_rule(row) if row else None


def delete_email_automation_rule(rule_id: int, user_id: int) -> bool:
    with _cur() as cur:
        cur.execute(
            "DELETE FROM email_automation_rules WHERE id = %s AND user_id = %s RETURNING id",
            (int(rule_id), int(user_id)),
        )
        return cur.fetchone() is not None


def get_email_automation_rule(rule_id: int, user_id: int) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            """SELECT id, user_id, category, priority, action, enabled, created_at, updated_at
               FROM email_automation_rules
               WHERE id = %s AND user_id = %s""",
            (int(rule_id), int(user_id)),
        )
        row = cur.fetchone()
        return _row_to_email_automation_rule(row) if row else None


def find_duplicate_email_automation_rule(
    *,
    user_id: int,
    category: Optional[str],
    priority: Optional[str],
    action: str,
    exclude_rule_id: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    with _cur() as cur:
        params: List[Any] = [int(user_id), _normalize_str(category), _normalize_str(priority), _normalize_action(action)]
        extra_where = ""
        if exclude_rule_id is not None:
            extra_where = " AND id <> %s"
            params.append(int(exclude_rule_id))
        cur.execute(
            f"""SELECT id, user_id, category, priority, action, enabled, created_at, updated_at
                  FROM email_automation_rules
                 WHERE user_id = %s
                   AND category IS NOT DISTINCT FROM %s
                   AND priority IS NOT DISTINCT FROM %s
                   AND action = %s{extra_where}
                 LIMIT 1""",
            params,
        )
        row = cur.fetchone()
        return _row_to_email_automation_rule(row) if row else None


def find_matching_email_automation_rules(
    *,
    user_id: int,
    category: Optional[str] = None,
    priority: Optional[str] = None,
) -> List[Dict[str, Any]]:
    with _cur() as cur:
        cur.execute(
            """SELECT id, user_id, category, priority, action, enabled, created_at, updated_at
               FROM email_automation_rules
               WHERE user_id = %s
                 AND enabled = TRUE
                 AND (category IS NOT NULL OR priority IS NOT NULL)
                 AND (category IS NULL OR category = %s)
                 AND (priority IS NULL OR priority = %s)
               ORDER BY
                   CASE
                       WHEN category IS NOT NULL AND priority IS NOT NULL THEN 0
                       WHEN category IS NOT NULL THEN 1
                       ELSE 2
                   END ASC,
                   id ASC""",
            (int(user_id), _normalize_str(category), _normalize_str(priority)),
        )
        return [_row_to_email_automation_rule(r) for r in cur.fetchall()]


def count_enabled_email_automation_rules(user_id: int) -> int:
    with _cur() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM email_automation_rules WHERE user_id = %s AND enabled = TRUE",
            (int(user_id),),
        )
        return int(cur.fetchone()[0] or 0)
