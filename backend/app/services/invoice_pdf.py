"""
Génération PDF de factures.
Moteur 1 : WeasyPrint (qualité optimale — Linux/Docker prod).
Moteur 2 : xhtml2pdf (fallback pur Python — Windows dev et prod si WeasyPrint KO).
WeasyPrint requiert GTK3/Pango non disponibles sur Windows sans installation manuelle.
On saute WeasyPrint directement sur Windows pour éviter les warnings ctypes.
"""
import io
import platform
import logging
from datetime import date

_log = logging.getLogger(__name__)

# ── Détection moteur PDF ──────────────────────────────────────────────────────

def _try_weasyprint():
    if platform.system() == "Windows":
        return None  # GTK3 non disponible sur Windows sans installation manuelle
    try:
        from weasyprint import HTML as _W
        _W(string="<p>ok</p>").write_pdf()
        return _W
    except Exception:
        return None

def _try_xhtml2pdf():
    try:
        from xhtml2pdf import pisa as _P
        return _P
    except Exception:
        return None

_WP   = _try_weasyprint()
_PISA = _try_xhtml2pdf() if _WP is None else None

if _WP:
    _log.info("Invoice PDF engine: WeasyPrint")
elif _PISA:
    _log.info("Invoice PDF engine: xhtml2pdf")
else:
    _log.warning("Invoice PDF engine: aucun moteur — pip install xhtml2pdf")


# ── Palette Klientys (fallback si le tenant n'a pas de couleur) ───────────────
_NAVY  = "#07222F"
_TEAL  = "#0D4B58"
_TEAL2 = "#1A6E82"
_GOLD  = "#DDAA40"
_BG    = "#F0F4F8"
_TEXT  = "#1E3A4A"
_MUTED = "#6B8A9A"
_BORD  = "#DDE5EC"
_WHITE = "#FFFFFF"

# Couleurs primaires (hero = fond header, mid = thead tableau)
_BRAND_DARK: dict[str, str] = {
    "indigo": "#312e81", "blue": "#1e3a8a", "green": "#14532d",
    "teal": "#134e4a", "purple": "#581c87", "pink": "#831843",
    "orange": "#7c2d12", "red": "#7f1d1d", "yellow": "#713f12",
    "gray": "#1f2937", "slate": "#1e293b", "cyan": "#164e63",
    "emerald": "#14532d", "violet": "#4c1d95", "rose": "#881337",
    "amber": "#78350f", "sky": "#0c4a6e", "lime": "#365314",
}
_BRAND_MID: dict[str, str] = {
    "indigo": "#4f46e5", "blue": "#2563eb", "green": "#16a34a",
    "teal": "#0d9488", "purple": "#7c3aed", "pink": "#db2777",
    "orange": "#ea580c", "red": "#dc2626", "yellow": "#ca8a04",
    "gray": "#6b7280", "slate": "#475569", "cyan": "#0891b2",
    "emerald": "#059669", "violet": "#7c3aed", "rose": "#e11d48",
    "amber": "#d97706", "sky": "#0284c7", "lime": "#65a30d",
}

def _brand_colors(settings: dict) -> tuple[str, str]:
    """Retourne (header_bg, thead_bg) depuis la couleur du tenant ou Klientys."""
    c = (settings.get("_brand_color") or "").lower()
    return _BRAND_DARK.get(c, _NAVY), _BRAND_MID.get(c, _TEAL)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _esc(s: str | None) -> str:
    if not s:
        return ""
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )

def _fmt_amount(v) -> str:
    try:
        return f"{float(v):,.2f}".replace(",", " ").replace(".", ",")
    except Exception:
        return "0,00"

def _fmt_date(d) -> str:
    if not d:
        return "—"
    if isinstance(d, date):
        return d.strftime("%d/%m/%Y")
    try:
        return date.fromisoformat(str(d)).strftime("%d/%m/%Y")
    except Exception:
        return str(d)

def _status_label(status: str) -> tuple[str, str]:
    """Retourne (label, couleur) selon le statut."""
    return {
        "draft":     ("Brouillon",  "#9CA3AF"),
        "sent":      ("Envoyée",    "#3B82F6"),
        "paid":      ("Payée",      "#10B981"),
        "overdue":   ("En retard",  "#EF4444"),
        "cancelled": ("Annulée",    "#6B7280"),
    }.get(status, (status, _MUTED))


