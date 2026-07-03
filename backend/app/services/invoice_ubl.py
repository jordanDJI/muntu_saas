"""
Génération XML UBL 2.1 (Invoice) conforme EN 16931.
Utilisé pour la facturation électronique B2B EU — aucun agrément requis côté Klientys
(génération uniquement, pas de transmission réseau).
"""
from datetime import date


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
    subtotal  = _amt(invoice.get("subtotal", 0))
    tax_amt   = _amt(invoice.get("tax_amount", 0))
    total     = _amt(invoice.get("total", 0))
    tax_rate  = _amt(invoice.get("tax_rate", 0))
    notes     = _safe(invoice.get("notes", ""))

    # Supplier (tenant)
    s_name    = _safe(invoice.get("tenant_name") or settings.get("company_name") or "")
    s_addr    = _safe(invoice.get("tenant_address") or "")
    s_vat     = _safe(invoice.get("tenant_vat") or settings.get("vat_number") or "")

    # Customer (client)
    c_name    = _safe(invoice.get("client_name") or "")
    c_addr    = _safe(invoice.get("client_address") or "")
    c_vat     = _safe(invoice.get("client_vat") or "")

    # Payment means (IBAN)
    iban      = _safe(settings.get("bank_iban") or "")
    bic       = _safe(settings.get("bank_bic") or "")

    # ── Lignes de facture ─────────────────────────────────────────────────────
    lines_xml = ""
    for i, line in enumerate(sorted(lines, key=lambda x: x.get("position", 0)), start=1):
        desc   = _safe(line.get("description", ""))
        qty    = _amt(line.get("quantity", 1))
        price  = _amt(line.get("unit_price", 0))
        lr     = _amt(line.get("tax_rate", 0))
        ltotal = _amt(line.get("total", 0))
        # Prix HT ligne = total / (1 + tax_rate/100) — ou unit_price * qty
        try:
            line_net = f"{float(line.get('unit_price', 0)) * float(line.get('quantity', 1)):.2f}"
        except Exception:
            line_net = price

        lines_xml += f"""
  <cac:InvoiceLine>
    <cbc:ID>{i}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="EA">{qty}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="{currency}">{line_net}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>{desc}</cbc:Description>
      <cbc:Name>{desc}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>{lr}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="{currency}">{price}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>"""

    # ── Conditions de paiement ────────────────────────────────────────────────
    payment_means = ""
    if iban:
        bic_node = f"\n      <cbc:PaymentChannelCode>{bic}</cbc:PaymentChannelCode>" if bic else ""
        payment_means = f"""
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>{iban}</cbc:ID>{bic_node}
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>"""

    due_node = f"\n  <cbc:DueDate>{due}</cbc:DueDate>" if due else ""
    notes_node = f"\n  <cbc:Note>{notes}</cbc:Note>" if notes else ""

    # TVA exemption si taux = 0
    try:
        tax_rate_val = float(invoice.get("tax_rate", 0))
    except Exception:
        tax_rate_val = 0.0

    if tax_rate_val > 0:
        tax_category_id = "S"
        tax_exemption = ""
    else:
        tax_category_id = "Z"
        tax_exemption = "\n        <cbc:TaxExemptionReasonCode>VATEX-EU-AE</cbc:TaxExemptionReasonCode>"

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">

  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>

  <cbc:ID>{inv_num}</cbc:ID>
  <cbc:IssueDate>{issue}</cbc:IssueDate>{due_node}
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>{currency}</cbc:DocumentCurrencyCode>{notes_node}

  <!-- Fournisseur (tenant) -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>{s_name}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>{s_addr}</cbc:StreetName>
      </cac:PostalAddress>
      {f'<cac:PartyTaxScheme><cbc:CompanyID>{s_vat}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>' if s_vat else ''}
      <cac:PartyLegalEntity><cbc:RegistrationName>{s_name}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <!-- Client -->
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>{c_name}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>{c_addr}</cbc:StreetName>
      </cac:PostalAddress>
      {f'<cac:PartyTaxScheme><cbc:CompanyID>{c_vat}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>' if c_vat else ''}
      <cac:PartyLegalEntity><cbc:RegistrationName>{c_name}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
{payment_means}
  <!-- TVA -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="{currency}">{tax_amt}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="{currency}">{subtotal}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="{currency}">{tax_amt}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>{tax_category_id}</cbc:ID>
        <cbc:Percent>{tax_rate}</cbc:Percent>{tax_exemption}
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
