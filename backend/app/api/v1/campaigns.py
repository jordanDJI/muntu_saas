"""
Campagnes email groupées — envoi en masse à un segment de contacts.
"""
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant
from app.services.email import send_campaign_email
from app.services.telegram import send_message as tg_send

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])

INACTIVE_DAYS = 180


class CampaignCreate(BaseModel):
    name: str
    subject: str
    body: str
    segment: str = "all"   # all | inactive | tag:{tag_id}
    tag_id: Optional[str] = None


def _get_segment_contacts(sb, tenant_id: str, segment: str, tag_id: Optional[str]) -> list[dict]:
    """Retourne les contacts (avec email) correspondant au segment."""
    query = (
        sb.table("contact")
        .select("id, first_name, last_name, email, telegram_chat_id")
        .eq("tenant_id", tenant_id)
        .is_("deleted_at", "null")
        .neq("email", "")
        .not_.is_("email", "null")
    )
    contacts = query.execute().data or []

    if segment == "inactive":
        contact_ids = [c["id"] for c in contacts]
        cutoff = (datetime.now(timezone.utc) - timedelta(days=INACTIVE_DAYS)).isoformat()
        # Contacts avec au moins un RDV confirmé récent → actifs → on les exclut
        active_ids = {
            row["contact_id"]
            for row in (
                sb.table("appointment")
                .select("contact_id")
                .eq("status", "confirmed")
                .gte("scheduled_at", cutoff)
                .in_("contact_id", contact_ids)
                .execute()
            ).data or []
        }
        contacts = [c for c in contacts if c["id"] not in active_ids]

    elif segment == "tag" and tag_id:
        linked_ids = {
            row["contact_id"]
            for row in (
                sb.table("contact_tag_link")
                .select("contact_id")
                .eq("tag_id", tag_id)
                .execute()
            ).data or []
        }
        contacts = [c for c in contacts if c["id"] in linked_ids]

    return contacts


@router.get("/preview")
async def preview_campaign(
    segment: str = "all",
    tag_id: Optional[str] = None,
    tenant_id: str = Depends(get_current_tenant),
):
    """Retourne le nombre de contacts qui recevront la campagne."""
    sb = get_supabase_admin()
    contacts = _get_segment_contacts(sb, tenant_id, segment, tag_id)
    return {"count": len(contacts)}


@router.post("/")
async def send_campaign(
    body: CampaignCreate,
    tenant_id: str = Depends(get_current_tenant),
):
    """Crée et envoie une campagne email au segment choisi."""
    if not body.name.strip():
        raise HTTPException(400, "Le nom de la campagne est requis")
    if not body.subject.strip():
        raise HTTPException(400, "L'objet est requis")
    if not body.body.strip():
        raise HTTPException(400, "Le message est requis")

    sb = get_supabase_admin()

    # Récupérer le nom et l'email de contact du site du tenant
    site = (
        sb.table("site")
        .select("title, email_contact")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data
    sender_name = (site[0].get("title") if site else None) or "Klientys"
    email_contact = (site[0].get("email_contact") if site else None) or ""

    # Récupérer le slug du tenant pour le lien de réponse
    tenant_row = (
        sb.table("tenant")
        .select("slug")
        .eq("id", tenant_id)
        .single()
        .execute()
    ).data
    tenant_slug = (tenant_row or {}).get("slug", "")

    from app.core.config import settings as cfg
    reply_url = (
        f"mailto:{email_contact}" if email_contact
        else (f"{cfg.frontend_url}/{tenant_slug}#contact" if tenant_slug else "")
    )

    # Récupérer le bot Telegram du tenant (agent support_client)
    agent_cfg = (
        sb.table("agent_config")
        .select("telegram_bot_token")
        .eq("tenant_id", tenant_id)
        .eq("agent_type", "support_client")
        .limit(1)
        .execute()
    ).data
    bot_token = (agent_cfg[0].get("telegram_bot_token") if agent_cfg else None) or ""

    contacts = _get_segment_contacts(sb, tenant_id, body.segment, body.tag_id)
    if not contacts:
        raise HTTPException(422, "Aucun contact avec email dans ce segment")

    sent_count = 0
    failed_count = 0

    for contact in contacts:
        email = contact.get("email")
        if not email:
            continue
        first_name = contact.get("first_name") or contact.get("last_name") or "Client"
        personalized_body = (
            body.body
            .replace("{prenom}", first_name)
            .replace("{first_name}", first_name)
            .replace("{vorname}", first_name)
            .replace("{voornaam}", first_name)
        )
        try:
            await send_campaign_email(
                to_email=email,
                to_name=first_name,
                subject=body.subject,
                body=personalized_body,
                sender_name=sender_name,
                reply_url=reply_url,
            )
            sent_count += 1
        except Exception:
            failed_count += 1

        # Envoi Telegram si le contact a un chat_id et le tenant a un bot configuré
        telegram_chat_id = contact.get("telegram_chat_id")
        if telegram_chat_id and bot_token:
            try:
                tg_text = f"📨 {sender_name}\n\n{personalized_body}"
                await asyncio.to_thread(tg_send, bot_token, telegram_chat_id, tg_text)
            except Exception:
                pass

    # Enregistrer la campagne
    campaign = (
        sb.table("email_campaign")
        .insert({
            "tenant_id": tenant_id,
            "name": body.name.strip(),
            "subject": body.subject.strip(),
            "body": body.body.strip(),
            "segment": body.segment,
            "tag_id": body.tag_id,
            "status": "sent" if failed_count == 0 else "partial",
            "sent_count": sent_count,
            "failed_count": failed_count,
        })
        .execute()
    ).data[0]

    return {**campaign, "sent_count": sent_count, "failed_count": failed_count}


@router.get("/")
async def list_campaigns(
    tenant_id: str = Depends(get_current_tenant),
):
    """Historique des campagnes envoyées par le tenant."""
    sb = get_supabase_admin()
    rows = (
        sb.table("email_campaign")
        .select("id, name, subject, segment, status, sent_count, failed_count, sent_at, created_at")
        .eq("tenant_id", tenant_id)
        .order("sent_at", desc=True)
        .limit(50)
        .execute()
    ).data or []
    return rows
