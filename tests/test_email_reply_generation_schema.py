from app.schemas import EmailReplyDrafts


def test_email_reply_drafts_schema_accepts_three_unique_tones():
    payload = {
        "options": [
            {"label": "Formal Reply", "tone": "formal", "content": "Hello,\n\nThank you for your email."},
            {"label": "Friendly Reply", "tone": "friendly", "content": "Hi,\n\nThanks for reaching out."},
            {"label": "Concise Reply", "tone": "concise", "content": "Hi,\n\nThanks. I will review this and get back to you."},
        ],
        "style_preference": "polite and direct",
    }

    model = EmailReplyDrafts.model_validate(payload) if hasattr(EmailReplyDrafts, "model_validate") else EmailReplyDrafts.parse_obj(payload)

    assert len(model.options) == 3
    assert [item.tone for item in model.options] == ["formal", "friendly", "concise"]


def test_email_reply_drafts_schema_rejects_duplicate_tones():
    payload = {
        "options": [
            {"label": "Formal Reply", "tone": "formal", "content": "Hello,\n\nThank you for your email."},
            {"label": "Another Formal", "tone": "formal", "content": "Hello,\n\nI appreciate the note."},
        ],
        "style_preference": None,
    }

    try:
        if hasattr(EmailReplyDrafts, "model_validate"):
            EmailReplyDrafts.model_validate(payload)
        else:
            EmailReplyDrafts.parse_obj(payload)
    except Exception as exc:
        assert "unique" in str(exc).lower()
        return

    raise AssertionError("expected duplicate tones to fail validation")
