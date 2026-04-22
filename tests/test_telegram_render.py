from app.domains.gmail.telegram_format import render_telegram_message


def test_write_telegram_message_english():
    summary = {
        "category": "finance",
        "priority": "high",
        "summary": "Invoice due tomorrow",
        "key_points": ["Pay invoice", "Check amount"],
        "action_needed": True,
        "sender": "Billing",
        "date": "2026-01-01",
    }
    msg = render_telegram_message(subject="Test", summary=summary, sender="Sender", date="Date", notify_lang="en")
    assert "New Email" in msg
    assert "Finance" in msg
    assert "High" in msg
