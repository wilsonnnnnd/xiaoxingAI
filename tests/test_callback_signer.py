import os
import unittest
from datetime import datetime, timedelta, timezone


class TestCallbackSigner(unittest.TestCase):
    def setUp(self) -> None:
        os.environ["TELEGRAM_CALLBACK_SECRET"] = "test-secret"

    def test_build_parse_verify(self) -> None:
        from app.utils.callback_signer import build_callback_data, parse_callback_data, verify_callback_data

        expires_at = datetime.now(tz=timezone.utc) + timedelta(minutes=30)
        data = build_callback_data(
            action="c",
            draft_id=123,
            expires_at=expires_at,
            nonce="abc123",
            user_id=7,
            chat_id="-100",
            bot_id=9,
        )
        parsed = parse_callback_data(data)
        self.assertEqual(parsed.draft_id, 123)
        self.assertEqual(parsed.action, "c")
        self.assertTrue(
            verify_callback_data(
                parsed=parsed,
                user_id=7,
                chat_id="-100",
                bot_id=9,
                expires_at=expires_at,
            )
        )

    def test_verify_expired_fails(self) -> None:
        from app.utils.callback_signer import build_callback_data, parse_callback_data, verify_callback_data

        expires_at = datetime.now(tz=timezone.utc) + timedelta(minutes=1)
        data = build_callback_data(
            action="c",
            draft_id=1,
            expires_at=expires_at,
            nonce="abc123",
            user_id=7,
            chat_id="-100",
            bot_id=9,
        )
        parsed = parse_callback_data(data)
        now = expires_at + timedelta(minutes=2)
        self.assertFalse(
            verify_callback_data(
                parsed=parsed,
                user_id=7,
                chat_id="-100",
                bot_id=9,
                expires_at=expires_at,
                now=now,
            )
        )


if __name__ == "__main__":
    unittest.main()

