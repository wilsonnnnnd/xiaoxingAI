import base64
import unittest


class TestEmailMime(unittest.TestCase):
    def test_build_raw_contains_headers(self) -> None:
        from app.utils.email_mime import build_gmail_raw_message

        raw = build_gmail_raw_message(
            to_email="a@example.com",
            subject="Hello",
            body_plain="Body",
        )
        msg_bytes = base64.urlsafe_b64decode(raw.encode("ascii"))
        s = msg_bytes.decode("utf-8", errors="replace")
        self.assertIn("To: a@example.com", s)
        self.assertIn("Subject: Hello", s)


if __name__ == "__main__":
    unittest.main()