# ── Template HTML A4 ──────────────────────────────────────────────────────────

def _build_html(invoice: dict, lines: list[dict], settings: dict) -> str:
    status_label, status_color = _status_label(invoice.get("status", "draft"))
    currency = invoice.get("currency", "EUR")
    header_bg, thead_bg = _brand_colors(settings)

    # Infos tenant
    t_name    = _esc(invoice.get("tenant_name") or settings.get("company_name") or "")
    t_address = _esc(invoice.get("tenant_address") or "")
    t_vat     = _esc(invoice.get("tenant_vat") or settings.get("vat_number") or "")
    t_iban    = _esc(settings.get("bank_iban") or "")
    t_bic     = _esc(settings.get("bank_bic") or "")
    t_bank    = _esc(settings.get("bank_name") or "")
    t_footer  = _esc(settings.get("footer_note") or "")
    logo_url  = settings.get("_logo_url") or ""
    logo_opt  = settings.get("_logo_option") or "text_only"

    # Infos client
    c_name    = _esc(invoice.get("client_name") or "")
    c_address = _esc(invoice.get("client_address") or "")
    c_vat     = _esc(invoice.get("client_vat") or "")
    c_email   = _esc(invoice.get("client_email") or "")

    # Montants
    subtotal   = _fmt_amount(invoice.get("subtotal", 0))
    tax_rate   = invoice.get("tax_rate", 0)
    tax_amount = _fmt_amount(invoice.get("tax_amount", 0))
    total      = _fmt_amount(invoice.get("total", 0))

    # Lignes (6 colonnes : description / qté / PU HT / Total HT / TVA% / Total TTC)
    lines_html = ""
    for i, line in enumerate(sorted(lines, key=lambda x: x.get("position", 0))):
        bg = "#F9FBFC" if i % 2 == 0 else _WHITE
        qty = float(line.get("quantity", 1))
        pu  = float(line.get("unit_price", 0))
        ttx = float(line.get("tax_rate", 0))
        ht  = round(qty * pu, 2)
        tva_amt = round(ht * ttx / 100, 2)
        ttc = round(ht + tva_amt, 2)
        lines_html += f"""
        <tr style="background:{bg}">
          <td style="padding:8px 10px;font-size:11px;color:{_TEXT};border-bottom:1px solid {_BORD}">{_esc(line.get('description',''))}</td>
          <td style="padding:8px 10px;font-size:11px;color:{_MUTED};text-align:center;border-bottom:1px solid {_BORD}">{_fmt_amount(qty)}</td>
          <td style="padding:8px 10px;font-size:11px;color:{_TEXT};text-align:right;border-bottom:1px solid {_BORD};white-space:nowrap">{_fmt_amount(pu)} {currency}</td>
          <td style="padding:8px 10px;font-size:11px;color:{_TEXT};text-align:right;border-bottom:1px solid {_BORD};white-space:nowrap">{_fmt_amount(ht)} {currency}</td>
          <td style="padding:8px 10px;font-size:11px;color:{_MUTED};text-align:center;border-bottom:1px solid {_BORD};white-space:nowrap">{_fmt_amount(ttx)}%</td>
          <td style="padding:8px 10px;font-size:11px;font-weight:700;color:{thead_bg};text-align:right;border-bottom:1px solid {_BORD};white-space:nowrap">{_fmt_amount(ttc)} {currency}</td>
        </tr>"""

    # Bloc TVA dans les totaux (masqué si taux = 0)
    tva_row = ""
    if tax_rate and float(tax_rate) > 0:
        tva_row = f"""
        <tr style="border-bottom:1px solid {_BORD}">
          <td style="padding:6px 12px;font-size:11px;color:{_MUTED}">TVA ({_fmt_amount(tax_rate)}%)</td>
          <td style="padding:6px 12px;font-size:11px;color:{_TEXT};text-align:right;white-space:nowrap">{tax_amount} {currency}</td>
        </tr>"""

    # Bloc paiement
    payment_block = ""
    if t_iban:
        bic_line  = f" · BIC : {t_bic}" if t_bic else ""
        bank_line = f" · {t_bank}" if t_bank else ""
        payment_block = f"""
<div style="margin-top:16px;padding:10px 14px;background:{_BG};border-radius:6px;border:1px solid {_BORD}">
  <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:{_MUTED};margin-bottom:4px">Coordonnées bancaires</div>
  <div style="font-size:11px;color:{_TEXT}">IBAN : <strong>{t_iban}</strong>{bic_line}{bank_line}</div>
</div>"""

    # Notes
    notes_block = ""
    if invoice.get("notes"):
        notes_block = f"""
<div style="margin-top:12px;padding:10px 14px;background:#FFFBEB;border-radius:6px;border:1px solid #FDE68A">
  <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#92400E;margin-bottom:3px">Note</div>
  <div style="font-size:11px;color:#78350F">{_esc(invoice.get('notes',''))}</div>
</div>"""

    # Conditions de paiement
    terms_block = ""
    if invoice.get("payment_terms"):
        terms_block = f'<p style="font-size:10px;color:{_MUTED};margin-top:10px;font-style:italic">{_esc(invoice.get("payment_terms",""))}</p>'

    # Pied de page custom
    footer_custom = f' · {t_footer}' if t_footer else ""

    # Adresse client (nouvelles lignes pour le bloc Facturé à)
    c_details = ""
    if c_address:
        c_details += f'<div style="font-size:10px;color:{_MUTED}">{c_address}</div>'
    if c_vat:
        c_details += f'<div style="font-size:10px;color:{_MUTED}">TVA : {c_vat}</div>'
    if c_email:
        c_details += f'<div style="font-size:10px;color:{_MUTED}">{c_email}</div>'

    # Logo block
    logo_block = (
        f'<img src="{logo_url}" alt="{t_name}" style="max-height:54px;max-width:180px;object-fit:contain;display:block;margin-bottom:8px">'
        if logo_url and logo_opt not in ("text_only", "") else ""
    )

    # Statut badge (inline)
    badge = f'<span style="display:inline-block;background:{status_color}1a;color:{status_color};border:1px solid {status_color}55;border-radius:4px;padding:2px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px">{status_label}</span>'

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<style>
  @page {{ size: A4; margin: 18mm 18mm 22mm 18mm; }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: Arial, Helvetica, sans-serif; background: {_WHITE}; color: {_TEXT}; font-size: 11px; line-height: 1.5; }}
  table {{ border-collapse: collapse; width: 100%; }}
  .lbl {{ font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; color:{_MUTED}; margin-bottom:4px; }}
