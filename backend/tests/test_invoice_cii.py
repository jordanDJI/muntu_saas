"""
Tests du XML CII / Factur-X (services/invoice_cii.py, KLT-1120 / KLT-1122).

Validation contre le XSD officiel Factur-X EN 16931 fourni par la bibliothèque
`factur-x`. Les règles métier EN 16931 (schématron) ne sont pas vérifiées ici :
elles demandent un serveur Saxon.

Lancement :
    cd backend && python -m unittest discover -s tests -v
"""
import io
import os
import unittest

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

import facturx  # noqa: E402
from lxml import etree  # noqa: E402

from app.services.invoice_cii import generate_invoice_cii  # noqa: E402

RAM = "{urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100}"
SETTINGS = {"bank_iban": "FR76 3000 6000 0112 3456 7890 189", "bank_bic": "AGRIFRPP"}

BASE = {
    "number": "F-2026-0001", "issue_date": "2026-11-03", "due_date": "2026-12-03",
    "service_date": "2026-11-02", "currency": "EUR",
    "tenant_name": "Cabinet Test", "tenant_legal_id": "131374936", "tenant_street": "1 rue A",
    "tenant_postal_code": "13001", "tenant_city": "Marseille", "tenant_country": "FR",
    "tenant_vat": "FR12131374936",
    "client_name": "Maison <Les Pins> & Cie", "client_street": "2 rue B", "client_postal_code": "75001",
    "client_city": "Paris", "client_country": "FR", "client_email": "compta@pins.fr",
    "payment_terms": "30 jours", "legal_mentions": {"late_penalty_rate": 10, "recovery_fee": 40},
}


def _xml(invoice, lines):
    return generate_invoice_cii({**BASE, **invoice}, lines, SETTINGS)


def _find(xml: bytes, path: str):
    return etree.fromstring(xml).findall(".//" + "/".join(RAM + p for p in path.split("/")))


class CiiXsdTest(unittest.TestCase):
    def test_standard_invoice_is_valid(self):
        xml = _xml({"tax_rate": 20, "tax_amount": 24, "vat_regime": "standard"},
                   [{"position": 1, "description": "Soin", "quantity": 2, "unit_price": 60, "tax_rate": 20}])
        facturx.xml_check_xsd(xml, flavor="factur-x", level="en16931")
        self.assertEqual(_find(xml, "GrandTotalAmount")[0].text, "144.00")
        self.assertEqual(_find(xml, "TaxTotalAmount")[0].text, "24.00")

    def test_franchise_declares_exemption(self):
        xml = _xml({"tax_rate": 0, "tax_amount": 0, "vat_regime": "franchise"},
                   [{"position": 1, "description": "Séance", "quantity": 1, "unit_price": 50, "tax_rate": 0}])
        facturx.xml_check_xsd(xml, flavor="factur-x", level="en16931")
        tax = _find(xml, "ApplicableHeaderTradeSettlement/ApplicableTradeTax")[0]
        self.assertEqual(tax.find(RAM + "CategoryCode").text, "E")
        self.assertEqual(tax.find(RAM + "ExemptionReasonCode").text, "VATEX-FR-FRANCHISE")

    def test_credit_note_is_positive_and_references_invoice(self):
        xml = _xml({"number": "AV-2026-0001", "document_type": "credit_note", "credit_note_of_number": "F-2026-0001",
                    "credit_note_of_date": "2026-11-03", "tax_rate": 20, "tax_amount": -24, "vat_regime": "standard"},
                   [{"position": 1, "description": "Soin", "quantity": 2, "unit_price": -60, "tax_rate": 20}])
        facturx.xml_check_xsd(xml, flavor="factur-x", level="en16931")
        self.assertIn(b"<ram:TypeCode>381</ram:TypeCode>", xml)
        self.assertEqual(_find(xml, "GrandTotalAmount")[0].text, "144.00")
        self.assertEqual(_find(xml, "InvoiceReferencedDocument/IssuerAssignedID")[0].text, "F-2026-0001")

    def test_mixed_rates_have_one_breakdown_each(self):
        xml = _xml({"tax_rate": 20, "tax_amount": None, "vat_regime": "standard"}, [
            {"position": 1, "description": "A", "quantity": 1, "unit_price": 100, "tax_rate": 20},
            {"position": 2, "description": "B", "quantity": 1, "unit_price": 100, "tax_rate": 10},
        ])
        facturx.xml_check_xsd(xml, flavor="factur-x", level="en16931")
        self.assertEqual(len(_find(xml, "ApplicableHeaderTradeSettlement/ApplicableTradeTax")), 2)
        self.assertEqual(_find(xml, "TaxTotalAmount")[0].text, "30.00")

    def test_french_penalty_notes_are_typed(self):
        xml = _xml({"tax_rate": 20, "tax_amount": 20}, [{"position": 1, "description": "X", "quantity": 1, "unit_price": 100, "tax_rate": 20}])
        codes = [n.text for n in _find(xml, "IncludedNote/SubjectCode")]
        self.assertEqual(codes, ["PMD", "PMT", "AAB"])

    def test_special_characters_are_escaped(self):
        xml = _xml({"tax_rate": 20, "tax_amount": 20}, [{"position": 1, "description": "a < b & c", "quantity": 1, "unit_price": 100, "tax_rate": 20}])
        etree.fromstring(xml)  # lève si mal formé
        self.assertIn(b"Maison &lt;Les Pins&gt; &amp; Cie", xml)


class FacturxEmbedTest(unittest.TestCase):
    def test_xml_is_embedded_in_pdf(self):
        from pypdf import PdfWriter
        buf = io.BytesIO()
        w = PdfWriter()
        w.add_blank_page(width=595, height=842)
        w.write(buf)
        xml = _xml({"tax_rate": 20, "tax_amount": 20}, [{"position": 1, "description": "X", "quantity": 1, "unit_price": 100, "tax_rate": 20}])
        pdf = facturx.generate_from_binary(buf.getvalue(), xml, flavor="factur-x", level="en16931", check_xsd=True)
        name, extracted = facturx.get_xml_from_pdf(pdf, check_xsd=True)
        self.assertEqual(name, "factur-x.xml")
        self.assertEqual(extracted, xml)


if __name__ == "__main__":
    unittest.main()
