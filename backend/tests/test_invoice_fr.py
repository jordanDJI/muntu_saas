"""
Conformité française des factures — fonctions pures, aucune base requise.

    cd backend && python -m unittest discover -s tests -v
"""
import unittest
from datetime import date

from app.services.invoice_legal import (
    DEFAULT_RECOVERY_FEE,
    build_legal_mentions,
    client_issues,
    compute_due_date,
    document_label,
    insurance_mentions,
    issuer_identity_line,
    issuer_issues,
    payment_terms_warning,
    penalty_mentions,
    resolve_vat_regime,
)
from app.services.invoice_ubl import generate_invoice_ubl


class TestVatRegime(unittest.TestCase):
    def test_taux_positif_force_le_regime_normal(self):
        # Même si le tenant a coché "franchise", une facture qui porte de la TVA
        # ne peut pas déclarer une exonération.
        r = resolve_vat_regime("franchise", 20)
        self.assertEqual(r["category"], "S")
        self.assertEqual(r["exemption_code"], "")

    def test_franchise_en_base(self):
        r = resolve_vat_regime("franchise", 0)
        self.assertEqual(r["category"], "E")
        self.assertEqual(r["exemption_code"], "VATEX-FR-FRANCHISE")
        self.assertIn("293 B", r["mention"])

    def test_exoneration_medicale(self):
        r = resolve_vat_regime("medical", 0)
        self.assertEqual(r["category"], "E")
        self.assertEqual(r["exemption_code"], "VATEX-EU-132-1C")
        self.assertIn("261-4-1", r["mention"])

    def test_autoliquidation_reste_possible_mais_explicite(self):
        r = resolve_vat_regime("reverse_charge", 0)
        self.assertEqual(r["category"], "AE")
        self.assertEqual(r["exemption_code"], "VATEX-EU-AE")

    def test_taux_nul_sans_regime_n_invente_aucun_motif(self):
        # Le bug corrigé : tout taux nul était codé en autoliquidation.
        r = resolve_vat_regime(None, 0)
        self.assertEqual(r["category"], "Z")
        self.assertEqual(r["exemption_code"], "")
        self.assertNotIn("AE", r["category"])

    def test_regime_inconnu_ne_casse_pas(self):
        r = resolve_vat_regime("n_importe_quoi", 0)
        self.assertEqual(r["category"], "Z")


class TestEcheance(unittest.TestCase):
    def test_delai_franchit_le_mois(self):
        # L'ancien calcul rendait le 28 du mois d'émission, soit 8 jours.
        self.assertEqual(compute_due_date(date(2026, 10, 20), 30), date(2026, 11, 19))

    def test_echeance_jamais_anterieure_a_l_emission(self):
        for day in range(1, 29):
            issue = date(2026, 1, day)
            due = compute_due_date(issue, 30)
            self.assertGreater(due, issue)

    def test_delai_nul_pas_d_echeance(self):
        self.assertIsNone(compute_due_date(date(2026, 3, 1), 0))

    def test_plafond_legal_signale(self):
        self.assertEqual(payment_terms_warning(45, "FR"), "")
        self.assertIn("60 jours", payment_terms_warning(90, "FR"))
        self.assertEqual(payment_terms_warning(90, "BE"), "")


