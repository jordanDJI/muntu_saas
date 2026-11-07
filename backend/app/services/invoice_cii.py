"""
XML CII (UN/CEFACT Cross Industry Invoice D16B), profil EN 16931 — le XML
embarqué dans une facture Factur-X (KLT-1120, KLT-1122).

Factur-X est le format hybride de la réforme française : un PDF lisible par un
humain, avec ce XML en pièce jointe, lisible par une machine. Klientys produit
le document ; sa transmission par une plateforme agréée (PDP) n'est pas couverte.

L'ordre des éléments est imposé par le schéma XSD : ne pas le réorganiser.
Le fichier est validé par `facturx` (XSD officiel) avant d'être intégré au PDF.

Avoirs (TypeCode 381) : en CII, le type porte le signe. Les lignes d'un avoir
Klientys étant stockées en négatif, les montants sont écrits en valeur absolue.
"""
from collections import OrderedDict
from datetime import date

from app.services.invoice_legal import penalty_notes, resolve_vat_regime

# Schéma d'identifiant légal (ISO 6523) : 0002 = SIRENE (France).
_LEGAL_ID_SCHEME = {"FR": "0002", "BE": "0208"}

NS = (
    'xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" '
    'xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" '
    'xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" '
    'xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"'
)


def _esc(v) -> str:
    if v is None:
        return ""
    return (
        str(v).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        .replace('"', "&quot;").replace("'", "&apos;")
    )


