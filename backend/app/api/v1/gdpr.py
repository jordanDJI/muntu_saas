"""
RGPD — consentement par contact, demandes de suppression, réglage de la durée de rétention.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant, get_current_user
from app.services.activity import log_activity
from app.services.retention import CONSENT_CHANNELS, anonymize_contact, record_consent
from app.services.email import send_deletion_request_notice

router = APIRouter(tags=["GDPR"])


class ConsentIn(BaseModel):
    channel: str
    granted: bool
    consent_text: Optional[str] = None


class RetentionSettingsIn(BaseModel):
    contact_retention_months: Optional[int] = None


def _assert_contact_belongs(sb, contact_id: str, tenant_id: str) -> dict:
    res = sb.table("contact").select("id, first_name, last_name, email").eq("id", contact_id).eq("tenant_id", tenant_id).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(404, "Contact introuvable")
    return res.data


@router.get("/contacts/{contact_id}/consent")
async def get_contact_consent(
    contact_id: str,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    _assert_contact_belongs(sb, contact_id, tenant_id)
    rows = (
        sb.table("contact_consent")
        .select("*")
        .eq("contact_id", contact_id)
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .execute()
    ).data or []
    return rows


@router.post("/contacts/{contact_id}/consent")
async def create_contact_consent(
    contact_id: str,
    body: ConsentIn,
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(get_current_user),
):
    sb = get_supabase_admin()
    _assert_contact_belongs(sb, contact_id, tenant_id)
    if body.channel not in CONSENT_CHANNELS:
        raise HTTPException(400, f"Canal invalide (attendu : {', '.join(sorted(CONSENT_CHANNELS))})")

    record_consent(tenant_id, contact_id, body.channel, body.granted, source="manual", consent_text=body.consent_text)
    log_activity(
        tenant_id, user["sub"],
        "Consentement enregistré",
        f"{body.channel} : {'accordé' if body.granted else 'retiré'}",
        target_type="contact", target_id=contact_id,
    )
    return {"status": "recorded"}


@router.post("/contacts/{contact_id}/request-deletion")
async def request_contact_deletion(
    contact_id: str,
    tenant_id: str = Depends(get_current_tenant),
):
    """Droit à l'oubli — marque le contact comme en attente de suppression, à confirmer par le tenant."""
    from datetime import datetime, timezone

    sb = get_supabase_admin()
    contact = _assert_contact_belongs(sb, contact_id, tenant_id)

    sb.table("contact").update(
        {"deletion_requested_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", contact_id).eq("tenant_id", tenant_id).execute()

    try:
        send_deletion_request_notice(sb, tenant_id, contact)
    except Exception:
        pass  # la demande reste tracée même si l'email de notification échoue

    return {"status": "requested"}


@router.post("/contacts/{contact_id}/confirm-deletion")
async def confirm_contact_deletion(
    contact_id: str,
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(get_current_user),
):
    """Le tenant confirme et déclenche l'anonymisation immédiate du contact."""
    sb = get_supabase_admin()
    _assert_contact_belongs(sb, contact_id, tenant_id)

    anonymize_contact(contact_id)
    log_activity(tenant_id, user["sub"], "Contact anonymisé (droit à l'oubli)", None,
                 target_type="contact", target_id=contact_id)
    return {"status": "anonymized"}


@router.get("/gdpr/retention-settings")
async def get_retention_settings(
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    res = sb.table("tenant").select("contact_retention_months").eq("id", tenant_id).maybe_single().execute()
    row = (res.data if res else None) or {}
    return {"contact_retention_months": row.get("contact_retention_months")}


@router.patch("/gdpr/retention-settings")
async def update_retention_settings(
    body: RetentionSettingsIn,
    tenant_id: str = Depends(get_current_tenant),
):
    if body.contact_retention_months is not None and body.contact_retention_months <= 0:
        raise HTTPException(400, "La durée de rétention doit être positive")
    sb = get_supabase_admin()
    sb.table("tenant").update(
        {"contact_retention_months": body.contact_retention_months}
    ).eq("id", tenant_id).execute()
    return {"contact_retention_months": body.contact_retention_months}


@router.get("/gdpr/pending-deletions")
async def list_pending_deletions(
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    rows = (
        sb.table("contact")
        .select("id, first_name, last_name, email, deletion_requested_at")
        .eq("tenant_id", tenant_id)
        .not_.is_("deletion_requested_at", "null")
        .is_("anonymized_at", "null")
        .order("deletion_requested_at", desc=True)
        .execute()
    ).data or []
    return rows
