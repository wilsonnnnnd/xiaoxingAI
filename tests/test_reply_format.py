import unittest


class TestReplyFormat(unittest.TestCase):
    def test_apply_template_with_placeholders(self) -> None:
        from app.utils.reply_format import apply_reply_format

        out = apply_reply_format(
            content="Hello",
            body_template="Hi,\n\n{{content}}\n\n{{closing}}\n\n{{signature}}",
            signature="Will",
            closing="Best",
        )
        self.assertEqual(out, "Hi,\n\nHello\n\nBest\n\nWill")

    def test_apply_template_without_placeholders(self) -> None:
        from app.utils.reply_format import apply_reply_format

        out = apply_reply_format(
            content="Hello",
            body_template="Hi",
            signature="Will",
            closing=None,
        )
        self.assertEqual(out, "Hi\n\nHello\n\nWill")

    def test_apply_no_template(self) -> None:
        from app.utils.reply_format import apply_reply_format

        out = apply_reply_format(content="Hello", body_template=None, signature="Will", closing=None)
        self.assertEqual(out, "Hello\n\nWill")

    def test_strip_footer_removes_closing_and_signature(self) -> None:
        from app.utils.reply_format import strip_reply_footer

        out = strip_reply_footer(
            content="Hello\n\nBest regards,\nAdmin",
            closing="Best regards,",
            signature="Admin",
        )
        self.assertEqual(out, "Hello")

    def test_strip_footer_removes_duplicates(self) -> None:
        from app.utils.reply_format import strip_reply_footer

        out = strip_reply_footer(
            content="Hello\n\nBest regards,\nAdmin\n\nThanks,\nAdmin",
            closing="Thanks,",
            signature="Admin",
        )
        self.assertEqual(out, "Hello")


if __name__ == "__main__":
    unittest.main()
