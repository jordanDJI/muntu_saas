"""
Génération PDF des rapports analytics.

Moteurs (par ordre de préférence) :
  1. WeasyPrint  — meilleure qualité, requiert Pango/Cairo (Linux/Docker en prod)
  2. xhtml2pdf   — fallback pur Python, fonctionne partout (Windows dev)

Installation :
  pip install weasyprint xhtml2pdf
"""
import io
import logging
from datetime import datetime, timezone

_log = logging.getLogger(__name__)

# ── Détection des moteurs disponibles ────────────────────────────────────────

def _try_weasyprint():
    try:
        from weasyprint import HTML as _W
        # Test réel : génère un micro-PDF pour vérifier que Pango/Cairo sont là
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
_PISA = _try_xhtml2pdf() if _WP is None else None  # ne charge que si WeasyPrint KO

if _WP:
    _log.info("PDF engine: WeasyPrint")
elif _PISA:
    _log.info("PDF engine: xhtml2pdf (fallback)")
else:
    _log.warning("PDF engine: aucun moteur disponible — pip install weasyprint xhtml2pdf")


# ── Palette Klientys ──────────────────────────────────────────────────────────
_NAVY  = "#07222F"
_TEAL  = "#0D4B58"
_TEAL2 = "#1A6E82"
_GOLD  = "#DDAA40"
_BG    = "#F0F4F8"
_TEXT  = "#1E3A4A"
_MUTED = "#6B8A9A"
_BORD  = "#DDE5EC"

# ── Dictionnaires labels / couleurs ──────────────────────────────────────────
_SOURCE_LABELS = {
    "site_form": "Formulaire site", "website": "Site internet",
    "dashboard": "Dashboard", "contact_form": "Formulaire contact",
    "booking": "Réservation", "inconnu": "Inconnu",
    "Bouche à oreille": "Bouche à oreille",
    "Google / Recherche en ligne": "Google / Recherche",
    "Réseaux sociaux": "Réseaux sociaux",
    "Recommandation": "Recommandation",
    "Flyer / Affiche": "Flyer / Affiche",
    "Autre": "Autre",
}
_LEAD_STATUS_LABELS = {
    "new": "Nouveau", "contacted": "Contacté", "qualified": "Qualifié",
    "scheduled": "RDV planifié", "closed_won": "Gagné",
    "closed_lost": "Perdu", "inconnu": "Inconnu",
}
_LEAD_STATUS_COLORS = {
    "new": _TEAL, "contacted": "#4E7EA8", "qualified": "#6B8A7A",
    "scheduled": "#1A7A8F", "closed_won": "#1D7A4A",
    "closed_lost": "#BF3333", "inconnu": "#AAB0C0",
}
_APPT_STATUS_LABELS = {"confirmed": "Confirmé", "pending": "En attente", "cancelled": "Annulé"}
_APPT_STATUS_COLORS = {"confirmed": "#22c55e", "pending": "#f59e0b", "cancelled": "#ef4444"}

_SECTION_LABELS = {
    "hero": "Accueil", "a-propos": "À propos", "prestations": "Prestations",
    "contact": "Contact", "galerie": "Galerie", "temoignages": "Témoignages",
    "services": "Services", "about": "À propos", "footer": "Pied de page",
}
_SECTION_COLORS = {
    "hero": "#4E7EA8", "a-propos": "#6B8A7A", "prestations": "#0D4B58",
    "contact": "#1D7A4A", "galerie": "#7C5DBF", "temoignages": "#C47B1E",
    "services": "#1A7A8F", "about": "#6B8A7A", "footer": "#AAB0C0",
}
_CTA_LABELS = {
    "phone": "Téléphone", "email": "Email",
    "social_facebook": "Facebook", "social_instagram": "Instagram",
    "social_linkedin": "LinkedIn", "chatbot": "Chatbot",
    "booking": "Réservation", "autre": "Autre",
}


# ── Helpers HTML ──────────────────────────────────────────────────────────────

def _n(v: int) -> str:
    return f"{v:,}".replace(",", " ")  # espace fine comme séparateur milliers


