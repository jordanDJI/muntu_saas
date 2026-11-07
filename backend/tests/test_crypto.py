"""
Tests du chiffrement applicatif des secrets (core/crypto.py) et des helpers
Telegram qui s'appuient dessus.

Lancement :
    cd backend && python -m unittest discover -s tests -v
"""
import os
import unittest
from unittest import mock

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_test")
os.environ.setdefault("RESEND_API_KEY", "test")
os.environ.setdefault("GEMINI_API_KEY", "test")
os.environ.setdefault("FRONTEND_URL", "https://klientys.co")
os.environ.setdefault("APP_URL", "https://klientys.co")
os.environ.setdefault("AGENT_LINK_SECRET", "test")

from cryptography.fernet import Fernet, InvalidToken  # noqa: E402

from app.core import crypto  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.services.telegram import bot_token_columns, stored_bot_token  # noqa: E402

KEY_A = Fernet.generate_key().decode()
KEY_B = Fernet.generate_key().decode()


class _Keys:
    """Pose des clés le temps d'un test et vide le cache du MultiFernet."""

    def __init__(self, current="", previous="", env="development"):
        self.values = {"data_encryption_key": current, "data_encryption_key_previous": previous, "app_env": env}

    def __enter__(self):
        self.patch = mock.patch.multiple(settings, **self.values)
        self.patch.start()
        crypto._fernet.cache_clear()

    def __exit__(self, *exc):
        self.patch.stop()
        crypto._fernet.cache_clear()


class EncryptDecryptTest(unittest.TestCase):
    def test_round_trip(self):
        with _Keys(KEY_A):
            enc = crypto.encrypt("EBx-secret-paypal")
            self.assertTrue(enc.startswith("enc:v1:"))
            self.assertNotIn("EBx-secret-paypal", enc)
            self.assertEqual(crypto.decrypt(enc), "EBx-secret-paypal")

    def test_not_deterministic(self):
        with _Keys(KEY_A):
            self.assertNotEqual(crypto.encrypt("x"), crypto.encrypt("x"))

    def test_empty_and_none_pass_through(self):
        with _Keys(KEY_A):
            self.assertIsNone(crypto.encrypt(None))
            self.assertEqual(crypto.encrypt(""), "")
            self.assertIsNone(crypto.decrypt(None))

    def test_plaintext_read_is_tolerated(self):
        """Lignes antérieures à la migration 081 : lues telles quelles."""
        with _Keys(KEY_A):
            self.assertEqual(crypto.decrypt("ancien-secret-en-clair"), "ancien-secret-en-clair")

    def test_already_encrypted_is_not_double_encrypted(self):
        with _Keys(KEY_A):
            enc = crypto.encrypt("s")
            self.assertEqual(crypto.encrypt(enc), enc)

    def test_rotation_reads_previous_key(self):
        with _Keys(KEY_A):
            old = crypto.encrypt("s")
        with _Keys(KEY_B, previous=KEY_A):
            self.assertEqual(crypto.decrypt(old), "s")
            rotated = crypto.rotate(old)
        with _Keys(KEY_B):
            self.assertEqual(crypto.decrypt(rotated), "s")

    def test_wrong_key_raises(self):
        with _Keys(KEY_A):
            enc = crypto.encrypt("s")
        with _Keys(KEY_B):
            with self.assertRaises(InvalidToken):
                crypto.decrypt(enc)

    def test_no_key_development_writes_plaintext(self):
        with _Keys("", env="development"):
            self.assertEqual(crypto.encrypt("s"), "s")

    def test_no_key_production_refuses(self):
        with _Keys("", env="production"):
            with self.assertRaises(crypto.EncryptionUnavailable):
                crypto.encrypt("s")

    def test_lookup_hash_matches_sql_backfill(self):
        # Même calcul que la migration 081 : encode(sha256(convert_to(x,'UTF8')),'hex')
        self.assertEqual(
            crypto.lookup_hash("abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        )


class TelegramTokenTest(unittest.TestCase):
    def test_columns_encrypt_and_hash(self):
        with _Keys(KEY_A):
            cols = bot_token_columns(" 123:ABC ")
            self.assertTrue(cols["telegram_bot_token"].startswith("enc:v1:"))
            self.assertEqual(cols["telegram_bot_token_hash"], crypto.lookup_hash("123:ABC"))
            self.assertEqual(stored_bot_token(cols), "123:ABC")

    def test_clearing_token(self):
        self.assertEqual(bot_token_columns(""), {"telegram_bot_token": None, "telegram_bot_token_hash": None})

    def test_stored_token_tolerates_missing_and_plaintext(self):
        self.assertEqual(stored_bot_token(None), "")
        self.assertEqual(stored_bot_token({}), "")
        self.assertEqual(stored_bot_token({"telegram_bot_token": "123:legacy"}), "123:legacy")


if __name__ == "__main__":
    unittest.main()
