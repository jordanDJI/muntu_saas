"""
Tests des règles pures : coordonnées des prospects (services/prospect_contacts.py)
et courriers (services/prospect_letters.py), migration 088.

Lancement :
    cd backend && python -m unittest discover -s tests -v
"""
import os
import unittest
from datetime import date

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_test")
os.environ.setdefault("RESEND_API_KEY", "test")
os.environ.setdefault("EMAIL_FROM", "test@klientys.co")
os.environ.setdefault("SECRET_KEY", "test")
os.environ.setdefault("GEMINI_API_KEY", "test")
os.environ.setdefault("FRONTEND_URL", "https://klientys.co")
os.environ.setdefault("APP_URL", "https://klientys.co")
os.environ.setdefault("AGENT_LINK_SECRET", "test")

from app.services.prospect_contacts import (  # noqa: E402
    contact_links,
    decide,
    extract_contacts,
    is_excluded,
    mentions_company,
    normalize_phone,
    parse_model_json,
)
from app.services.prospect_letters import (  # noqa: E402
    city_label,
    fill,
    french_date,
    letters_html,
    merge_template,
    placeholders,
)

SITE = """
<html><body><h1>Salon Claire — coiffure à Marseille</h1>
<p>Appelez-nous au 04 91 12 34 56 ou écrivez à <a href="mailto:contact@salonclaire.fr">contact@salonclaire.fr</a></p>
<p>Mentions légales : SIRET 12345678900012 — site réalisé par webagence@agence.fr</p>
<a href="/contact">Contact</a><a href="https://facebook.com/salonclaire">Facebook</a>
<script>var x = "06 00 00 00 00";</script>
</body></html>"""


class PhoneTest(unittest.TestCase):
    def test_formats(self):
        self.assertEqual(normalize_phone("0491123456"), "04 91 12 34 56")
        self.assertEqual(normalize_phone("+33 6 12 34 56 78"), "06 12 34 56 78")
        self.assertEqual(normalize_phone("+33 (0)6 12 34 56 78"), "06 12 34 56 78")
        self.assertEqual(normalize_phone("0033 6 12 34 56 78"), "06 12 34 56 78")
        self.assertIsNone(normalize_phone("12345"))
        self.assertIsNone(normalize_phone("0012345678"))
        self.assertIsNone(normalize_phone(None))


class ExtractTest(unittest.TestCase):
    def test_contacts_on_a_page(self):
        phones, emails = extract_contacts(SITE)
        self.assertEqual(phones, ["04 91 12 34 56"])           # ni le SIRET, ni le script
        self.assertIn("contact@salonclaire.fr", emails)

    def test_international_phone(self):
        phones, _ = extract_contacts("<p>Tél : +33 (0) 6 12 34 56 78</p>")
        self.assertEqual(phones, ["06 12 34 56 78"])

    def test_contact_links_stay_on_the_site(self):
        links = contact_links("https://salonclaire.fr/", SITE)
        self.assertEqual(links, ["https://salonclaire.fr/contact"])

    def test_excluded_sources(self):
        self.assertTrue(is_excluded("https://fr.linkedin.com/in/claire"))
        self.assertTrue(is_excluded("https://www.pagesjaunes.fr/pros/123"))
        self.assertTrue(is_excluded("https://www.societe.com/societe/x.html"))
        self.assertFalse(is_excluded("https://salonclaire.fr"))
        self.assertFalse(is_excluded(None))

    def test_page_must_mention_the_company(self):
        text = "Salon Claire, coiffure à Marseille"
        self.assertTrue(mentions_company(text, "SALON CLAIRE", "MARSEILLE", "13001"))
        self.assertTrue(mentions_company("Coiffeur 13001", "AUTRE NOM", None, "13001"))
        self.assertFalse(mentions_company("Plombier à Lille", "SALON CLAIRE", "MARSEILLE", "13001"))

    def test_model_json(self):
        self.assertEqual(parse_model_json('Voici : {"phone": "04 91 12 34 56"} fin')["phone"], "04 91 12 34 56")
        self.assertEqual(parse_model_json("pas de json"), {})
        self.assertEqual(parse_model_json("{cassé"), {})


