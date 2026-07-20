"""
Campagnes email groupées — envoi en masse à un segment de contacts.
Inclut le tracking d'ouverture (pixel GIF), de clics (redirect proxy)
et le désabonnement individuel (opt-out marketing).
"""
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import quote, unquote

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, RedirectResponse
from pydantic import BaseModel

from app.core.config import settings as cfg
from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant
from app.services.email import send_campaign_email, get_tenant_brand
from app.services.telegram import send_message as tg_send

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])

INACTIVE_DAYS = 180

# GIF transparent 1×1 px (44 octets) — retourné par le pixel de tracking
_TRACKING_PIXEL = bytes([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
    0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
    0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
    0x01, 0x00, 0x3b,
])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _tracking_pixel_url(token: str) -> str:
    return f"{cfg.app_url}/api/v1/campaigns/track/open?t={token}"

def _click_proxy_url(token: str, original_url: str) -> str:
    return f"{cfg.app_url}/api/v1/campaigns/track/click?t={token}&url={quote(original_url, safe='')}"

def _unsubscribe_url(unsubscribe_token: str) -> str:
    return f"{cfg.frontend_url}/unsubscribe?t={unsubscribe_token}"

def _get_segment_contacts(sb, tenant_id: str, segment: str, tag_id: Optional[str]) -> list[dict]:
    """Retourne les contacts (avec email, non opt-out) correspondant au segment."""
    try:
        # Version complète avec colonnes de tracking (migration 054 appliquée)
        query = (
            sb.table("contact")
            .select("id, first_name, last_name, email, telegram_chat_id, unsubscribe_token")
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .neq("email", "")
            .not_.is_("email", "null")
            .eq("marketing_opt_out", False)
        )
        contacts = query.execute().data or []
    except Exception:
        # Migration 054 non encore appliquée — requête sans les nouvelles colonnes
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


# ── Endpoints publics (pas d'auth JWT) ───────────────────────────────────────

@router.get("/track/open", include_in_schema=False)
async def track_open(t: str = Query(...)):
    """Pixel de tracking 1×1 — enregistre l'ouverture d'un email de campagne."""
    sb = get_supabase_admin()
    try:
        row = sb.table("email_campaign_contact").select("id, campaign_id, open_count, opened_at").eq("token", t).single().execute().data
        if row:
            now = datetime.now(timezone.utc).isoformat()
            sb.table("email_campaign_contact").update({
                "open_count": row["open_count"] + 1,
                "opened_at": row["opened_at"] or now,
            }).eq("id", row["id"]).execute()
            camp = sb.table("email_campaign").select("open_count").eq("id", row["campaign_id"]).single().execute().data
            if camp:
                sb.table("email_campaign").update({"open_count": camp["open_count"] + 1}).eq("id", row["campaign_id"]).execute()
    except Exception:
        pass  # Jamais lever d'erreur sur un pixel — l'email client ne doit pas voir d'échec
    return Response(content=_TRACKING_PIXEL, media_type="image/gif",
                    headers={"Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache"})


@router.get("/track/click", include_in_schema=False)
async def track_click(t: str = Query(...), url: str = Query(...)):
    """Proxy de clic — enregistre le clic et redirige vers l'URL originale."""
    # Sécurité : n'autoriser que les URLs http/https (anti open-redirect vers javascript: etc.)
    decoded = unquote(url)
    if not decoded.startswith(("http://", "https://")):
        raise HTTPException(400, "URL invalide")

    sb = get_supabase_admin()
    try:
        row = sb.table("email_campaign_contact").select("id, campaign_id, click_count, clicked_at").eq("token", t).single().execute().data
        if row:
            now = datetime.now(timezone.utc).isoformat()
            sb.table("email_campaign_contact").update({
                "click_count": row["click_count"] + 1,
                "clicked_at": row["clicked_at"] or now,
            }).eq("id", row["id"]).execute()
            camp = sb.table("email_campaign").select("click_count").eq("id", row["campaign_id"]).single().execute().data
            if camp:
                sb.table("email_campaign").update({"click_count": camp["click_count"] + 1}).eq("id", row["campaign_id"]).execute()
    except Exception:
        pass
    return RedirectResponse(url=decoded, status_code=302)


@router.get("/unsubscribe", include_in_schema=False)
async def unsubscribe(t: str = Query(...)):
    """Désabonnement marketing — pose marketing_opt_out=true sur le contact."""
    sb = get_supabase_admin()
    try:
        res = sb.table("contact").select("id, tenant_id").eq("unsubscribe_token", t).single().execute()
        contact = res.data
        if not contact:
            raise HTTPException(404, "Lien invalide ou expiré")
        sb.table("contact").update({"marketing_opt_out": True}).eq("id", contact["id"]).execute()
        # Marquer dans email_campaign_contact si une entrée existe (dernière campagne reçue)
        ecc = (
            sb.table("email_campaign_contact")
            .select("id")
            .eq("contact_id", contact["id"])
            .is_("unsubscribed_at", "null")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        ).data
        if ecc:
            now = datetime.now(timezone.utc).isoformat()
            ecc_id = ecc[0]["id"]
            ecc_row = sb.table("email_campaign_contact").select("campaign_id").eq("id", ecc_id).single().execute().data
            sb.table("email_campaign_contact").update({"unsubscribed_at": now}).eq("id", ecc_id).execute()
            if ecc_row:
                cid = ecc_row["campaign_id"]
                camp = sb.table("email_campaign").select("unsubscribed_count").eq("id", cid).single().execute().data
                if camp:
                    sb.table("email_campaign").update({"unsubscribed_count": camp["unsubscribed_count"] + 1}).eq("id", cid).execute()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(500, "Une erreur est survenue")
    return {"success": True}