def _empty(text: str = "Aucune donnée.") -> str:
    return f'<p style="color:{_MUTED};font-style:italic;font-size:10px;margin:4px 0">{text}</p>'


def _bar_html(items: list) -> str:
    """Barres horizontales (label, val, color) — compatible WeasyPrint ET xhtml2pdf."""
    if not items:
        return _empty()
    max_v = max((v for _, v, _ in items), default=1) or 1
    rows = []
    for label, val, color in items:
        pct = max(2, int(val / max_v * 75))
        short = label[:22] + ("…" if len(label) > 22 else "")
        rows.append(
            f'<tr>'
            f'<td style="font-size:10px;color:{_MUTED};white-space:nowrap;padding:3px 8px 3px 0;width:115px">{short}</td>'
            f'<td style="padding:3px 0">'
            f'  <table style="border-collapse:collapse;width:100%"><tr>'
            f'    <td style="background:{color};height:12px;border-radius:3px;width:{pct}%"></td>'
            f'    <td></td>'
            f'  </tr></table>'
            f'</td>'
            f'<td style="font-size:10px;font-weight:bold;color:{_TEXT};white-space:nowrap;padding:3px 0 3px 8px;text-align:right">{val}</td>'
            f'</tr>'
        )
    return f'<table style="width:100%;border-collapse:collapse">{"".join(rows)}</table>'


def _section_bar_html(items: list, pageviews: int) -> str:
    """Barres sections avec point coloré + % des vues — fidèle à la UI."""
    if not items:
        return _empty("Aucune section trackée.")
    max_v = max((v for _, v, _ in items), default=1) or 1
    rows = []
    for label, val, color in items:
        bar_pct = max(2, int(val / max_v * 100))
        view_pct = round(val / pageviews * 100) if pageviews > 0 else 0
        short = label[:20] + ("…" if len(label) > 20 else "")
        rows.append(
            f'<tr>'
            f'<td style="padding:3px 0 3px 0;width:12px;vertical-align:middle">'
            f'<div style="width:10px;height:10px;border-radius:3px;background:{color};display:inline-block"></div>'
            f'</td>'
            f'<td style="font-size:10px;color:{_TEXT};padding:3px 6px;white-space:nowrap;vertical-align:middle">{short}</td>'
            f'<td style="padding:3px 4px;vertical-align:middle">'
            f'<table style="border-collapse:collapse;width:100%"><tr>'
            f'<td style="background:{color};height:10px;border-radius:3px;width:{bar_pct}%"></td>'
            f'<td></td></tr></table>'
            f'</td>'
            f'<td style="font-size:10px;font-weight:bold;color:{_TEXT};white-space:nowrap;padding:3px 4px;text-align:right;vertical-align:middle">{val}</td>'
            f'<td style="font-size:9px;color:{_MUTED};white-space:nowrap;padding:3px 0 3px 4px;text-align:right;vertical-align:middle">{view_pct}%</td>'
            f'</tr>'
        )
    # Résumé: section la plus visitée
    top_label, top_val, top_color = items[0]
    top_pct = round(top_val / pageviews * 100) if pageviews > 0 else 0
    summary = (
        f'<div style="border-top:1px solid {_BORD};margin-top:8px;padding-top:6px;'
        f'display:table;width:100%">'
        f'<div style="display:table-cell;font-size:9px;color:{_MUTED}">Section la + visitée</div>'
        f'<div style="display:table-cell;text-align:right;font-size:9px;font-weight:700;color:{_TEXT}">'
        f'<span style="display:inline-block;width:8px;height:8px;border-radius:50%;'
        f'background:{top_color};margin-right:3px;vertical-align:middle"></span>'
        f'{top_label} <span style="color:{_MUTED};font-weight:400">({top_pct}% des vues)</span>'
        f'</div></div>'
    )
    return f'<table style="width:100%;border-collapse:collapse">{"".join(rows)}</table>{summary}'


