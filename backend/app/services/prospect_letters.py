"""
Courriers de prospection pour les entreprises nouvellement immatriculées (migration 088).

Un PDF, une page par entreprise, prêt à imprimer pour une enveloppe à fenêtre :
expéditeur en haut à gauche, destinataire à droite, QR code vers Klientys.

Le pied de page donne l'information exigée par l'article 14 du RGPD quand les données
ne sont pas collectées auprès de la personne : origine (base SIRENE), finalité, base
légale, durée de conservation, droits et contact. La durée annoncée (6 mois) est celle
appliquée par sirene.purge_stale.

Le modèle est modifiable depuis /admin/acquisition (system_config « prospect_letter »).
"""
from __future__ import annotations

import html
from datetime import date

SYSTEM_CONFIG_KEY = "prospect_letter"

MONTHS = ("janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
          "septembre", "octobre", "novembre", "décembre")

# « Les personnes qui cherchent {activite} à {ville} »
ACTIVITY_PHRASE = {
    "health": "un professionnel de santé", "beauty": "un salon ou un institut",
    "coaching": "un coach", "finance": "un conseiller", "trade": "un artisan",
    "restaurant": "un restaurant", "commerce": "un commerce",
}

DEFAULT_BODY = """Félicitations pour le lancement de {nom}.

Dans les premières semaines d'une activité, une question compte plus que les autres : les personnes qui cherchent {activite} à {ville} vous trouvent-elles, et peuvent-elles vous contacter facilement ?

Klientys vous permet, sans compétence technique et en une quinzaine de minutes, d'avoir :
- un site professionnel à votre nom ;
- la prise de rendez-vous ou les demandes de devis en ligne ;
- le suivi de vos clients au même endroit.

Vous pouvez l'essayer gratuitement pendant 14 jours, sans carte bancaire.

Nous restons disponibles pour vous aider à démarrer."""


def default_template(frontend_url: str) -> dict:
    return {
        "brand": "Klientys",
        "sender_lines": "ADUMIS\n14 rue Villa Oddo\n13015 Marseille",
        "sender_email": "support@klientys.co",
        "sender_phone": "",
        "place": "Marseille",
        "subject": "Votre site et vos rendez-vous en ligne, dès le lancement de {nom}",
        "body": DEFAULT_BODY,
        "cta": "Scannez ce code pour découvrir Klientys, ou rendez-vous sur klientys.co",
        "signature": "L'équipe Klientys",
        "controller": "ADUMIS, éditeur de Klientys, 14 rue Villa Oddo, 13015 Marseille (SIREN 131 374 936)",
        "qr_url": f"{frontend_url.rstrip('/')}/?utm_source=courrier&utm_medium=qr&utm_campaign=nouvelles-entreprises",
    }


def merge_template(saved: dict | None, frontend_url: str) -> dict:
    """Modèle enregistré, complété par les valeurs par défaut pour les champs absents ou vides."""
    base = default_template(frontend_url)
    for key, value in (saved or {}).items():
        if key in base and isinstance(value, str) and value.strip():
            base[key] = value
    return base


def city_label(city: str | None) -> str:
    """« SAINT-ETIENNE » → « Saint-Etienne » (SIRENE écrit les communes en capitales)."""
    if not city:
        return ""
    return " ".join("-".join(p.capitalize() for p in w.split("-")) for w in city.lower().split())


def placeholders(prospect: dict) -> dict:
    city = city_label(prospect.get("city"))
    # Entrepreneur individuel (catégorie juridique 1000) : le « nom » est souvent celui de la
    # personne — « le lancement de Claire MARTIN » sonnerait faux.
    is_individual = prospect.get("legal_category") == "1000"
    return {
        "nom": "votre activité" if is_individual or not prospect.get("name") else prospect["name"],
        "ville": city or "près de chez vous",
        "activite": ACTIVITY_PHRASE.get(prospect.get("sector") or "", "un professionnel"),
    }


def fill(text: str, values: dict) -> str:
    """Remplace {nom}, {ville}, {activite} ; les autres accolades restent telles quelles."""
    for key, value in values.items():
        text = text.replace("{" + key + "}", value)
    return text


def french_date(day: date) -> str:
    return f"{day.day}{'er' if day.day == 1 else ''} {MONTHS[day.month - 1]} {day.year}"