class TestMentions(unittest.TestCase):
    def test_indemnite_de_recouvrement_toujours_presente(self):
        lines = penalty_mentions(build_legal_mentions({}), "FR")
        self.assertTrue(any("40,00" in l for l in lines))
        self.assertTrue(any("L441-10" in l for l in lines))

    def test_taux_de_penalite_du_professionnel(self):
        lines = penalty_mentions(build_legal_mentions({"late_penalty_rate": 12.5}), "FR")
        self.assertTrue(any("12,5 %" in l for l in lines))

    def test_sans_taux_mention_legale_suppletive(self):
        lines = penalty_mentions(build_legal_mentions({}), "FR")
        self.assertTrue(any("Banque centrale européenne" in l for l in lines))

    def test_hors_france_aucune_mention_imposee(self):
        self.assertEqual(penalty_mentions(build_legal_mentions({}), "BE"), [])

    def test_recovery_fee_par_defaut(self):
        self.assertEqual(build_legal_mentions({})["recovery_fee"], DEFAULT_RECOVERY_FEE)

    def test_identite_emetteur(self):
        line = issuer_identity_line(
            {"tenant_legal_id": "812345678", "tenant_vat": "FR12812345678"},
            {"legal_form": "SASU", "share_capital": "1 000 €", "rcs_city": "Rennes"},
        )
        self.assertIn("SASU", line)
        self.assertIn("RCS Rennes", line)
        self.assertIn("812345678", line)

    def test_assurance_absente_si_non_renseignee(self):
        self.assertEqual(insurance_mentions({}), [])
        self.assertIn("AXA", insurance_mentions({"insurance_name": "AXA"})[0])

    def test_libelle_du_document(self):
        self.assertEqual(document_label("credit_note"), "FACTURE D'AVOIR")
        self.assertEqual(document_label("invoice"), "FACTURE")


class TestConformite(unittest.TestCase):
    def _facture_complete(self) -> dict:
        return {
            "tenant_name": "Cabinet Dupont",
            "tenant_legal_id": "812345678",
            "tenant_street": "12 rue des Lilas",
            "tenant_postal_code": "35000",
            "tenant_city": "Rennes",
            "tenant_country": "FR",
            "service_date": "2026-10-01",
            "tax_rate": 20,
            "vat_regime": "standard",
            "client_name": "SARL Martin",
            "client_street": "3 avenue Foch",
            "client_postal_code": "35200",
            "client_city": "Rennes",
        }

    def test_facture_complete_passe(self):
        self.assertEqual(issuer_issues(self._facture_complete(), "FR"), [])
        self.assertEqual(client_issues(self._facture_complete(), "FR"), [])

    def test_siren_manquant_bloque(self):
        inv = self._facture_complete()
        inv["tenant_legal_id"] = ""
        issues = issuer_issues(inv, "FR")
        self.assertTrue(any("SIREN" in i for i in issues))

    def test_date_de_prestation_manquante_bloque(self):
        inv = self._facture_complete()
        inv["service_date"] = None
        self.assertTrue(any("prestation" in i for i in issuer_issues(inv, "FR")))

    def test_taux_nul_sans_motif_bloque(self):
        inv = self._facture_complete()
        inv["tax_rate"] = 0
        inv["vat_regime"] = "standard"
        self.assertTrue(any("exonération" in i for i in issuer_issues(inv, "FR")))

    def test_taux_nul_avec_motif_passe(self):
        inv = self._facture_complete()
        inv["tax_rate"] = 0
        inv["vat_regime"] = "medical"
        self.assertEqual(issuer_issues(inv, "FR"), [])

    def test_avoir_sans_reference_bloque(self):
        inv = self._facture_complete()
        inv["document_type"] = "credit_note"
        self.assertTrue(any("avoir" in i for i in issuer_issues(inv, "FR")))

    def test_adresse_client_signalee_sans_bloquer(self):
        inv = self._facture_complete()
        inv["client_city"] = ""
        self.assertEqual(issuer_issues(inv, "FR"), [])          # ne bloque pas
        self.assertTrue(any("ville" in i for i in client_issues(inv, "FR")))

    def test_hors_france_aucun_controle(self):
        self.assertEqual(issuer_issues({}, "BE"), [])


