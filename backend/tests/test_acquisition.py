"""
Tests des règles pures du moteur d'acquisition (migration 086) :
import SIRENE (services/sirene.py), parrainage (services/referral.py) et
tendance de l'outil « demande locale » (api/v1/growth.py).

Lancement :
    cd backend && python -m unittest discover -s tests -v
"""
import os
import unittest
from datetime import date, datetime, timezone

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

from app.api.v1.growth import trend_pct  # noqa: E402
from app.services.referral import (  # noqa: E402
    credit_cents,
    extended_trial_end,
    normalize_code,
    normalize_via,
)
from app.services.sirene import (  # noqa: E402
    SECTOR_NAF,
    build_query,
    department_from_postal,
    display_name,
    parse_etablissement,
    sector_for_naf,
)


def _etab(**overrides) -> dict:
    etab = {
        "siret": "12345678900011",
        "statutDiffusionEtablissement": "O",
        "dateCreationEtablissement": "2026-11-10",
        "trancheEffectifsEtablissement": "NN",
        "uniteLegale": {
            "statutDiffusionUniteLegale": "O",
            "categorieJuridiqueUniteLegale": "1000",
            "nomUniteLegale": "Martin",
            "prenomUsuelUniteLegale": "Claire",
            "denominationUniteLegale": None,
        },
        "adresseEtablissement": {
            "numeroVoieEtablissement": "12",
            "typeVoieEtablissement": "RUE",
            "libelleVoieEtablissement": "DE LA REPUBLIQUE",
            "codePostalEtablissement": "13001",
            "libelleCommuneEtablissement": "MARSEILLE",
        },
        "periodesEtablissement": [{
            "etatAdministratifEtablissement": "A",
            "activitePrincipaleEtablissement": "96.02A",
            "enseigne1Etablissement": None,
            "denominationUsuelleEtablissement": None,
        }],
    }
    for key, value in overrides.items():
        etab[key] = value
    return etab


class SireneTest(unittest.TestCase):
    def test_every_naf_code_maps_back_to_its_sector(self):
        for sector, codes in SECTOR_NAF.items():
            for code in codes:
                self.assertEqual(sector_for_naf(code), sector)
        self.assertIsNone(sector_for_naf("62.01Z"))
        self.assertIsNone(sector_for_naf(None))

    def test_no_naf_code_is_claimed_by_two_sectors(self):
        all_codes = [c for codes in SECTOR_NAF.values() for c in codes]
        self.assertEqual(len(all_codes), len(set(all_codes)))

    def test_query_filters_dates_headquarters_and_activity(self):
        q = build_query(["96.02A", "96.02B"], date(2026, 11, 8), date(2026, 11, 15))
        self.assertIn("dateCreationEtablissement:[2026-11-08 TO 2026-11-15]", q)
        self.assertIn("etablissementSiege:true", q)
        self.assertIn(
            "periode(activitePrincipaleEtablissement:96.02A OR activitePrincipaleEtablissement:96.02B)", q)
        with self.assertRaises(ValueError):
            build_query([], date(2026, 11, 8), date(2026, 11, 15))

    def test_department(self):
        self.assertEqual(department_from_postal("13001"), "13")
        self.assertEqual(department_from_postal("97400"), "974")
        self.assertEqual(department_from_postal("20000"), "20")
        self.assertIsNone(department_from_postal("1000"))
        self.assertIsNone(department_from_postal(None))

    def test_individual_entrepreneur_is_named_after_the_person(self):
        row = parse_etablissement(_etab())
        self.assertEqual(row["name"], "Claire MARTIN")
        self.assertEqual(row["sector"], "beauty")
        self.assertEqual(row["street"], "12 RUE DE LA REPUBLIQUE")
        self.assertEqual(row["department"], "13")
        self.assertEqual(row["external_id"], "12345678900011")

    def test_trade_name_wins_over_legal_name(self):
        etab = _etab()
        etab["periodesEtablissement"][0]["enseigne1Etablissement"] = "SALON CLAIRE"
        self.assertEqual(display_name(etab), "SALON CLAIRE")

    def test_non_diffusible_companies_are_dropped(self):
        self.assertIsNone(parse_etablissement(_etab(statutDiffusionEtablissement="P")))
        etab = _etab()
        etab["uniteLegale"]["statutDiffusionUniteLegale"] = "P"
        self.assertIsNone(parse_etablissement(etab))

    def test_closed_establishments_are_dropped(self):
        etab = _etab()
        etab["periodesEtablissement"][0]["etatAdministratifEtablissement"] = "F"
        self.assertIsNone(parse_etablissement(etab))

    def test_masked_values_are_ignored(self):
        etab = _etab()
        etab["adresseEtablissement"]["numeroVoieEtablissement"] = "[ND]"
        self.assertEqual(parse_etablissement(etab)["street"], "RUE DE LA REPUBLIQUE")


class ReferralTest(unittest.TestCase):
    def test_code_is_a_slug(self):
        self.assertEqual(normalize_code("  Muntu-Cura "), "muntu-cura")
        self.assertIsNone(normalize_code(""))
        self.assertIsNone(normalize_code("a"))
        self.assertIsNone(normalize_code("drop table;"))
        self.assertIsNone(normalize_code(None))

    def test_a_pasted_link_keeps_its_ref(self):
        self.assertEqual(normalize_code("https://klientys.co/?ref=muntu-cura&via=badge"), "muntu-cura")
        self.assertIsNone(normalize_code("https://klientys.co/"))

    def test_via(self):
        self.assertEqual(normalize_via("badge"), "badge")
        self.assertEqual(normalize_via("demand_tool"), "link")
        self.assertEqual(normalize_via(None), "link")

    def test_credit(self):
        self.assertEqual(credit_cents(29.9), 2990)
        self.assertEqual(credit_cents(59.9), 5990)
        self.assertEqual(credit_cents(None), 0)
        self.assertEqual(credit_cents(0), 0)

    def test_trial_still_running_is_extended_from_its_end(self):
        now = datetime(2026, 11, 15, tzinfo=timezone.utc)
        end = extended_trial_end("2026-11-10T00:00:00+00:00", None, now)
        self.assertEqual(end, datetime(2026, 12, 24, tzinfo=timezone.utc))  # 10/11 + 14 j + 30 j

    def test_expired_trial_is_extended_from_today(self):
        now = datetime(2026, 11, 15, tzinfo=timezone.utc)
        end = extended_trial_end("2026-09-01T00:00:00Z", None, now)
        self.assertEqual(end, datetime(2026, 12, 15, tzinfo=timezone.utc))

    def test_previous_extension_is_kept(self):
        now = datetime(2026, 11, 15, tzinfo=timezone.utc)
        end = extended_trial_end("2026-09-01T00:00:00Z", "2026-12-01T00:00:00Z", now)
        self.assertEqual(end, datetime(2026, 12, 31, tzinfo=timezone.utc))


class DemandTrendTest(unittest.TestCase):
    def test_rising_demand(self):
        points = [{"value": 40}] * 39 + [{"value": 60}] * 13
        self.assertGreater(trend_pct(points), 0)

    def test_not_enough_points(self):
        self.assertIsNone(trend_pct([{"value": 50}] * 10))
        self.assertIsNone(trend_pct([]))

    def test_no_volume(self):
        self.assertIsNone(trend_pct([{"value": 0}] * 52))


if __name__ == "__main__":
    unittest.main()