# ── Endpoints authentifiés (tenant) ──────────────────────────────────────────

class CampaignCreate(BaseModel):
    name: str
    subject: str
    body: str
    segment: str = "all"   # all | inactive | tag
    tag_id: Optional[str] = None


@router.get("/preview")
async def preview_campaign(
    segment: str = "all",
    tag_id: Optional[str] = None,
    tenant_id: str = Depends(get_current_tenant),
):
    """Retourne le nombre de contacts qui recevront la campagne (hors opt-out)."""
    sb = get_supabase_admin()
    contacts = _get_segment_contacts(sb, tenant_id, segment, tag_id)
    return {"count": len(contacts)}


@router.post("/")
async def send_campaign(
    body: CampaignCreate,
    tenant_id: str = Depends(get_current_tenant),
):
    """Crée et envoie une campagne email au segment choisi avec tracking."""
    if not body.name.strip():
        raise HTTPException(400, "Le nom de la campagne est requis")
    if not body.subject.strip():
        raise HTTPException(400, "L'objet est requis")
    if not body.body.strip():
        raise HTTPException(400, "Le message est requis")

    sb = get_supabase_admin()

    site = (
        sb.table("site")
        .select("title, email_contact")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data
    sender_name = (site[0].get("title") if site else None) or "Klientys"
    email_contact = (site[0].get("email_contact") if site else None) or ""

    tenant_row = (
        sb.table("tenant")
        .select("slug")
        .eq("id", tenant_id)
        .single()
        .execute()
    ).data
    tenant_slug = (tenant_row or {}).get("slug", "")

    reply_url = (
        f"mailto:{email_contact}" if email_contact
        else (f"{cfg.frontend_url}/{tenant_slug}#contact" if tenant_slug else "")
    )

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

    brand = get_tenant_brand(sb, tenant_id)

    # Insérer la campagne en premier pour obtenir son ID (nécessaire pour le tracking)
    campaign = (
        sb.table("email_campaign")
        .insert({
            "tenant_id": tenant_id,
            "name": body.name.strip(),
            "subject": body.subject.strip(),
            "body": body.body.strip(),
            "segment": body.segment,
            "tag_id": body.tag_id,
            "status": "sent",
            "sent_count": 0,
            "failed_count": 0,
        })
        .execute()
    ).data[0]
    campaign_id = campaign["id"]

    sent_count = 0
    failed_count = 0

    for contact in contacts:
        email = contact.get("email")
        if not email:
            continue

        # Créer la ligne de tracking par destinataire
        ecc = (
            sb.table("email_campaign_contact")
            .insert({
                "campaign_id": campaign_id,
                "tenant_id":   tenant_id,
                "contact_id":  contact["id"],
            })
            .execute()
        ).data[0]
        tracking_token = ecc["token"]

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
                primary_color=brand["primary_color"],
                logo_url=brand["logo_url"],
                logo_option=brand["logo_option"],
                tracking_pixel_url=_tracking_pixel_url(tracking_token),
                click_base_url=f"{cfg.app_url}/api/v1/campaigns/track/click",
                tracking_token=tracking_token,
                unsubscribe_url=_unsubscribe_url(contact.get("unsubscribe_token") or ""),
            )
            sent_count += 1
        except Exception:
            failed_count += 1

        # Envoi Telegram si disponible
        telegram_chat_id = contact.get("telegram_chat_id")
        if telegram_chat_id and bot_token:
            try:
                tg_text = f"📨 {sender_name}\n\n{personalized_body}"
                await asyncio.to_thread(tg_send, bot_token, telegram_chat_id, tg_text)
            except Exception:
                pass

    # Mettre à jour les compteurs finaux
    final_status = "sent" if failed_count == 0 else ("failed" if sent_count == 0 else "partial")
    sb.table("email_campaign").update({
        "sent_count":   sent_count,
        "failed_count": failed_count,
        "status":       final_status,
    }).eq("id", campaign_id).execute()

    return {**campaign, "sent_count": sent_count, "failed_count": failed_count}


@router.get("/")
async def list_campaigns(tenant_id: str = Depends(get_current_tenant)):
    """Historique des campagnes avec métriques de tracking."""
    sb = get_supabase_admin()
    try:
        # Version complète avec colonnes de tracking (migration 054 appliquée)
        rows = (
            sb.table("email_campaign")
            .select("id, name, subject, segment, status, sent_count, failed_count, open_count, click_count, unsubscribed_count, sent_at, created_at")
            .eq("tenant_id", tenant_id)
            .order("sent_at", desc=True)
            .limit(50)
            .execute()
        ).data or []
    except Exception:
        # Migration 054 non encore appliquée — colonnes de tracking absentes
        rows = (
            sb.table("email_campaign")
            .select("id, name, subject, segment, status, sent_count, failed_count, sent_at, created_at")
            .eq("tenant_id", tenant_id)
            .order("sent_at", desc=True)
            .limit(50)
            .execute()
        ).data or []

    for row in rows:
        sent = row.get("sent_count") or 0
        row["open_rate"]  = round(row.get("open_count", 0) / sent * 100) if sent else 0
        row["click_rate"] = round(row.get("click_count", 0) / sent * 100) if sent else 0

    return rows
