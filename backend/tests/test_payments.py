"""
Tests des fonctions pures de la chaîne de paiement.

Couvre ce qui est testable sans base : le CLAUDE.md interdit les mock DB, et
les chemins qui touchent Supabase ou PayPal demandent donc un environnement
réel (voir la note en fin de fichier pour ce qui reste à couvrir).

Lancement :
    cd backend && python -m unittest discover -s tests -v
    cd backend && pytest tests            # si pytest est installé
"""
import os
import unittest

# Les modules applicatifs instancient Settings à l'import : on fournit des
# valeurs factices avant de les charger.
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

from app.core.urls import safe_redirect_url  # noqa: E402
from app.services.paypal import parse_deposit_config  # noqa: E402
from app.services.subscription import (  # noqa: E402
    ESSENTIEL_FEATURES,
    PRO_FEATURES,
    _apply_global_flags,
    _apply_overrides,
    merge_plan_features,
)


def _site(**deposit) -> dict:
    """Ligne `site` minimale portant une config d'acompte."""
    secret = deposit.pop("_secret", "secret-xyz")
    return {"site_style": {"deposit": deposit}, "paypal_client_secret": secret}


class TestParseDepositConfig(unittest.TestCase):
    """Le montant de l'acompte doit venir du serveur, et être valide."""

    def test_config_complete(self):
        cfg = parse_deposit_config(_site(
            enabled=True, amount=25, currency="eur", paypal_client_id="AQk_live_id",
        ))
        self.assertIsNotNone(cfg)
        self.assertEqual(cfg["amount"], 25.0)
        self.assertEqual(cfg["currency"], "EUR")       # normalisée en majuscules
        self.assertEqual(cfg["client_id"], "AQk_live_id")
        self.assertFalse(cfg["sandbox"])

    def test_desactive(self):
        self.assertIsNone(parse_deposit_config(_site(
            enabled=False, amount=25, paypal_client_id="AQk",
        )))

    def test_sans_client_id(self):
        self.assertIsNone(parse_deposit_config(_site(
            enabled=True, amount=25, paypal_client_id="   ",
        )))

    def test_sans_secret(self):
        self.assertIsNone(parse_deposit_config(_site(
            enabled=True, amount=25, paypal_client_id="AQk", _secret="",
        )))

    def test_montant_absent_zero_ou_negatif(self):
        for amount in (None, 0, -5):
            with self.subTest(amount=amount):
                self.assertIsNone(parse_deposit_config(_site(
                    enabled=True, amount=amount, paypal_client_id="AQk",
                )))

    def test_montant_non_numerique(self):
        self.assertIsNone(parse_deposit_config(_site(
            enabled=True, amount="gratuit", paypal_client_id="AQk",
        )))

    def test_sandbox_et_arrondi(self):
        cfg = parse_deposit_config(_site(
            enabled=True, amount=19.999, paypal_client_id="AQk", sandbox=True,
        ))
        self.assertEqual(cfg["amount"], 20.0)
        self.assertTrue(cfg["sandbox"])

    def test_site_vide(self):
        self.assertIsNone(parse_deposit_config({}))


class TestMergePlanFeatures(unittest.TestCase):
    """Le code fait foi sur les features, pas la base (migration 019 obsolète)."""

    def test_code_gagne_sur_la_base(self):
        # Valeurs réellement présentes en base pour Pro via la migration 019
        db = {"max_contacts": 500, "analytics_roi": False}
        merged = merge_plan_features("Pro", db)
        self.assertEqual(merged["max_contacts"], PRO_FEATURES["max_contacts"])
        self.assertTrue(merged["analytics_roi"])

    def test_essentiel_conserve_ses_features(self):
        db = {"agent_vitrine": False, "multi_page_site": False}
        merged = merge_plan_features("Essentiel", db)
        self.assertTrue(merged["agent_vitrine"])
        self.assertTrue(merged["multi_page_site"])

    def test_cle_presente_seulement_en_base_conservee(self):
        merged = merge_plan_features("Pro", {"feature_experimentale": True})
        self.assertTrue(merged["feature_experimentale"])

    def test_plan_inconnu_retombe_sur_essentiel(self):
        merged = merge_plan_features("PlanFantome", None)
        self.assertEqual(merged["max_contacts"], ESSENTIEL_FEATURES["max_contacts"])

    def test_features_nulles(self):
        self.assertEqual(merge_plan_features("Pro", None)["max_contacts"],
                         PRO_FEATURES["max_contacts"])

    def test_trial_et_essentiel_payant_identiques(self):
        """Un Essentiel payant ne doit pas avoir moins qu'un compte en essai."""
        paying = merge_plan_features("Essentiel", {"agent_vitrine": False})
        for key, value in ESSENTIEL_FEATURES.items():
            with self.subTest(feature=key):
                self.assertEqual(paying[key], value)