def _kpi_cell(value: str, label: str, color: str = _NAVY, sub: str = "", width: str = "20%") -> str:
    sub_html = f'<div style="font-size:9px;color:{_MUTED};margin-top:2px">{sub}</div>' if sub else ""
    return (
        f'<td style="padding:10px 12px;background:#fff;border-radius:8px;'
        f'border:1px solid {_BORD};text-align:center;width:{width}">'
        f'<div style="font-size:9px;font-weight:700;text-transform:uppercase;'
        f'letter-spacing:.8px;color:{_MUTED};margin-bottom:3px">{label}</div>'
        f'<div style="font-size:20px;font-weight:800;color:{color};line-height:1">{value}</div>'
        f'{sub_html}'
        f'</td>'
    )


def _funnel_cell(value: str, label: str, color: str, rate_str: str = "") -> str:
    rate_html = (
        f'<div style="font-size:8px;color:{_MUTED};margin-top:1px">{rate_str}</div>'
        if rate_str else ""
    )
    return (
        f'<td style="text-align:center;padding:0 3px">'
        f'<div style="font-size:15px;font-weight:800;color:#fff;background:{color};'
        f'border-radius:6px;padding:7px 6px;line-height:1">{value}</div>'
        f'<div style="font-size:9px;color:{_MUTED};margin-top:3px;font-weight:600">{label}</div>'
        f'{rate_html}'
        f'</td>'
    )


def _pct_str(a: int, b: int) -> str:
    return f"{round(a / b * 100)}% du préc." if b > 0 else ""


# ── Template HTML ─────────────────────────────────────────────────────────────