class DecideTest(unittest.TestCase):
    def test_values_read_on_the_site_are_verified(self):
        r = decide({"phone": "0491123456"}, True, ["04 91 12 34 56"], ["contact@salonclaire.fr"],
                   "https://salonclaire.fr")
        self.assertTrue(r["contact_verified"])
        self.assertEqual(r["contact_phone"], "04 91 12 34 56")
        self.assertEqual(r["contact_email"], "contact@salonclaire.fr")
        self.assertEqual(r["contact_source"], "https://salonclaire.fr")

    def test_site_email_preferred_over_web_agency(self):
        r = decide({}, True, [], ["webagence@agence.fr", "bonjour@salonclaire.fr"], "https://www.salonclaire.fr")
        self.assertEqual(r["contact_email"], "bonjour@salonclaire.fr")

    def test_unread_suggestion_is_kept_but_not_verified(self):
        r = decide({"phone": "06 12 34 56 78", "source_url": "https://maps.google.com/x", "confidence": "haute"},
                   False, [], [], None)
        self.assertFalse(r["contact_verified"])
        self.assertEqual(r["contact_phone"], "06 12 34 56 78")

    def test_weak_or_excluded_suggestions_are_dropped(self):
        weak = decide({"phone": "0612345678", "confidence": "faible"}, False, [], [], None)
        self.assertIsNone(weak["contact_phone"])
        linkedin = decide({"email": "c@x.fr", "source_url": "https://linkedin.com/in/c", "confidence": "haute"},
                          False, [], [], None)
        self.assertIsNone(linkedin["contact_email"])


class LetterTest(unittest.TestCase):
    def test_city_and_date(self):
        self.assertEqual(city_label("SAINT-ETIENNE"), "Saint-Etienne")
        self.assertEqual(city_label("AIX EN PROVENCE"), "Aix En Provence")
        self.assertEqual(french_date(date(2026, 11, 1)), "1er novembre 2026")
        self.assertEqual(french_date(date(2026, 11, 19)), "19 novembre 2026")

    def test_individual_entrepreneur_is_not_named_like_a_company(self):
        values = placeholders({"name": "Claire MARTIN", "legal_category": "1000", "city": "MARSEILLE",
                               "sector": "beauty"})
        self.assertEqual(values["nom"], "votre activité")
        self.assertEqual(values["ville"], "Marseille")
        self.assertEqual(fill("lancement de {nom} à {ville}", values), "lancement de votre activité à Marseille")
        company = placeholders({"name": "PLOMBERIE DUPONT", "legal_category": "5499", "sector": "trade"})
        self.assertEqual(company["nom"], "PLOMBERIE DUPONT")
        self.assertEqual(company["ville"], "près de chez vous")

    def test_template_keeps_defaults_for_empty_fields(self):
        t = merge_template({"signature": "Jordan", "body": "  ", "unknown": "x"}, "https://klientys.co")
        self.assertEqual(t["signature"], "Jordan")
        self.assertIn("Félicitations", t["body"])
        self.assertNotIn("unknown", t)

    def test_letter_carries_the_gdpr_notice_and_escapes_names(self):
        html = letters_html([{"name": "A & <B>", "street": "1 RUE X", "postal_code": "13001", "city": "MARSEILLE"}],
                            merge_template(None, "https://klientys.co"), date(2026, 11, 19))
        self.assertIn("base SIRENE", html)
        self.assertIn("6 mois", html)
        self.assertIn("A &amp; &lt;B&gt;", html)
        self.assertNotIn("<B>", html)


if __name__ == "__main__":
    unittest.main()