def _num(v, default: float = 0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _amt(v) -> str:
    return f"{_num(v):.2f}"


def _qty(v) -> str:
    q = _num(v, 1.0)
    return f"{q:.4f}".rstrip("0").rstrip(".") or "0"


def _rate(v) -> str:
    return f"{_num(v):.2f}"


def _d102(d) -> str:
    """Date au format 102 (AAAAMMJJ)."""
    if not d:
        return ""
    if isinstance(d, date):
        return d.strftime("%Y%m%d")
    return str(d)[:10].replace("-", "")


def _country(v) -> str:
    c = str(v or "").strip().upper()
    return c[:2] if len(c) >= 2 else ""


def _party(tag: str, name: str, legal_id: str, street: str, postal: str, city: str,
           country: str, vat: str, email: str = "") -> str:
    scheme = _LEGAL_ID_SCHEME.get(country, "")
    legal = ""
    if legal_id:
        attr = f' schemeID="{scheme}"' if scheme else ""
        legal = f"<ram:SpecifiedLegalOrganization><ram:ID{attr}>{_esc(legal_id)}</ram:ID></ram:SpecifiedLegalOrganization>"
    addr = "<ram:PostalTradeAddress>"
    if postal:
        addr += f"<ram:PostcodeCode>{_esc(postal)}</ram:PostcodeCode>"
    if street:
        addr += f"<ram:LineOne>{_esc(street)}</ram:LineOne>"
    if city:
        addr += f"<ram:CityName>{_esc(city)}</ram:CityName>"
    addr += f"<ram:CountryID>{country}</ram:CountryID></ram:PostalTradeAddress>"
    uri = f'<ram:URIUniversalCommunication><ram:URIID schemeID="EM">{_esc(email)}</ram:URIID></ram:URIUniversalCommunication>' if email else ""
    tax = f'<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">{_esc(vat)}</ram:ID></ram:SpecifiedTaxRegistration>' if vat else ""
    return f"<ram:{tag}><ram:Name>{_esc(name)}</ram:Name>{legal}{addr}{uri}{tax}</ram:{tag}>"


def generate_invoice_cii(invoice: dict, lines: list[dict], settings: dict) -> bytes:
    """
    invoice  : ligne de la table invoice (identités figées à l'émission)
    lines    : invoice_line
    settings : invoice_settings du tenant (repli pour les champs absents)
    Retourne les octets UTF-8 du XML.
    """
    settings = settings or {}
    currency = invoice.get("currency") or "EUR"
    is_credit = invoice.get("document_type") == "credit_note"
    sign = -1.0 if is_credit else 1.0  # remet les montants d'un avoir en positif
    vat_regime = invoice.get("vat_regime")

    s_country = _country(invoice.get("tenant_country") or settings.get("address_country")) or "FR"
    c_country = _country(invoice.get("client_country")) or s_country

    # ── Lignes, et ventilation de TVA par (catégorie, taux) ──────────────────
    lines_xml = ""
    breakdown: "OrderedDict[tuple[str, str], dict]" = OrderedDict()
    line_total_sum = 0.0
    for i, line in enumerate(sorted(lines, key=lambda x: x.get("position", 0)), start=1):
        qty = _num(line.get("quantity"), 1.0)
        price = _num(line.get("unit_price"))
        line_total = round(sign * qty * price, 2)
        if line_total < 0:  # ligne négative sur une facture : on garde le signe sur la quantité
            qty, price = -qty, abs(price)
        else:
            qty, price = abs(qty), abs(price)
        line_total_sum += line_total
        line_rate = line.get("tax_rate") if line.get("tax_rate") is not None else invoice.get("tax_rate")
        reg = resolve_vat_regime(vat_regime, line_rate)
        key = (reg["category"], _rate(line_rate))
        b = breakdown.setdefault(key, {"basis": 0.0, "regime": reg, "rate": _num(line_rate)})
        b["basis"] += line_total
        lines_xml += (
            "<ram:IncludedSupplyChainTradeLineItem>"
            f"<ram:AssociatedDocumentLineDocument><ram:LineID>{i}</ram:LineID></ram:AssociatedDocumentLineDocument>"
            f"<ram:SpecifiedTradeProduct><ram:Name>{_esc(line.get('description') or '—')}</ram:Name></ram:SpecifiedTradeProduct>"
            "<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice>"
            f"<ram:ChargeAmount>{_amt(price)}</ram:ChargeAmount>"
            "</ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>"
            f'<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">{_qty(qty)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>'
            "<ram:SpecifiedLineTradeSettlement>"
            "<ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode>"
            f"<ram:CategoryCode>{reg['category']}</ram:CategoryCode>"
            f"<ram:RateApplicablePercent>{_rate(line_rate)}</ram:RateApplicablePercent></ram:ApplicableTradeTax>"
            "<ram:SpecifiedTradeSettlementLineMonetarySummation>"
            f"<ram:LineTotalAmount>{_amt(line_total)}</ram:LineTotalAmount>"
            "</ram:SpecifiedTradeSettlementLineMonetarySummation>"
            "</ram:SpecifiedLineTradeSettlement>"
            "</ram:IncludedSupplyChainTradeLineItem>"
        )

    # Avec une seule ventilation, on reprend la TVA enregistrée sur la facture :
    # le XML doit dire exactement ce que dit le PDF.
    tax_total = 0.0
    for b in breakdown.values():
        b["tax"] = round(b["basis"] * b["rate"] / 100, 2)
    if len(breakdown) == 1 and invoice.get("tax_amount") is not None:
        only = next(iter(breakdown.values()))
        only["tax"] = round(abs(_num(invoice.get("tax_amount"))), 2) if is_credit else round(_num(invoice.get("tax_amount")), 2)
    for b in breakdown.values():
        tax_total += b["tax"]
    line_total_sum = round(line_total_sum, 2)
    tax_total = round(tax_total, 2)
    grand_total = round(line_total_sum + tax_total, 2)

    taxes_xml = ""
    for (category, _), b in breakdown.items():
        reg = b["regime"]
        reason = f"<ram:ExemptionReason>{_esc(reg['mention'])}</ram:ExemptionReason>" if reg["mention"] else ""
        reason_code = f"<ram:ExemptionReasonCode>{reg['exemption_code']}</ram:ExemptionReasonCode>" if reg["exemption_code"] else ""
        taxes_xml += (
            "<ram:ApplicableTradeTax>"
            f"<ram:CalculatedAmount>{_amt(b['tax'])}</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode>{reason}"
            f"<ram:BasisAmount>{_amt(b['basis'])}</ram:BasisAmount><ram:CategoryCode>{category}</ram:CategoryCode>{reason_code}"
            f"<ram:RateApplicablePercent>{_rate(b['rate'])}</ram:RateApplicablePercent>"
            "</ram:ApplicableTradeTax>"
        )

    # ── Notes : commentaire libre et mentions de pénalités typées ────────────
    notes_xml = ""
    if invoice.get("notes"):
        notes_xml += f"<ram:IncludedNote><ram:Content>{_esc(invoice['notes'])}</ram:Content></ram:IncludedNote>"
    for code, text in penalty_notes(invoice.get("legal_mentions") or {}, s_country):
        notes_xml += f"<ram:IncludedNote><ram:Content>{_esc(text)}</ram:Content><ram:SubjectCode>{code}</ram:SubjectCode></ram:IncludedNote>"

    seller = _party(
        "SellerTradeParty",
        invoice.get("tenant_name") or settings.get("company_name") or "",
        invoice.get("tenant_legal_id") or settings.get("legal_id") or "",
        invoice.get("tenant_street") or invoice.get("tenant_address") or "",
        invoice.get("tenant_postal_code") or "", invoice.get("tenant_city") or "",
        s_country, invoice.get("tenant_vat") or settings.get("vat_number") or "",
    )
    buyer = _party(
        "BuyerTradeParty",
        invoice.get("client_name") or "",
        invoice.get("client_legal_id") or "",
        invoice.get("client_street") or invoice.get("client_address") or "",
        invoice.get("client_postal_code") or "", invoice.get("client_city") or "",
        c_country, invoice.get("client_vat") or "", invoice.get("client_email") or "",
    )

    service = _d102(invoice.get("service_date"))
    delivery = (
        "<ram:ApplicableHeaderTradeDelivery>"
        + (f'<ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">{service}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>' if service else "")
        + "</ram:ApplicableHeaderTradeDelivery>"
    )

    iban = (settings.get("bank_iban") or "").replace(" ", "")
    bic = (settings.get("bank_bic") or "").replace(" ", "")
    payment_means = ""
    if iban:
        payment_means = (
            "<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>30</ram:TypeCode>"
            f"<ram:PayeePartyCreditorFinancialAccount><ram:IBANID>{_esc(iban)}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount>"
            + (f"<ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>{_esc(bic)}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>" if bic else "")
            + "</ram:SpecifiedTradeSettlementPaymentMeans>"
        )

    due = _d102(invoice.get("due_date"))
    terms = ""
    if invoice.get("payment_terms") or due:
        terms = (
            "<ram:SpecifiedTradePaymentTerms>"
            + (f"<ram:Description>{_esc(invoice['payment_terms'])}</ram:Description>" if invoice.get("payment_terms") else "")
            + (f'<ram:DueDateDateTime><udt:DateTimeString format="102">{due}</udt:DateTimeString></ram:DueDateDateTime>' if due else "")
            + "</ram:SpecifiedTradePaymentTerms>"
        )

    # BT-25 : facture corrigée par l'avoir
    referenced = ""
    if is_credit and invoice.get("credit_note_of_number"):
        ref_date = _d102(invoice.get("credit_note_of_date"))
        referenced = (
            "<ram:InvoiceReferencedDocument>"
            f"<ram:IssuerAssignedID>{_esc(invoice['credit_note_of_number'])}</ram:IssuerAssignedID>"
            + (f'<ram:FormattedIssueDateTime><qdt:DateTimeString format="102">{ref_date}</qdt:DateTimeString></ram:FormattedIssueDateTime>' if ref_date else "")
            + "</ram:InvoiceReferencedDocument>"
        )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f"<rsm:CrossIndustryInvoice {NS}>"
        "<rsm:ExchangedDocumentContext>"
        "<ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>"
        "</rsm:ExchangedDocumentContext>"
        "<rsm:ExchangedDocument>"
        f"<ram:ID>{_esc(invoice.get('number') or '')}</ram:ID>"
        f"<ram:TypeCode>{'381' if is_credit else '380'}</ram:TypeCode>"
        f'<ram:IssueDateTime><udt:DateTimeString format="102">{_d102(invoice.get("issue_date"))}</udt:DateTimeString></ram:IssueDateTime>'
        f"{notes_xml}"
        "</rsm:ExchangedDocument>"
        "<rsm:SupplyChainTradeTransaction>"
        f"{lines_xml}"
        f"<ram:ApplicableHeaderTradeAgreement>{seller}{buyer}</ram:ApplicableHeaderTradeAgreement>"
        f"{delivery}"
        "<ram:ApplicableHeaderTradeSettlement>"
        f"<ram:InvoiceCurrencyCode>{currency}</ram:InvoiceCurrencyCode>"
        f"{payment_means}{taxes_xml}{terms}"
        "<ram:SpecifiedTradeSettlementHeaderMonetarySummation>"
        f"<ram:LineTotalAmount>{_amt(line_total_sum)}</ram:LineTotalAmount>"
        f"<ram:TaxBasisTotalAmount>{_amt(line_total_sum)}</ram:TaxBasisTotalAmount>"
        f'<ram:TaxTotalAmount currencyID="{currency}">{_amt(tax_total)}</ram:TaxTotalAmount>'
        f"<ram:GrandTotalAmount>{_amt(grand_total)}</ram:GrandTotalAmount>"
        f"<ram:DuePayableAmount>{_amt(grand_total)}</ram:DuePayableAmount>"
        "</ram:SpecifiedTradeSettlementHeaderMonetarySummation>"
        f"{referenced}"
        "</ram:ApplicableHeaderTradeSettlement>"
        "</rsm:SupplyChainTradeTransaction>"
        "</rsm:CrossIndustryInvoice>"
    )
    return xml.encode("utf-8")