def _build_html(tenant_name: str, period_label: str, summary: dict) -> str:
    s = summary
    appts_by_status: dict = s.get("appointments_by_status", {})
    leads_by_source: dict = s.get("leads_by_source", {})
    leads_by_status: dict = s.get("leads_by_status", {})
    sections_viewed: dict = s.get("sections_viewed", {})
    cta_clicks:      dict = s.get("cta_clicks", {})

    confirmed      = appts_by_status.get("confirmed", 0)
    conv_appt      = s.get("conversion_appt_rate")
    pv             = s.get("pageviews", 0)
    sessions       = s.get("unique_sessions", 0)
    leads_total    = s.get("leads_total", 0)
    appts_total    = s.get("appointments_total", 0)
    contacts_total = s.get("contacts_total", 0)
    chatbot_conv   = s.get("chatbot_conversations", 0)
    chatbot_msg    = s.get("chatbot_messages", 0)
    form_opens     = s.get("form_opens", 0)
    form_submits   = s.get("form_submits", 0)
    has_beh        = pv > 0
    generated_at   = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")

    # ── Items pour les barres ─────────────────────────────────────────────────
    source_items = [
        (_SOURCE_LABELS.get(k, k), v, _TEAL2)
        for k, v in sorted(leads_by_source.items(), key=lambda x: -x[1])
    ]
    status_items = [
        (_LEAD_STATUS_LABELS.get(k, k), v, _LEAD_STATUS_COLORS.get(k, _MUTED))
        for k, v in sorted(leads_by_status.items(), key=lambda x: -x[1])
    ]
    appt_items = [
        (_APPT_STATUS_LABELS.get(k, k), v, _APPT_STATUS_COLORS.get(k, _MUTED))
        for k, v in sorted(appts_by_status.items(), key=lambda x: -x[1])
    ]
    section_items = [
        (_SECTION_LABELS.get(k, k), v, _SECTION_COLORS.get(k, "#0891b2"))
        for k, v in sorted(sections_viewed.items(), key=lambda x: -x[1])
    ]
    cta_items = [
        (_CTA_LABELS.get(k, k), v, "#f59e0b")
        for k, v in sorted(cta_clicks.items(), key=lambda x: -x[1])
    ]

    # ── Helpers de mise en page ───────────────────────────────────────────────
    def sec(title: str, content: str) -> str:
        return (
            f'<div style="margin-bottom:18px">'
            f'<p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;'
            f'color:{_MUTED};border-bottom:1px solid {_BORD};padding-bottom:5px;margin:0 0 10px">{title}</p>'
            f'{content}'
            f'</div>'
        )

    def card(title: str, content: str) -> str:
        return (
            f'<div style="background:#fff;border-radius:8px;padding:12px 14px;border:1px solid {_BORD}">'
            f'<p style="font-size:10px;font-weight:700;color:{_TEXT};margin:0 0 10px">{title}</p>'
            f'{content}'
            f'</div>'
        )

    def card_plain(content: str) -> str:
        return (
            f'<div style="background:#fff;border-radius:8px;padding:14px;border:1px solid {_BORD}">'
            f'{content}'
            f'</div>'
        )

    def two_col(left: str, right: str) -> str:
        return (
            f'<table style="width:100%;border-collapse:separate;border-spacing:10px 0">'
            f'<tr>'
            f'<td style="width:50%;vertical-align:top">{left}</td>'
            f'<td style="width:50%;vertical-align:top">{right}</td>'
            f'</tr></table>'
        )

    # ── 5 KPIs ────────────────────────────────────────────────────────────────
    kpis = (
        f'<table style="width:100%;border-collapse:separate;border-spacing:6px 0"><tr>'
        + _kpi_cell(
            _n(pv) if has_beh else "—", "Vues de page", "#4E7EA8",
            f"{_n(sessions)} sessions" if has_beh else "Tracking non actif",
        )
        + _kpi_cell(_n(leads_total),  "Demandes",    _TEAL,    "sur la période")
        + _kpi_cell(_n(appts_total),  "Rendez-vous", "#1D7A4A", f"{_n(confirmed)} confirmés")
        + _kpi_cell(_n(contacts_total), "Contacts",  "#4A6757", "total CRM")
        + _kpi_cell(
            f"{conv_appt}%" if conv_appt is not None else "—",
            "Conversion", _GOLD, "Dem. → RDV",
          )
        + f'</tr></table>'
    )

    # ── Entonnoir ─────────────────────────────────────────────────────────────
    steps = [
        (pv,          "Vues",          "#4E7EA8"),
        (form_opens,  "Form. ouvert",  "#2E94A8"),
        (form_submits,"Soumis",        "#1A7A8F"),
        (leads_total, "Demandes",      _TEAL),
        (confirmed,   "RDV confirmés", "#1D7A4A"),
    ]
    funnel_row = ""
    prev = 0
    for i, (v, lbl, col) in enumerate(steps):
        rate = _pct_str(v, prev) if i > 0 else ""
        funnel_row += _funnel_cell(_n(v), lbl, col, rate)
        if i < len(steps) - 1:
            funnel_row += (
                f'<td style="color:#C9D5DE;text-align:center;font-size:12px;'
                f'padding:0 1px;padding-bottom:16px">&rarr;</td>'
            )
        prev = v
    funnel = (
        f'<table style="width:100%;border-collapse:separate;border-spacing:2px 0">'
        f'<tr>{funnel_row}</tr></table>'
    )
    if not has_beh:
        funnel += (
            f'<p style="margin-top:8px;font-size:9px;color:#92752D;background:#FEF3C7;'
            f'border-radius:5px;padding:5px 8px">Les premières étapes (Vues, Form. ouvert, '
            f'Soumis) seront remplies dès les premières visites sur votre site.</p>'
        )

    # ── Chatbot ───────────────────────────────────────────────────────────────
    if has_beh:
        msg_per_conv = f"{chatbot_msg / chatbot_conv:.1f}" if chatbot_conv > 0 else "—"
        engage_rate  = f"{round(chatbot_conv / pv * 100)}%" if pv > 0 else "—"
        chatbot_grid = (
            f'<table style="width:100%;border-collapse:separate;border-spacing:6px 0"><tr>'
            f'<td style="background:#EBF3F5;border-radius:8px;padding:10px;text-align:center">'
            f'<div style="font-size:18px;font-weight:800;color:{_TEAL}">{_n(chatbot_conv)}</div>'
            f'<div style="font-size:9px;color:{_TEAL2};margin-top:3px">Conversations</div>'
            f'</td>'
            f'<td style="background:#F3EDFB;border-radius:8px;padding:10px;text-align:center">'
            f'<div style="font-size:18px;font-weight:800;color:#7C5DBF">{_n(chatbot_msg)}</div>'
            f'<div style="font-size:9px;color:#7C5DBF;margin-top:3px">Messages</div>'
            f'</td>'
            f'</tr></table>'
        )
        chatbot_details = (
            f'<div style="border-top:1px solid {_BORD};margin-top:10px;padding-top:8px">'
            f'<table style="width:100%;border-collapse:collapse">'
            f'<tr><td style="font-size:9px;color:{_MUTED};padding:2px 0">Messages / conversation</td>'
            f'<td style="font-size:9px;font-weight:700;color:{_TEXT};text-align:right">{msg_per_conv}</td></tr>'
            f'<tr><td style="font-size:9px;color:{_MUTED};padding:2px 0">Taux engagement chatbot</td>'
            f'<td style="font-size:9px;font-weight:700;color:{_TEXT};text-align:right">{engage_rate}</td></tr>'
            f'</table></div>'
        ) if chatbot_conv > 0 else ""
        chatbot_html = chatbot_grid + chatbot_details
    else:
        chatbot_html = _empty("Tracking non actif — les données apparaîtront dès les premières visites.")

    # ── Sections consultées ───────────────────────────────────────────────────
    sections_html = (
        _section_bar_html(section_items, pv) if has_beh
        else _empty("Tracking non actif.")
    )

    # ── Clics & interactions ──────────────────────────────────────────────────
    cta_html = (
        _bar_html(cta_items) if (has_beh and cta_items)
        else _empty("Aucun clic enregistré." if has_beh else "Tracking non actif.")
    )

    # ── Assembly ──────────────────────────────────────────────────────────────
    body = (
        sec("Vue d&apos;ensemble", kpis)
        + sec("Entonnoir de conversion", card_plain(funnel))
        + sec("Demandes", two_col(
            card("Par source", _bar_html(source_items)),
            card("Pipeline des demandes", _bar_html(status_items)),
        ))
        + sec("Rendez-vous &amp; Chatbot", two_col(
            card("Rendez-vous par statut", _bar_html(appt_items)),
            card("Activit&eacute; chatbot IA", chatbot_html),
        ))
        + sec("Comportement site", two_col(
            card("Sections les plus consult&eacute;es", sections_html),
            card("Clics &amp; interactions", cta_html),
        ))
    )

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<style>
  @page {{ size: A4; margin: 0; }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: Arial, Helvetica, sans-serif; background: {_BG}; color: {_TEXT}; font-size: 12px; }}