class TestUbl(unittest.TestCase):
    def _invoice(self, **over) -> dict:
        base = {
            "id": "x", "number": "FAC-2026-0001", "currency": "EUR",
            "issue_date": date(2026, 10, 10), "service_date": date(2026, 10, 1),
            "due_date": date(2026, 11, 9),
            "subtotal": 100, "tax_rate": 20, "tax_amount": 20, "total": 120,
            "tenant_name": "Cabinet Dupont", "tenant_legal_id": "812345678",
            "tenant_street": "12 rue des Lilas", "tenant_postal_code": "35000",
            "tenant_city": "Rennes", "tenant_country": "FR",
            "tenant_vat": "FR12812345678",
            "client_name": "SARL Martin", "client_street": "3 avenue Foch",
            "client_postal_code": "35200", "client_city": "Rennes",
            "client_country": "FR", "client_email": "contact@martin.fr",
            "vat_regime": "standard",
        }
        base.update(over)
        return base

    def _lines(self) -> list[dict]:
        return [{"description": "Séance", "quantity": 1, "unit_price": 100,
                 "tax_rate": 20, "total": 120, "position": 0}]

    def test_donnees_obligatoires_en16931(self):
        xml = generate_invoice_ubl(self._invoice(), self._lines(), {}).decode()
        # BT-40 / BT-55 : le pays, absent de l'ancienne version
        self.assertIn("<cbc:IdentificationCode>FR</cbc:IdentificationCode>", xml)
        self.assertIn("<cbc:CityName>Rennes</cbc:CityName>", xml)
        self.assertIn("<cbc:PostalZone>35000</cbc:PostalZone>", xml)
        # BT-30 : identifiant légal du vendeur, avec son schéma SIRENE
        self.assertIn('schemeID="0002"', xml)
        self.assertIn("812345678", xml)

    def test_date_de_prestation_portee_en_tax_point(self):
        xml = generate_invoice_ubl(self._invoice(), self._lines(), {}).decode()
        self.assertIn("<cbc:TaxPointDate>2026-10-01</cbc:TaxPointDate>", xml)

    def test_facture_standard_type_380(self):
        xml = generate_invoice_ubl(self._invoice(), self._lines(), {}).decode()
        self.assertIn("<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>", xml)

    def test_avoir_type_381_avec_reference(self):
        inv = self._invoice(
            document_type="credit_note",
            credit_note_of_number="FAC-2026-0001",
            credit_note_of_date=date(2026, 10, 10),
            number="AV-2026-0001",
        )
        xml = generate_invoice_ubl(inv, self._lines(), {}).decode()
        self.assertIn("<cbc:InvoiceTypeCode>381</cbc:InvoiceTypeCode>", xml)
        self.assertIn("<cac:BillingReference>", xml)
        self.assertIn("FAC-2026-0001", xml)

    def test_exoneration_medicale_codee_correctement(self):
        inv = self._invoice(tax_rate=0, tax_amount=0, total=100, vat_regime="medical")
        lines = [{**self._lines()[0], "tax_rate": 0, "total": 100}]
        xml = generate_invoice_ubl(inv, lines, {}).decode()
        self.assertIn("VATEX-EU-132-1C", xml)
        self.assertNotIn("VATEX-EU-AE", xml)   # le bug corrigé
        self.assertIn("<cbc:ID>E</cbc:ID>", xml)

    def test_echappement_xml(self):
        inv = self._invoice(client_name='Martin & "Fils" <SARL>')
        xml = generate_invoice_ubl(inv, self._lines(), {}).decode()
        self.assertNotIn('<SARL>', xml)
        self.assertIn("&amp;", xml)

    def test_xml_bien_forme(self):
        import xml.etree.ElementTree as ET
        for regime in ("standard", "franchise", "medical", "reverse_charge", "export"):
            inv = self._invoice(vat_regime=regime, tax_rate=0 if regime != "standard" else 20)
            raw = generate_invoice_ubl(inv, self._lines(), {"bank_iban": "FR7612345", "bank_bic": "AGRIFRPP"})
            ET.fromstring(raw)   # lève si le XML est mal formé


if __name__ == "__main__":
    unittest.main()
