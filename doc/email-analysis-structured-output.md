# Email Analysis Structured Output Refactor

This document records the April 2026 refactor that changed Gmail email analysis from loose JSON-like parsing to strict structured output validation, and the follow-up changes that turned it into the basis for a more structured email processing workflow.

---

## Goal

The previous analysis flow accepted loosely formatted model output and attempted to repair it into JSON. That worked for many cases, but it made downstream behavior less predictable and made failures harder to reason about.

This refactor keeps the existing FastAPI route and Gmail pipeline structure, but changes the analysis step to:

- request strict JSON only
- validate against a shared Pydantic schema
- fall back to a safe default object instead of raising
- preserve backward compatibility where the rest of the pipeline still expects `action_needed`

---

## Changed Files

- `app/schemas/email_analysis.py`
- `app/schemas/__init__.py`
- `app/skills/gmail/pipeline.py`
- `app/prompts/gmail/email_analysis.txt`
- `tests/test_email_analysis_schema.py`

Follow-up files added around the same structured-processing direction:

- `app/workflows/email_processing_flow.py`
- `app/schemas/email_reply.py`
- `app/services/email_reply_generation_service.py`
- `app/schemas/email_automation_rule.py`
- `app/services/email_automation_rule_service.py`
- `app/api/routes/email_automation_rules.py`
- `app/api/routes/email_records.py`

---

## New Schema

The canonical schema is `EmailAnalysis` in `app/schemas/email_analysis.py`.

```python
class EmailAnalysis(BaseModel):
    category: Literal["job", "finance", "social", "spam", "other"] = "other"
    priority: Literal["high", "medium", "low"] = "low"
    summary: str = Field(default="", max_length=200)
    action: Literal["reply", "ignore", "archive", "notify", "review"] = "review"
    reason: str = ""
    deadline: Optional[str] = None
```

Field notes:

- `category` and `priority` are strict enums.
- `summary` is capped at 200 characters so it stays usable in inbox/debug list views.
- `action` replaces the older boolean-style action signal with an explicit intent.
- `deadline` is nullable because many emails do not include one.

---

## Runtime Flow

The main analysis entry point is still `analyze_email()` in `app/skills/gmail/pipeline.py`.

The updated behavior is:

1. Load the existing prompt from `app/prompts/gmail/email_analysis.txt`.
2. Append a final instruction that the model must return exactly one JSON object with the expected keys.
3. Parse the response with `json.loads()`.
4. Validate the parsed object with `EmailAnalysis`.
5. If parsing or validation fails, return a safe fallback object.

Unlike the summary step, the analysis step no longer uses JSON repair. This is intentional: analysis is now treated as a strict contract boundary.

---

## Fallback Behavior

If the model returns invalid JSON, a non-object payload, missing required structure, or invalid enum values, the pipeline does not crash. Instead it returns this safe fallback:

```json
{
  "category": "other",
  "priority": "low",
  "summary": "",
  "action": "review",
  "reason": "Structured output validation failed; review manually.",
  "deadline": null
}
```

At runtime the pipeline also derives:

```json
{
  "action_needed": true
}
```

This derived field is kept for compatibility with the existing summary and Telegram formatting flow.

Current mapping:

- `reply` -> `action_needed = true`
- `notify` -> `action_needed = true`
- `review` -> `action_needed = true`
- `ignore` -> `action_needed = false`
- `archive` -> `action_needed = false`

---

## Fallback Logging Metadata

Fallback context is recorded in logs via `logger.warning(..., extra=...)` in `app/skills/gmail/pipeline.py`.

Current metadata:

- `raw_response`: truncated raw model output, up to 4000 chars
- `validation_error`: parse or schema validation error string
- `used_fallback`: always `True` for this path

Important:

- these fields are logged for observability
- they are not returned to the API client
- this keeps the external response shape stable while still making failures debuggable

---

## Prompt Contract

The analysis prompt in `app/prompts/gmail/email_analysis.txt` was updated to match the new schema.

It now explicitly requires:

- JSON only
- exactly 6 keys
- one or two short English sentences for `summary`
- `summary` length <= 200 characters
- concise `reason`
- `deadline` copied from the email when present, otherwise `null`

This prompt-side constraint complements the schema validation. The model is asked to stay inside the contract, and the backend enforces it.

---

## Backward Compatibility

To avoid breaking the rest of the Gmail pipeline, this refactor does not change route names or the overall response envelope.

Compatibility choices:

- `/api/ai/analyze` still returns the same top-level shape from `analyze_email()`
- `process_email()` still returns `analysis`, `summary`, `telegram_message`, and `tokens`
- the summary prompt still receives `action_needed`
- Telegram formatting still relies on `summary.action_needed`

The new `action` field is now the canonical representation in analysis results, while `action_needed` remains a derived compatibility field during processing.

---

## What This Enabled Later

Once email analysis became a strict contract, the backend could safely build more predictable downstream features on top of it:

- a central `email_processing_flow` that orchestrates analysis, rule matching, actions, reply draft generation, and persistence
- persistent email automation rules matched by `category`, `priority`, or both
- structured reply draft generation when analysis recommends `action == "reply"`
- inbox-ready processed email APIs that expose stable summary/detail views instead of raw processing blobs

In other words, the analysis schema is no longer just a parsing improvement. It is now the contract that drives the current AI inbox behavior.

---

## Current Processed Email Shape

At persistence time, `email_records` now stores more than the early analysis/summary fields:

- `analysis_json`
- `summary_json`
- `final_status`
- `processed_at`
- `reply_drafts_json`
- `processing_result_json`

The inbox-oriented APIs then expose cleaner views derived from those fields:

- list view: summary, category, priority, suggested action, processing status, reply-draft availability
- detail view: original content, analysis, matched rules, executed actions, reply drafts

This keeps storage flexible while still giving the frontend a stable contract.

---

## Tests

Focused coverage was added in `tests/test_email_analysis_schema.py`.

Covered scenarios:

- valid structured JSON passes validation
- invalid/non-strict output falls back safely
- derived `action_needed` remains available after parsing

If stricter coverage is needed later, good next targets would be:

- overlong `summary` values
- invalid enum values
- nullable and non-null `deadline` cases
- end-to-end route-level tests for `/api/ai/analyze`

---

## Maintenance Notes

- If the analysis schema changes, update both the Pydantic model and `app/prompts/gmail/email_analysis.txt`.
- If downstream consumers are migrated away from `action_needed`, the compatibility bridge in `pipeline.py` can be removed.
- If raw LLM output should also be stored in persistent debug records later, reuse the current fallback logging metadata structure rather than changing the public API response first.