</style>
</head>
<body>

<!-- En-tête navy -->
<div style="background:{_NAVY};color:#fff;padding:22px 36px 18px">
  <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:{_GOLD};text-transform:uppercase;margin-bottom:5px">
    Klientys &middot; Rapport Analytics
  </div>
  <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:3px">{tenant_name}</div>
  <div style="font-size:11px;color:rgba(255,255,255,.6)">P&eacute;riode&nbsp;: {period_label}</div>
</div>

<!-- Corps -->
<div style="padding:18px 36px 12px">
{body}
</div>

<!-- Pied de page -->
<div style="background:{_NAVY};padding:10px 36px;display:table;width:100%">
  <div style="display:table-cell;font-size:9px;color:rgba(255,255,255,.4)">Klientys &middot; klientys.co</div>
  <div style="display:table-cell;text-align:right;font-size:9px;color:rgba(255,255,255,.4)">G&eacute;n&eacute;r&eacute; le {generated_at}</div>
</div>

</body>
</html>"""


# ── Public API ────────────────────────────────────────────────────────────────

def generate_report_pdf(
    tenant_name: str,
    period_label: str,
    summary: dict,
) -> bytes:
    """
    Génère le rapport analytics en PDF.
    Utilise WeasyPrint si disponible, sinon xhtml2pdf.
    Retourne les bytes du PDF.
    """
    html = _build_html(tenant_name, period_label, summary)

    # ── Moteur 1 : WeasyPrint ─────────────────────────────────────────────────
    if _WP is not None:
        buf = io.BytesIO()
        _WP(string=html).write_pdf(buf)
        return buf.getvalue()

    # ── Moteur 2 : xhtml2pdf (fallback Windows / environnements sans GTK) ─────
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