class TestFeatureFlagsEtOverrides(unittest.TestCase):

    def test_flag_global_desactive_un_booleen(self):
        out = _apply_global_flags({"analytics": True}, [{"key": "analytics", "enabled": False}])
        self.assertFalse(out["analytics"])

    def test_flag_global_coupe_un_numerique(self):
        out = _apply_global_flags({"max_contacts": 1000}, [{"key": "max_contacts", "enabled": False}])
        self.assertEqual(out["max_contacts"], 0)

    def test_flag_inconnu_ignore(self):
        out = _apply_global_flags({"analytics": True}, [{"key": "inexistant", "enabled": False}])
        self.assertEqual(out, {"analytics": True})

    def test_override_valeur_numerique(self):
        out = _apply_overrides({"max_contacts": 100},
                               [{"feature_key": "max_contacts", "enabled": True, "value_int": 5000}])
        self.assertEqual(out["max_contacts"], 5000)

    def test_override_active_une_feature(self):
        out = _apply_overrides({"analytics": False},
                               [{"feature_key": "analytics", "enabled": True}])
        self.assertTrue(out["analytics"])


class TestSafeRedirectUrl(unittest.TestCase):
    """Stripe redirigeait vers n'importe quelle URL fournie par le client."""

    def test_origine_autorisee_conservee(self):
        url = "https://klientys.co/dashboard/settings?section=abonnement"
        self.assertEqual(safe_redirect_url(url, "/dashboard"), url)

    def test_origine_etrangere_remplacee(self):
        out = safe_redirect_url("https://evil.example/steal", "/dashboard")
        self.assertTrue(out.endswith("/dashboard"))
        self.assertNotIn("evil.example", out)

    def test_valeur_absente(self):
        self.assertTrue(safe_redirect_url(None, "/dashboard").endswith("/dashboard"))

    def test_schema_non_http_rejete(self):
        out = safe_redirect_url("javascript:alert(1)", "/dashboard")
        self.assertNotIn("javascript", out)

    def test_sous_domaine_non_autorise(self):
        out = safe_redirect_url("https://klientys.co.evil.test/x", "/dashboard")
        self.assertNotIn("evil.test", out)


class TestWebhookPaypalHelpers(unittest.TestCase):

    def setUp(self):
        from app.api.v1.booking import _extract_order_id, _is_stale
        self.extract = _extract_order_id
        self.is_stale = _is_stale

    def test_order_id_depuis_checkout_order(self):
        payload = {"event_type": "CHECKOUT.ORDER.APPROVED", "resource": {"id": "5O190127TN"}}
        self.assertEqual(self.extract(payload), "5O190127TN")

    def test_order_id_depuis_capture(self):
        payload = {
            "event_type": "PAYMENT.CAPTURE.COMPLETED",
            "resource": {
                "id": "capture-1",
                "supplementary_data": {"related_ids": {"order_id": "ORDER-42"}},
            },
        }
        self.assertEqual(self.extract(payload), "ORDER-42")

    def test_payload_sans_order(self):
        self.assertIsNone(self.extract({"event_type": "PAYMENT.CAPTURE.REFUNDED", "resource": {}}))
        self.assertIsNone(self.extract({}))

    def test_is_stale(self):
        from datetime import datetime, timedelta, timezone
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
        vieux = (cutoff - timedelta(minutes=5)).replace(tzinfo=None).isoformat()
        recent = datetime.now(timezone.utc).isoformat()
        self.assertTrue(self.is_stale(vieux, cutoff))       # naïf traité comme UTC
        self.assertFalse(self.is_stale(recent, cutoff))
        self.assertFalse(self.is_stale(None, cutoff))
        self.assertFalse(self.is_stale("pas-une-date", cutoff))


class TestMargeDomaine(unittest.TestCase):

    def test_arrondi_au_centime_superieur(self):
        from app.api.v1.domains import _with_markup
        from app.core.config import settings
        # Marge par défaut : 25 %
        self.assertEqual(settings.domain_markup_percent, 25.0)
        self.assertEqual(_with_markup(9.99), 12.49)   # 12.4875 -> plafond
        self.assertEqual(_with_markup(10.00), 12.50)


# ── Non couvert ici ──────────────────────────────────────────────────────────
# Demandent une instance Supabase et un compte PayPal sandbox réels :
#   - booking._assert_slot_bookable (horaires, blocages, capacité)
#   - booking.capture_paypal_and_book (écart de montant -> remboursement)
#   - subscriptions.stripe_webhook (idempotence, payment_status)
#   - deposits.refund_appointment_deposit
# Ce sont des tests d'intégration : ils supposent un projet Supabase de test
# et PAYPAL sandbox, à provisionner avant de les écrire.

if __name__ == "__main__":
    unittest.main()
