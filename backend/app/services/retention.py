"""
Moteur RGPD — consentement, droit à l'oubli, purge automatique par rétention.
"""
import logging
from datetime import datetime, timedelta, timezone

from app.core.supabase import get_supabase_admin

logger = logging.getLogger(__name__)

CONSENT_CHANNELS = {"email", "telephone", "courrier", "marketing"}

ANONYMIZED_PLACEHOLDER = {
    "first_name": "Contact",
    "last_name": "anonymisé",
    "email": None,
    "phone": None,
    "contact_details": {},
    "anonymized_at": None,  # posé explicitement par anonymize_contact()
}


def record_consent(
    tenant_id: str,
    contact_id: str,
    channel: str,
    granted: bool,
    source: str,
    consent_text: str | None = None,
) -> None:
    if channel not in CONSENT_CHANNELS:
        raise ValueError(f"Canal de consentement invalide : {channel}")
    sb = get_supabase_admin()
    sb.table("contact_consent").insert({
        "tenant_id": tenant_id,
        "contact_id": contact_id,
        "channel": channel,
        "granted": granted,
        "consent_text": consent_text,
        "source": source,
    }).execute()


def touch_contact_interaction(contact_id: str) -> None:
    """Met à jour last_interaction_at — à appeler à chaque nouvelle activité/RDV/lead lié au contact."""
    try:
        sb = get_supabase_admin()
        sb.table("contact").update(
            {"last_interaction_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", contact_id).execute()
    except Exception as exc:
        logger.warning("touch_contact_interaction failed for %s: %s", contact_id, exc)


def anonymize_contact(contact_id: str) -> None:
    """Vide les champs PII d'un contact tout en conservant la ligne (FK appointment/lead/invoice valides)."""
    sb = get_supabase_admin()
    sb.table("contact").update({
        **{k: v for k, v in ANONYMIZED_PLACEHOLDER.items() if k != "anonymized_at"},
        "anonymized_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", contact_id).execute()


def _has_blocking_relations(sb, contact_id: str) -> bool:
    """RDV futur ou facture impayée → on ne purge pas (garde-fou légal/pratique)."""
    now_iso = datetime.now(timezone.utc).isoformat()
    future_appt = (
        sb.table("appointment")
        .select("id")
        .eq("contact_id", contact_id)
        .in_("status", ["confirmed", "pending"])
        .gte("scheduled_at", now_iso)
        .limit(1)
        .execute()
    ).data
    if future_appt:
        return True

    try:
        unpaid_invoice = (
            sb.table("invoice")
            .select("id")
            .eq("contact_id", contact_id)
            .in_("status", ["sent", "overdue"])
            .limit(1)
            .execute()
        ).data
        if unpaid_invoice:
            return True
    except Exception:
        pass  # table invoice peut ne pas exister selon l'environnement

    return False


def run_retention_purge() -> dict:
    """
    Pour chaque tenant ayant configuré contact_retention_months, anonymise les contacts
    inactifs depuis plus longtemps que cette durée (hors RDV futur / facture impayée).
    """
    sb = get_supabase_admin()
    tenants = (
        sb.table("tenant")
        .select("id, contact_retention_months")
        .not_.is_("contact_retention_months", "null")
        .execute()
    ).data or []

    anonymized, skipped = 0, 0

    for tenant in tenants:
        months = tenant.get("contact_retention_months")
        if not months or months <= 0:
            continue
        cutoff = (datetime.now(timezone.utc) - timedelta(days=months * 30)).isoformat()

        candidates = (
            sb.table("contact")
            .select("id")
            .eq("tenant_id", tenant["id"])
            .is_("anonymized_at", "null")
            .is_("deleted_at", "null")
            .lt("last_interaction_at", cutoff)
            .execute()
        ).data or []

        for c in candidates:
            if _has_blocking_relations(sb, c["id"]):
                skipped += 1
                continue
            try:
                anonymize_contact(c["id"])
                anonymized += 1
            except Exception as exc:
                logger.error("Retention purge failed for contact %s: %s", c["id"], exc)

    logger.info("Retention purge: %d anonymisés, %d ignorés (relations bloquantes)", anonymized, skipped)
    return {"anonymized": anonymized, "skipped": skipped}
