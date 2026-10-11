"""
Règles légales de facturation (France en premier lieu).

Fonctions pures, sans accès base : testables directement et réutilisées par le
générateur PDF, le générateur UBL et l'API.

Trois sujets y vivent :
  - le régime de TVA, qui détermine à la fois le code EN 16931 et la mention
    à imprimer sur la facture ;
  - les mentions obligatoires françaises (pénalités de retard, indemnité de
    recouvrement, identité de l'émetteur, assurance) ;
  - le contrôle de conformité avant émission.
"""
from datetime import date, timedelta


# ── Régimes de TVA ────────────────────────────────────────────────────────────
#
# Le code EN 16931 et la mention légale vont par paire : écrire "0 %" sans dire
# pourquoi rend la facture non conforme, et annoncer le mauvais motif est pire
# que n'en annoncer aucun. Le défaut historique du module codait VATEX-EU-AE
# (autoliquidation) pour tout taux nul, c'est-à-dire pour des kinés et des
# auto-entrepreneurs qui ne sont pas du tout dans ce cas.
#
# category : code de catégorie TVA EN 16931 (BT-118)
#   S  = taux normal · E = exonéré · AE = autoliquidation
#   G  = export hors UE · K = livraison intracommunautaire · Z = taux zéro
# exemption_code : liste VATEX (BT-121)

VAT_REGIMES: dict[str, dict] = {
    "standard": {
        "label": "Régime normal de TVA",
        "category": "S",
        "exemption_code": "",
        "mention": "",
    },
    "franchise": {
        "label": "Franchise en base de TVA",
        "category": "E",
        "exemption_code": "VATEX-FR-FRANCHISE",
        "mention": "TVA non applicable, article 293 B du CGI.",
    },
    "medical": {
        "label": "Exonération — actes médicaux et paramédicaux",
        "category": "E",
        "exemption_code": "VATEX-EU-132-1C",
        "mention": "Exonération de TVA, article 261-4-1° du CGI.",
    },
    "reverse_charge": {
        "label": "Autoliquidation",
        "category": "AE",
        "exemption_code": "VATEX-EU-AE",
        "mention": "Autoliquidation — article 283-2 du CGI. TVA due par le preneur.",
    },
    "intracom": {
        "label": "Livraison intracommunautaire",
        "category": "K",
        "exemption_code": "VATEX-EU-IC",
        "mention": "Exonération de TVA, article 262 ter I du CGI.",
    },
    "export": {
        "label": "Exportation hors Union européenne",
        "category": "G",
        "exemption_code": "VATEX-EU-G",
        "mention": "Exonération de TVA, article 262 I du CGI.",
    },
}

DEFAULT_RECOVERY_FEE = 40.0  # art. L441-10 du code de commerce

# Mention de repli quand le professionnel n'a pas fixé son propre taux : c'est
# le taux légal supplétif, pas une valeur inventée.
_DEFAULT_PENALTY_WORDING = (
    "En cas de retard de paiement, application d'intérêts au taux appliqué par "
    "la Banque centrale européenne à son opération de refinancement la plus "
    "récente, majoré de 10 points de pourcentage."
)


def resolve_vat_regime(vat_regime: str | None, tax_rate: float | int | None) -> dict:
    """
    Régime applicable à une facture.

    Un taux strictement positif l'emporte sur le réglage : on ne déclare pas une
    exonération sur une facture qui facture effectivement de la TVA.
    """
    try:
        rate = float(tax_rate or 0)
    except (TypeError, ValueError):
        rate = 0.0

    if rate > 0:
        return VAT_REGIMES["standard"]

    key = (vat_regime or "").strip().lower()
    if key in VAT_REGIMES and key != "standard":
        return VAT_REGIMES[key]

    # Taux nul sans régime déclaré : on ne devine pas de motif d'exonération.
    # "Z" (taux zéro) sans code VATEX est le seul choix qui n'affirme rien de
    # faux ; le contrôle de conformité le signale par ailleurs.
    return {
        "label": "Taux zéro — motif non précisé",
        "category": "Z",
        "exemption_code": "",
        "mention": "",
    }