def _paragraphs(text: str) -> str:
    """Texte → HTML : paragraphes séparés par une ligne vide, lignes « - » en liste."""
    out = []
    for block in [b.strip() for b in text.split("\n\n") if b.strip()]:
        lines = [l.strip() for l in block.split("\n") if l.strip()]
        intro = [l for l in lines if not l.startswith("- ")]
        items = [l[2:] for l in lines if l.startswith("- ")]
        if intro:
            out.append("<p>" + "<br/>".join(html.escape(l) for l in intro) + "</p>")
        if items:
            out.append("<ul>" + "".join(f"<li>{html.escape(i)}</li>" for i in items) + "</ul>")
    return "".join(out)


def _lines(text: str) -> str:
    return "<br/>".join(html.escape(l.strip()) for l in (text or "").splitlines() if l.strip())


def qr_data_uri(url: str) -> str:
    import segno
    return segno.make(url, error="m").png_data_uri(scale=6, border=2, dark="#07222F")


def letter_html(prospect: dict, template: dict, today: date, qr_uri: str) -> str:
    values = placeholders(prospect)
    recipient = [prospect.get("name") or "", prospect.get("street") or "",
                 " ".join(filter(None, [prospect.get("postal_code"), (prospect.get("city") or "").upper()]))]
    contact = " · ".join(filter(None, [template["sender_email"], template.get("sender_phone")]))
    return f"""
<div class="letter">
  <table class="head"><tr>
    <td class="sender">
      <div class="brand">{html.escape(template["brand"])}</div>
      <div>{_lines(template["sender_lines"])}</div>
      <div>{html.escape(contact)}</div>
    </td>
    <td class="recipient">{_lines(chr(10).join(recipient))}</td>
  </tr></table>
  <p class="date">{html.escape(template["place"])}, le {french_date(today)}</p>
  <p><b>Objet :</b> {html.escape(fill(template["subject"], values))}</p>
  <p>Madame, Monsieur,</p>
  {_paragraphs(fill(template["body"], values))}
  <table class="cta"><tr>
    <td class="cta-text">{html.escape(fill(template["cta"], values))}</td>
    <td class="cta-qr"><img src="{qr_uri}" width="104" height="104"/></td>
  </tr></table>
  <p>Bien cordialement,</p>
  <p class="signature">{html.escape(template["signature"])}</p>
  <div class="footer">
    <b>Pourquoi recevez-vous ce courrier ?</b> Le nom et l'adresse de votre entreprise proviennent de la
    base SIRENE de l'INSEE, qui publie les entreprises nouvellement créées. {html.escape(template["controller"])}
    les utilise pour vous présenter ses services, au titre de son intérêt légitime, et les supprime au plus
    tard 6 mois après ce courrier si vous ne donnez pas suite. Pour ne plus recevoir de courrier de notre part,
    ou pour exercer vos droits d'accès, de rectification, d'effacement et d'opposition :
    {html.escape(template["sender_email"])}. Vous pouvez aussi adresser une réclamation à la CNIL (cnil.fr).
  </div>
</div>"""


def letters_html(prospects: list[dict], template: dict, today: date) -> str:
    qr_uri = qr_data_uri(template["qr_url"])
    pages = '<div class="break"></div>'.join(letter_html(p, template, today, qr_uri) for p in prospects)
    return f"""<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
  @page {{ size: A4; margin: 16mm 18mm 14mm 20mm; }}
  body {{ font-family: Helvetica, Arial, sans-serif; font-size: 10.5pt; color: #1E3A4A; line-height: 1.45; }}
  .break {{ page-break-after: always; }}
  table {{ width: 100%; border-collapse: collapse; }}
  td {{ vertical-align: top; }}
  .sender {{ width: 55%; font-size: 9pt; color: #4A6573; }}
  .brand {{ font-size: 19pt; font-weight: bold; color: #0D4B58; margin-bottom: 4px; }}
  .recipient {{ width: 45%; padding-top: 26mm; font-size: 10.5pt; color: #07222F; }}
  .date {{ text-align: right; margin-top: 12mm; }}
  ul {{ margin: 0 0 8px 0; }}
  li {{ margin-bottom: 2px; }}
  .cta {{ margin: 10px 0 6px 0; }}
  .cta-text {{ vertical-align: middle; font-weight: bold; color: #0D4B58; padding-right: 12px; }}
  .cta-qr {{ width: 34mm; text-align: right; }}
  .signature {{ font-weight: bold; color: #07222F; }}
  .footer {{ margin-top: 14px; padding-top: 6px; border-top: 1px solid #DDE5EC; font-size: 7.5pt; color: #6B8A9A; line-height: 1.35; }}
</style></head>
<body>{pages}</body></html>"""


def generate_letters_pdf(prospects: list[dict], template: dict, today: date | None = None) -> bytes:
    from app.services.invoice_pdf import html_to_pdf
    return html_to_pdf(letters_html(prospects, template, today or date.today()))
