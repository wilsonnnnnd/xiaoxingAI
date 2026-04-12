import base64
import os
import unittest


class TestCrypto(unittest.TestCase):
    def setUp(self) -> None:
        key = os.urandom(32)
        os.environ["OUTGOING_EMAIL_ENCRYPTION_KEY"] = base64.b64encode(key).decode("ascii")

    def test_encrypt_decrypt_roundtrip(self) -> None:
        from app.utils.crypto import decrypt_draft_body, encrypt_draft_body

        blob = encrypt_draft_body(plaintext="hello", user_id=1, draft_id=123)
        pt = decrypt_draft_body(ciphertext=blob.ciphertext, nonce=blob.nonce, user_id=1, draft_id=123)
        self.assertEqual(pt, "hello")

    def test_aad_mismatch_fails(self) -> None:
        from cryptography.exceptions import InvalidTag
        from app.utils.crypto import decrypt_draft_body, encrypt_draft_body

        blob = encrypt_draft_body(plaintext="hello", user_id=1, draft_id=123)
        with self.assertRaises(InvalidTag):
            decrypt_draft_body(ciphertext=blob.ciphertext, nonce=blob.nonce, user_id=2, draft_id=123)


if __name__ == "__main__":
    unittest.main()