# ── Mentions légales ──────────────────────────────────────────────────────────

def build_legal_mentions(settings: dict) -> dict:
    """
    Fige les mentions légales au moment de l'émission.

    Stocké sur la facture (colonne legal_mentions) : si le professionnel change
    son taux de pénalités l'an prochain, les factures déjà émises gardent le
    taux qui y figurait.
    """
    s = settings or {}

    def _num(key, default=None):
        try:
            v = s.get(key)
            return float(v) if v not in (None, "") else default
        except (TypeError, ValueError):
            return default

    return {
        "late_penalty_rate": _num("late_penalty_rate"),
        "recovery_fee": _num("recovery_fee", DEFAULT_RECOVERY_FEE),
        "legal_form": s.get("legal_form") or "",
        "share_capital": s.get("share_capital") or "",
        "rcs_city": s.get("rcs_city") or "",
        "insurance_name": s.get("insurance_name") or "",
        "insurance_coverage": s.get("insurance_coverage") or "",
        "no_discount": bool(s.get("no_early_payment_discount", True)),
    }


def penalty_mentions(mentions: dict, country: str = "FR") -> list[str]:
    """
    Mentions de retard de paiement à imprimer.

    Obligatoires entre professionnels en France. Elles restent pertinentes
    ailleurs, mais seul le droit français est traité ici.
    """
    if (country or "").upper() != "FR":
        return []

    m = mentions or {}
    out: list[str] = []

    rate = m.get("late_penalty_rate")
    if rate:
        out.append(
            f"En cas de retard de paiement, application d'une pénalité au taux "
            f"annuel de {_fmt_rate(rate)} %."
        )
    else:
        out.append(_DEFAULT_PENALTY_WORDING)

    fee = m.get("recovery_fee")
    fee = DEFAULT_RECOVERY_FEE if fee in (None, "") else fee
    out.append(
        f"Indemnité forfaitaire pour frais de recouvrement en cas de retard : "
        f"{_fmt_amount(fee)} € (art. L441-10 du code de commerce)."
    )

    if m.get("no_discount", True):
        out.append("Pas d'escompte pour paiement anticipé.")

    return out


def issuer_identity_line(invoice: dict, mentions: dict) -> str:
    """Ligne d'identification de l'émetteur : forme juridique, capital, RCS, SIREN."""
    inv = invoice or {}
    m = mentions or {}
    parts: list[str] = []

    if m.get("legal_form"):
        parts.append(str(m["legal_form"]))
    if m.get("share_capital"):
        parts.append(f"capital social {m['share_capital']}")
    if m.get("rcs_city"):
        parts.append(f"RCS {m['rcs_city']}")
    if inv.get("tenant_legal_id"):
        parts.append(f"SIREN/SIRET {inv['tenant_legal_id']}")
    if inv.get("tenant_vat"):
        parts.append(f"TVA {inv['tenant_vat']}")

    return " · ".join(parts)


def insurance_mentions(mentions: dict) -> list[str]:
    """
    Assurance professionnelle.

    Mention obligatoire pour les artisans du bâtiment (garantie décennale) ;
    imprimée dès que le professionnel l'a renseignée.
    """
    m = mentions or {}
    if not m.get("insurance_name"):
        return []
    line = f"Assurance professionnelle : {m['insurance_name']}"
    if m.get("insurance_coverage"):
        line += f" — {m['insurance_coverage']}"
    return [line + "."]


# ── Échéance ──────────────────────────────────────────────────────────────────