</style>
</head>
<body>

<!-- ── HEADER : logo gauche / titre droite ── -->
<table style="width:100%;margin-bottom:20px">
  <tr>
    <td style="width:55%;vertical-align:top;padding-right:20px">
      {logo_block}
      <div style="font-size:17px;font-weight:800;color:{header_bg}">{t_name}</div>
      {f'<div style="font-size:10px;color:{_MUTED};margin-top:3px">{t_address}</div>' if t_address else ''}
      {f'<div style="font-size:10px;color:{_MUTED}">TVA : {t_vat}</div>' if t_vat else ''}
    </td>
    <td style="width:45%;vertical-align:top;text-align:right">
      <div style="font-size:30px;font-weight:900;color:{header_bg};line-height:1">FACTURE</div>
      <div style="font-size:14px;font-weight:700;color:{thead_bg};margin-top:4px">N° {_esc(invoice.get('number',''))}</div>
      <div style="margin-top:10px;font-size:10px;color:{_MUTED}">
        Date d'émission : <strong style="color:{_TEXT}">{_fmt_date(invoice.get('issue_date'))}</strong>
      </div>
      {f'<div style="font-size:10px;color:{_MUTED}">Date d\'échéance : <strong style="color:{_TEXT}">{_fmt_date(invoice.get("due_date"))}</strong></div>' if invoice.get('due_date') else ''}
      <div style="margin-top:8px">{badge}</div>
    </td>
  </tr>
</table>

<!-- ── SÉPARATEUR ── -->
<div style="border-top:2px solid {thead_bg};margin-bottom:18px"></div>

