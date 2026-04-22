from app.domains.gmail.pipeline import _parse_email_analysis


def test_parse_email_analysis_valid_json():
    raw = (
        '{"category":"job","priority":"high","summary":"Interview invitation next Tuesday.",'
        '"action":"reply","reason":"Sender requested confirmation.",'
        '"deadline":"next Tuesday at 10:00 AM"}'
    )

    out, used_fallback = _parse_email_analysis(raw)

    assert out["category"] == "job"
    assert out["priority"] == "high"
    assert out["action"] == "reply"
    assert out["reason"] == "Sender requested confirmation."
    assert out["deadline"] == "next Tuesday at 10:00 AM"
    assert out["action_needed"] is True
    assert used_fallback is False


def test_parse_email_analysis_invalid_json_uses_safe_fallback():
    out, used_fallback = _parse_email_analysis("```json\n{\"category\":\"job\"}\n```")

    assert out["category"] == "other"
    assert out["priority"] == "low"
    assert out["summary"] == ""
    assert out["action"] == "review"
    assert out["deadline"] is None
    assert out["action_needed"] is True
    assert used_fallback is True
