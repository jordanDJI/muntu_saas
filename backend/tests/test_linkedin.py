"""
Tests des règles pures du partage LinkedIn (services/linkedin.py, migration 087).

Lancement :
    cd backend && python -m unittest discover -s tests -v
"""
import os
import time
import unittest
from datetime import datetime, timezone

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_test")
os.environ.setdefault("RESEND_API_KEY", "test")
os.environ.setdefault("EMAIL_FROM", "test@klientys.co")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("GEMINI_API_KEY", "test")
os.environ.setdefault("FRONTEND_URL", "https://klientys.co")
os.environ.setdefault("APP_URL", "https://api.klientys.co")
os.environ.setdefault("AGENT_LINK_SECRET", "test")

from app.services.linkedin import (  # noqa: E402
    COMMENTARY_MAX,
    days_left,
    default_commentary,
    escape_commentary,
    post_url,
    sign_state,
    verify_state,
)


class StateTest(unittest.TestCase):
    def test_round_trip(self):
        claims = verify_state(sign_state("admin-1", "jordan@klientys.co"))
        self.assertEqual(claims["sub"], "admin-1")
        self.assertEqual(claims["email"], "jordan@klientys.co")

    def test_tampered_state_is_rejected(self):
        state = sign_state("admin-1", "a@b.c")
        payload, sig = state.split(".")
        forged = sign_state("intrus", "x@y.z").split(".")[0]
        self.assertIsNone(verify_state(f"{forged}.{sig}"))
        self.assertIsNone(verify_state(f"{payload}.AAAA"))
        self.assertIsNone(verify_state("n'importe quoi"))
        self.assertIsNone(verify_state(""))

    def test_expired_state_is_rejected(self):
        state = sign_state("admin-1", "a@b.c", now=time.time() - 3600)
        self.assertIsNone(verify_state(state))


class CommentaryTest(unittest.TestCase):
    def test_reserved_characters_are_escaped(self):
        self.assertEqual(escape_commentary("Prix (TTC) #1 @Klientys"), r"Prix \(TTC\) \#1 \@Klientys")
        self.assertEqual(escape_commentary("a_b*c~d|e"), r"a\_b\*c\~d\|e")
        self.assertEqual(escape_commentary("[x]{y}<z>"), r"\[x\]\{y\}\<z\>")
        self.assertEqual(escape_commentary("chemin\\fichier"), "chemin\\\\fichier")

    def test_plain_text_is_untouched(self):
        self.assertEqual(escape_commentary("  Combien coûte un site ?  "), "Combien coûte un site ?")

    def test_length_is_capped_without_a_dangling_backslash(self):
        out = escape_commentary("a" * (COMMENTARY_MAX - 1) + "#")
        self.assertLessEqual(len(out), COMMENTARY_MAX)
        trailing = len(out) - len(out.rstrip("\\"))
        self.assertEqual(trailing % 2, 0)

    def test_default_text(self):
        text = default_commentary("Titre", "Résumé")
        self.assertTrue(text.startswith("Titre\n\nRésumé"))
        self.assertNotIn("None", default_commentary("Titre", None))


class MiscTest(unittest.TestCase):
    def test_post_url(self):
        self.assertEqual(post_url("urn:li:share:123"), "https://www.linkedin.com/feed/update/urn:li:share:123/")

    def test_days_left(self):
        now = datetime(2026, 11, 16, tzinfo=timezone.utc)
        self.assertEqual(days_left("2026-11-26T00:00:00+00:00", now), 10)
        self.assertEqual(days_left("2026-11-01T00:00:00Z", now), 0)
        self.assertIsNone(days_left(None, now))


if __name__ == "__main__":
    unittest.main()