<!-- ── EMETTEUR / CLIENT ── -->
<table style="width:100%;margin-bottom:24px">
  <tr>
    <td style="width:48%;vertical-align:top;padding-right:16px">
      <div class="lbl">Émetteur</div>
      <div style="font-weight:700;font-size:12px;color:{_TEXT}">{t_name}</div>
      {f'<div style="font-size:10px;color:{_MUTED}">{t_address}</div>' if t_address else ''}
      {f'<div style="font-size:10px;color:{_MUTED}">TVA : {t_vat}</div>' if t_vat else ''}
    </td>
    <td style="width:4%;border-left:1px solid {_BORD}"></td>
    <td style="width:48%;vertical-align:top;padding-left:16px">
      <div class="lbl">Facturé à</div>
      <div style="font-weight:700;font-size:12px;color:{_TEXT}">{c_name or '—'}</div>
      {c_details}
    </td>
  </tr>
</table>

<!-- ── TABLEAU DES PRESTATIONS ── -->
<table style="margin-bottom:0">
  <thead>
    <tr style="background:{_BG};border-top:2px solid {thead_bg};border-bottom:1px solid {_BORD}">
      <th style="padding:8px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:{thead_bg};text-align:left;width:44%">Description</th>
      <th style="padding:8px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:{thead_bg};text-align:center;width:8%">Qté</th>
      <th style="padding:8px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:{thead_bg};text-align:right;width:14%">PU HT</th>
      <th style="padding:8px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:{thead_bg};text-align:right;width:14%">Total HT</th>
      <th style="padding:8px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:{thead_bg};text-align:center;width:8%">TVA</th>
      <th style="padding:8px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:{thead_bg};text-align:right;width:12%">Total TTC</th>
    </tr>
  </thead>
  <tbody>
    {lines_html or f'<tr><td colspan="6" style="padding:14px 10px;color:{_MUTED};font-style:italic;font-size:11px">Aucune prestation renseignée.</td></tr>'}
  </tbody>
</table>

<!-- ── TOTAUX (droite) ── -->
<table style="width:260px;margin-left:auto;margin-top:12px;border:1px solid {_BORD};border-radius:6px">
  <tr>
    <td style="padding:7px 12px;font-size:11px;color:{_MUTED}">Sous-total HT</td>
    <td style="padding:7px 12px;font-size:11px;color:{_TEXT};text-align:right;white-space:nowrap">{subtotal} {currency}</td>
  </tr>
  {tva_row}
  <tr style="background:{_BG};border-top:2px solid {thead_bg}">
    <td style="padding:10px 12px;font-size:13px;font-weight:800;color:{header_bg}">Total TTC</td>
    <td style="padding:10px 12px;font-size:14px;font-weight:800;color:{thead_bg};text-align:right;white-space:nowrap">{total} {currency}</td>
  </tr>
</table>

{terms_block}
{payment_block}
{notes_block}

<!-- ── PIED DE PAGE ── -->
<div style="position:fixed;bottom:0;left:0;right:0;border-top:1px solid {_BORD};padding:7px 18mm;font-size:8px;color:{_MUTED};display:table;width:100%">
  <div style="display:table-cell">{t_name}{f' — {t_address}' if t_address else ''}{f' — TVA : {t_vat}' if t_vat else ''}{footer_custom}</div>
  <div style="display:table-cell;text-align:right">Facture {_esc(invoice.get('number',''))} · klientys.co</div>
</div>

</body>
</html>"""


# ── API publique ──────────────────────────────────────────────────────────────

def generate_invoice_pdf(invoice: dict, lines: list[dict], settings: dict) -> bytes:
    """
    Génère le PDF d'une facture (A4, branding Klientys + tenant).
    invoice  : dict avec les champs de la table invoice
    lines    : liste des invoice_line
    settings : invoice_settings du tenant
    """
    html = _build_html(invoice, lines, settings)

    if _WP is not None:
        buf = io.BytesIO()
        _WP(string=html).write_pdf(buf)
        return buf.getvalue()

    if _PISA is not None:
        buf = io.BytesIO()
        result = _PISA.CreatePDF(html, dest=buf)
        if result.err:
            raise RuntimeError(f"xhtml2pdf error: {result.err}")
        return buf.getvalue()

    raise RuntimeError(
        "Aucun moteur PDF disponible. "
        "Exécutez : pip install weasyprint xhtml2pdf"
    )
