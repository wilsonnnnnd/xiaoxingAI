import unittest


class TestOutgoingDraftStatus(unittest.TestCase):
    def test_transition_matrix(self) -> None:
        from app.core.outgoing_email import is_valid_transition

        self.assertTrue(is_valid_transition("pending", "confirmed"))
        self.assertTrue(is_valid_transition("pending", "cancelled"))
        self.assertTrue(is_valid_transition("pending", "expired"))

        self.assertFalse(is_valid_transition("sent", "sending"))
        self.assertFalse(is_valid_transition("cancelled", "confirmed"))


if __name__ == "__main__":
    unittest.main()

