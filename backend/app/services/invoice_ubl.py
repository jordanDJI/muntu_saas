"""
Génération XML UBL 2.1 (Invoice) conforme EN 16931.

UBL 2.1 est l'un des trois formats du socle de la réforme française, avec
Factur-X et CII. Klientys génère le document ; sa transmission par une
plateforme de dématérialisation partenaire (PDP) n'est pas couverte ici.

Attention aux données que la norme rend obligatoires et qu'il est tentant de
laisser vides : le pays du vendeur et de l'acheteur (BT-40 / BT-55) et
l'identifiant légal du vendeur (BT-30, le SIREN en France). Un fichier sans
elles est rejeté par un validateur, même s'il s'ouvre correctement.
"""
from datetime import date

from app.services.invoice_legal import resolve_vat_regime


def _iso(d) -> str:
    if not d:
        return ""
    if isinstance(d, date):
        return d.isoformat()
    return str(d)[:10]


def _safe(v) -> str:
    if v is None:
        return ""
    return (
        str(v)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def _amt(v, currency: str = "EUR") -> str:
    """Formatte un montant en décimal avec 2 décimales."""
    try:
        return f"{float(v):.2f}"
    except Exception:
        return "0.00"


def _country(v) -> str:
    """Code pays ISO 3166-1 alpha-2, en majuscules."""
    c = (str(v or "")).strip().upper()
    return c[:2] if len(c) >= 2 else ""


# Schéma d'identifiant légal selon le pays (liste ISO 6523 utilisée par Peppol).
# 0002 = SIRENE (France), 0208 = n° d'entreprise belge.
_LEGAL_ID_SCHEME = {"FR": "0002", "BE": "0208"}


def _party_xml(tag: str, name: str, street: str, postal: str, city: str,
               country: str, vat: str, legal_id: str, endpoint: str = "") -> str:
    """Bloc Party commun au fournisseur et au client."""
    scheme = _LEGAL_ID_SCHEME.get(country, "")
    scheme_attr = f' schemeID="{scheme}"' if scheme else ""

    endpoint_xml = ""
    if endpoint:
        endpoint_xml = f'\n      <cbc:EndpointID schemeID="EM">{endpoint}</cbc:EndpointID>'

    vat_xml = ""
    if vat:
        vat_xml = (
            "\n      <cac:PartyTaxScheme>"
            f"\n        <cbc:CompanyID>{vat}</cbc:CompanyID>"
            "\n        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>"
            "\n      </cac:PartyTaxScheme>"
        )

    legal_id_xml = ""
    if legal_id:
        legal_id_xml = f"\n        <cbc:CompanyID{scheme_attr}>{legal_id}</cbc:CompanyID>"

    return f"""  <cac:{tag}>
    <cac:Party>{endpoint_xml}
      <cac:PartyName><cbc:Name>{name}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>{street}</cbc:StreetName>
        <cbc:CityName>{city}</cbc:CityName>
        <cbc:PostalZone>{postal}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>{country}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>{vat_xml}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>{name}</cbc:RegistrationName>{legal_id_xml}
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:{tag}>"""


def generate_invoice_ubl(invoice: dict, lines: list[dict], settings: dict) -> bytes:
    """
    Génère un fichier XML UBL 2.1 conforme EN 16931.
    invoice  : dict de la table invoice
    lines    : liste des invoice_line
    settings : invoice_settings du tenant
    Retourne les bytes UTF-8 du XML.
    """
    currency  = invoice.get("currency", "EUR")
    inv_num   = _safe(invoice.get("number", ""))
    issue     = _iso(invoice.get("issue_date"))
    due       = _iso(invoice.get("due_date"))
    service   = _iso(invoice.get("service_date"))
    subtotal  = _amt(invoice.get("subtotal", 0))
    tax_amt   = _amt(invoice.get("tax_amount", 0))
    total     = _amt(invoice.get("total", 0))
    tax_rate  = _amt(invoice.get("tax_rate", 0))
    notes     = _safe(invoice.get("notes", ""))

    is_credit_note = invoice.get("document_type") == "credit_note"
    # BT-3 : 380 facture, 381 avoir.
    type_code = "381" if is_credit_note else "380"

    regime = resolve_vat_regime(invoice.get("vat_regime"), invoice.get("tax_rate"))

    # Fournisseur (tenant) — le pays retombe sur FR puis BE seulement si rien
    # n'est renseigné, pour ne pas produire un fichier sans BT-40.
    s_name   = _safe(invoice.get("tenant_name") or settings.get("company_name") or "")
    s_street = _safe(invoice.get("tenant_street") or invoice.get("tenant_address") or "")
    s_post   = _safe(invoice.get("tenant_postal_code") or "")
    s_city   = _safe(invoice.get("tenant_city") or "")
    s_ctry   = _country(invoice.get("tenant_country") or settings.get("address_country"))
    s_vat    = _safe(invoice.get("tenant_vat") or settings.get("vat_number") or "")
    s_legal  = _safe(invoice.get("tenant_legal_id") or settings.get("legal_id") or "")

    # Client
    c_name   = _safe(invoice.get("client_name") or "")
    c_street = _safe(invoice.get("client_street") or invoice.get("client_address") or "")
    c_post   = _safe(invoice.get("client_postal_code") or "")
    c_city   = _safe(invoice.get("client_city") or "")
    c_ctry   = _country(invoice.get("client_country")) or s_ctry
    c_vat    = _safe(invoice.get("client_vat") or "")
    c_legal  = _safe(invoice.get("client_legal_id") or "")
    c_email  = _safe(invoice.get("client_email") or "")

    # Coordonnées bancaires
    iban = _safe(settings.get("bank_iban") or "")
    bic  = _safe(settings.get("bank_bic") or "")

    # ── Lignes de facture ─────────────────────────────────────────────────────
    lines_xml = ""
    for i, line in enumerate(sorted(lines, key=lambda x: x.get("position", 0)), start=1):
        desc   = _safe(line.get("description", ""))
        qty    = _amt(line.get("quantity", 1))
        price  = _amt(line.get("unit_price", 0))
        lr     = _amt(line.get("tax_rate", 0))
        try:
            line_net = f"{float(line.get('unit_price', 0)) * float(line.get('quantity', 1)):.2f}"
        except Exception:
            line_net = price

        line_regime = resolve_vat_regime(invoice.get("vat_regime"), line.get("tax_rate"))
        line_exempt = ""
        if line_regime["exemption_code"]:
            line_exempt = (
                f'\n        <cbc:TaxExemptionReasonCode>{line_regime["exemption_code"]}'
                f"</cbc:TaxExemptionReasonCode>"
            )

        lines_xml += f"""
  <cac:InvoiceLine>
    <cbc:ID>{i}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="EA">{qty}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="{currency}">{line_net}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>{desc}</cbc:Description>
      <cbc:Name>{desc}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>{line_regime["category"]}</cbc:ID>
        <cbc:Percent>{lr}</cbc:Percent>{line_exempt}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="{currency}">{price}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>"""

    # ── Référence à la facture corrigée (obligatoire sur un avoir) ────────────
    billing_ref = ""
    if is_credit_note and invoice.get("credit_note_of_number"):
        ref_date = _iso(invoice.get("credit_note_of_date"))
        ref_date_xml = f"\n      <cbc:IssueDate>{ref_date}</cbc:IssueDate>" if ref_date else ""
        billing_ref = f"""
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>{_safe(invoice["credit_note_of_number"])}</cbc:ID>{ref_date_xml}
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>"""

    # ── Moyens et conditions de paiement ──────────────────────────────────────
    payment_means = ""
    if iban:
        bic_node = (
            "\n      <cac:FinancialInstitutionBranch>"
            f"\n        <cbc:ID>{bic}</cbc:ID>"
            "\n      </cac:FinancialInstitutionBranch>"
        ) if bic else ""
        payment_means = f"""
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>{iban}</cbc:ID>{bic_node}
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>"""

    payment_terms_xml = ""
    if invoice.get("payment_terms"):
        payment_terms_xml = f"""
  <cac:PaymentTerms>
    <cbc:Note>{_safe(invoice["payment_terms"])}</cbc:Note>
  </cac:PaymentTerms>"""

    due_node   = f"\n  <cbc:DueDate>{due}</cbc:DueDate>" if due else ""
    notes_node = f"\n  <cbc:Note>{notes}</cbc:Note>" if notes else ""
    # BT-7 : date à laquelle la TVA devient exigible, c'est-à-dire la date de
    # la prestation — distincte de la date d'émission.
    tax_point  = f"\n  <cbc:TaxPointDate>{service}</cbc:TaxPointDate>" if service else ""

    exemption_xml = ""
    if regime["exemption_code"]:
        exemption_xml = (
            f'\n        <cbc:TaxExemptionReasonCode>{regime["exemption_code"]}'
            "</cbc:TaxExemptionReasonCode>"
        )
    if regime["mention"]:
        exemption_xml += (
            f'\n        <cbc:TaxExemptionReason>{_safe(regime["mention"])}'
            "</cbc:TaxExemptionReason>"
        )

    supplier_xml = _party_xml(
        "AccountingSupplierParty", s_name, s_street, s_post, s_city, s_ctry,
        s_vat, s_legal,
    )
    customer_xml = _party_xml(
        "AccountingCustomerParty", c_name, c_street, c_post, c_city, c_ctry,
        c_vat, c_legal, endpoint=c_email,
    )

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">

  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>

  <cbc:ID>{inv_num}</cbc:ID>
  <cbc:IssueDate>{issue}</cbc:IssueDate>{due_node}
  <cbc:InvoiceTypeCode>{type_code}</cbc:InvoiceTypeCode>{tax_point}
  <cbc:DocumentCurrencyCode>{currency}</cbc:DocumentCurrencyCode>{notes_node}{billing_ref}

  <!-- Fournisseur (tenant) -->
{supplier_xml}

  <!-- Client -->
{customer_xml}
{payment_means}{payment_terms_xml}
  <!-- TVA -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="{currency}">{tax_amt}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="{currency}">{subtotal}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="{currency}">{tax_amt}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>{regime["category"]}</cbc:ID>
        <cbc:Percent>{tax_rate}</cbc:Percent>{exemption_xml}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <!-- Montants -->
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="{currency}">{subtotal}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="{currency}">{subtotal}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="{currency}">{total}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="{currency}">{total}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
{lines_xml}
</Invoice>"""

    return xml.encode("utf-8")