def compute_due_date(issue_date: date, payment_terms_days: int) -> date | None:
    """
    Échéance = date d'émission + délai.

    La version précédente construisait `date(year, month, min(day + days, 28))`,
    ce qui gardait le mois d'émission : un délai de 30 jours accordé le 20 du
    mois produisait une échéance le 28, soit huit jours, et un délai accordé le
    25 produisait une échéance antérieure à la facture.
    """
    if not issue_date or payment_terms_days is None:
        return None
    try:
        days = int(payment_terms_days)
    except (TypeError, ValueError):
        return None
    if days <= 0:
        return None
    return issue_date + timedelta(days=days)


MAX_PAYMENT_TERMS_DAYS = 60  # art. L441-10 code de commerce (plafond de droit commun)


def payment_terms_warning(payment_terms_days: int | None, country: str = "FR") -> str:
    """Avertit si le délai dépasse le plafond légal français."""
    if (country or "").upper() != "FR" or not payment_terms_days:
        return ""
    try:
        days = int(payment_terms_days)
    except (TypeError, ValueError):
        return ""
    if days > MAX_PAYMENT_TERMS_DAYS:
        return (
            f"Le délai de paiement de {days} jours dépasse le plafond légal de "
            f"{MAX_PAYMENT_TERMS_DAYS} jours entre professionnels."
        )
    return ""


# ── Contrôle de conformité ────────────────────────────────────────────────────

# Ce que l'émetteur doit renseigner une fois pour toutes dans ses paramètres.
# Leur absence rend toutes ses factures non conformes, d'où le blocage.
_ISSUER_REQUIRED = [
    ("tenant_name", "la raison sociale de l'émetteur"),
    ("tenant_legal_id", "le numéro SIREN ou SIRET"),
    ("tenant_street", "l'adresse de l'émetteur"),
    ("tenant_postal_code", "le code postal de l'émetteur"),
    ("tenant_city", "la ville de l'émetteur"),
    ("tenant_country", "le pays de l'émetteur"),
]

# Renseigné facture par facture : signalé, mais ne bloque pas l'envoi.
_CLIENT_RECOMMENDED = [
    ("client_street", "l'adresse du client"),
    ("client_postal_code", "le code postal du client"),
    ("client_city", "la ville du client"),
]


def issuer_issues(invoice: dict, country: str = "FR") -> list[str]:
    """Manques imputables aux paramètres de l'émetteur. Bloquants en France."""
    if (country or "").upper() != "FR":
        return []
    inv = invoice or {}
    issues = [label for key, label in _ISSUER_REQUIRED if not inv.get(key)]

    if not inv.get("service_date"):
        issues.append("la date de la vente ou de la prestation")

    rate = inv.get("tax_rate")
    try:
        rate_val = float(rate or 0)
    except (TypeError, ValueError):
        rate_val = 0.0
    regime = (inv.get("vat_regime") or "").strip().lower()
    if rate_val == 0 and regime in ("", "standard"):
        issues.append(
            "le motif d'exonération de TVA (franchise en base, acte médical, "
            "autoliquidation…) — une facture à 0 % doit dire pourquoi"
        )

    if inv.get("document_type") == "credit_note" and not inv.get("credit_note_of"):
        issues.append("la référence à la facture corrigée par cet avoir")

    return issues


def client_issues(invoice: dict, country: str = "FR") -> list[str]:
    """Manques côté client. Signalés sans bloquer : ils se corrigent fiche par fiche."""
    if (country or "").upper() != "FR":
        return []
    inv = invoice or {}
    issues = [label for key, label in _CLIENT_RECOMMENDED if not inv.get(key)]
    if not inv.get("client_name"):
        issues.append("le nom du client")
    return issues


# ── Formatage ─────────────────────────────────────────────────────────────────

def _fmt_amount(v) -> str:
    try:
        return f"{float(v):,.2f}".replace(",", " ").replace(".", ",")
    except (TypeError, ValueError):
        return "0,00"


def _fmt_rate(v) -> str:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return "0"
    return f"{f:.2f}".rstrip("0").rstrip(".").replace(".", ",")


def document_label(document_type: str | None) -> str:
    return "FACTURE D'AVOIR" if document_type == "credit_note" else "FACTURE"
