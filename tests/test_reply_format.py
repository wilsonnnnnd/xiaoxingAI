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


if __name__ == "__main__":
    unittest.main()

