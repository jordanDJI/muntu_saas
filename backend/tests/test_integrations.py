"""
Tests des règles pures des intégrations de widgets (services/integrations.py).

Lancement :
    cd backend && python -m unittest discover -s tests -v
"""
import os
import unittest
from datetime import datetime, timedelta, timezone

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

from app.services.integrations import (  # noqa: E402
    SEEN_REFRESH,
    chatbot_missing,
    generate_key,
    is_klientys_host,
    is_valid_key,
    normalize_host,
    same_site,
    should_noindex,
    should_refresh_seen,
)


class NormalizeHostTest(unittest.TestCase):
    def test_strips_www_scheme_port_path(self):
        self.assertEqual(normalize_host("https://www.MuntuCura.be:443/contact?x=1"), "muntucura.be")
        self.assertEqual(normalize_host("www.muntucura.be"), "muntucura.be")
        self.assertEqual(normalize_host("muntucura.be."), "muntucura.be")

    def test_keeps_real_subdomain(self):
        # blog.x et www.x sont deux sites distincts : pas de conflit entre eux
        self.assertEqual(normalize_host("blog.muntucura.be"), "blog.muntucura.be")

    def test_rejects_garbage(self):
        for bad in (None, "", "   ", "http://", "exa mple.com", "a..b"):
            self.assertIsNone(normalize_host(bad), bad)


class SameSiteTest(unittest.TestCase):
    def test_www_and_apex_are_the_same_site(self):
        self.assertTrue(same_site("www.muntucura.be", "muntucura.be"))
        self.assertTrue(same_site("https://muntucura.be/", "WWW.MUNTUCURA.BE"))

    def test_subdomain_is_not_the_same_site(self):
        self.assertFalse(same_site("blog.muntucura.be", "www.muntucura.be"))

    def test_empty_never_matches(self):
        self.assertFalse(same_site(None, None))
        self.assertFalse(same_site("", ""))


class KlientysHostTest(unittest.TestCase):
    def test_own_hosts_are_ignored(self):
        hosts = {"klientys.co", "localhost"}
        self.assertTrue(is_klientys_host("klientys.co", hosts))
        self.assertTrue(is_klientys_host("localhost", hosts))
        self.assertTrue(is_klientys_host("muntu-saas-git-main.vercel.app", hosts))

    def test_client_hosts_are_kept(self):
        hosts = {"klientys.co", "localhost"}
        self.assertFalse(is_klientys_host("muntucura.be", hosts))
        # 127.0.0.1 volontairement non ignoré : permet de tester une page
        # cliente servie en local (Live Server…)
        self.assertFalse(is_klientys_host("127.0.0.1", hosts))
        self.assertFalse(is_klientys_host(None, hosts))


class KeyTest(unittest.TestCase):
    def test_generated_keys_are_valid_and_unique(self):
        keys = {generate_key() for _ in range(200)}
        self.assertEqual(len(keys), 200)
        self.assertTrue(all(is_valid_key(k) for k in keys))

    def test_invalid_keys(self):
        for bad in (None, "", "int_", "int_XYZ", "int_123", "abc_3f9a1c0b7e24", "int_3f9a1c0b7e24 "):
            self.assertFalse(is_valid_key(bad), bad)


class ChatbotMissingTest(unittest.TestCase):
    def _site(self, **over):
        site = {
            "title": "Muntu Cura", "description": "Infirmière indépendante",
            "phone": "+32470852516", "email_contact": "",
            "service_offer": [{"name": "Prise de sang"}],
        }
        site.update(over)
        return site

    def test_complete_site_is_ready(self):
        self.assertEqual(chatbot_missing(self._site()), [])

    def test_email_alone_is_enough_contact(self):
        self.assertEqual(chatbot_missing(self._site(phone="", email_contact="a@b.be")), [])

    def test_each_requirement(self):
        self.assertEqual(chatbot_missing(self._site(title="  ")), ["title"])
        self.assertEqual(chatbot_missing(self._site(description=None)), ["description"])
        self.assertEqual(chatbot_missing(self._site(service_offer=[{"name": ""}])), ["service"])
        self.assertEqual(chatbot_missing(self._site(phone="", email_contact=None)), ["contact"])

    def test_no_site(self):
        self.assertEqual(chatbot_missing(None), ["title", "description", "service", "contact"])


class NoindexTest(unittest.TestCase):
    def test_rule(self):
        self.assertTrue(should_noindex(True, False))    # widgets sur le site du client
        self.assertFalse(should_noindex(True, True))    # le domaine du client sert Klientys
        self.assertFalse(should_noindex(False, False))  # tenant classique
        self.assertFalse(should_noindex(False, True))


class RefreshSeenTest(unittest.TestCase):
    def test_throttle(self):
        now = datetime(2026, 10, 31, 12, 0, tzinfo=timezone.utc)
        self.assertTrue(should_refresh_seen(None, now))
        self.assertFalse(should_refresh_seen((now - timedelta(minutes=2)).isoformat(), now))
        self.assertTrue(should_refresh_seen((now - SEEN_REFRESH).isoformat(), now))
        self.assertTrue(should_refresh_seen("2026-10-31T11:00:00Z", now))
        self.assertTrue(should_refresh_seen("pas une date", now))


if __name__ == "__main__":
    unittest.main()
