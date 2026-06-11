"""
CRM — Relances (contact_reminder)
Création, liste, mise à jour (marquer fait/modifier), suppression, envoi email.
"""
import asyncio
from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant

router = APIRouter(prefix="/reminders", tags=["Reminders"])

VALID_TYPES = {"post_service", "reactivation", "quote_followup", "payment", "health_reminder", "promo", "custom"}


class ReminderCreate(BaseModel):
    contact_id: str
    due_date: date
    note: Optional[str] = None
    reminder_type: str = "custom"
    auto_send: bool = False


class ReminderUpdate(BaseModel):
    due_date: Optional[date] = None
    note: Optional[str] = None
    done: Optional[bool] = None
    reminder_type: Optional[str] = None
    auto_send: Optional[bool] = None


@router.get("/")
async def list_reminders(
    contact_id: Optional[str] = None,
    done: Optional[bool] = None,
    upcoming_only: bool = False,
    tenant_id: str = Depends(get_current_tenant),
):
    """
    Liste les relances du tenant.
    - `contact_id` : filtrer par contact
    - `done=false` : uniquement les non-faites
    - `upcoming_only=true` : échéances aujourd'hui ou passées (non-faites)
    """
    sb = get_supabase_admin()
    query = (
        sb.table("contact_reminder")
        .select("id, contact_id, due_date, note, done, reminder_type, auto_send, sent_at, created_at, contact(first_name, last_name, email)")
        .eq("tenant_id", tenant_id)
        .order("due_date")
    )
    if contact_id:
        query = query.eq("contact_id", contact_id)
    if done is not None:
        query = query.eq("done", done)
    if upcoming_only:
        today = date.today().isoformat()
        query = query.lte("due_date", today).eq("done", False)

    return (query.execute()).data or []


@router.post("/", status_code=201)
async def create_reminder(
    body: ReminderCreate,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()

    # Vérifier que le contact appartient au tenant
    contact = (
        sb.table("contact")
        .select("id")
        .eq("id", body.contact_id)
        .eq("tenant_id", tenant_id)
        .single()
        .execute()
    ).data
    if not contact:
        raise HTTPException(404, "Contact introuvable")

    reminder_type = body.reminder_type if body.reminder_type in VALID_TYPES else "custom"

    res = (
        sb.table("contact_reminder")
        .insert({
            "tenant_id":     tenant_id,
            "contact_id":    body.contact_id,
            "due_date":      body.due_date.isoformat(),
            "note":          body.note,
            "reminder_type": reminder_type,
            "auto_send":     body.auto_send,
        })
        .execute()
    )
    return res.data[0]


@router.patch("/{reminder_id}")
async def update_reminder(
    reminder_id: str,
    body: ReminderUpdate,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "due_date" in updates and isinstance(updates["due_date"], date):
        updates["due_date"] = updates["due_date"].isoformat()
    if "reminder_type" in updates and updates["reminder_type"] not in VALID_TYPES:
        updates["reminder_type"] = "custom"
    if not updates:
        raise HTTPException(400, "Aucun champ à mettre à jour")

    res = (
        sb.table("contact_reminder")
        .update(updates)
        .eq("id", reminder_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Relance introuvable")
    return res.data[0]


@router.delete("/{reminder_id}", status_code=204)
async def delete_reminder(
    reminder_id: str,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    res = (
        sb.table("contact_reminder")
        .delete()
        .eq("id", reminder_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Relance introuvable")


class ReminderSendOptions(BaseModel):
    subject_override: Optional[str] = None
    message_override: Optional[str] = None


@router.get("/{reminder_id}/preview")
async def preview_reminder(
    reminder_id: str,
    tenant_id: str = Depends(get_current_tenant),
):
    """
    Retourne le sujet et le corps pré-remplis depuis le template,
    pour alimenter la modale d'édition avant envoi.
    """
    from app.services.email import build_crm_reminder_preview

    sb = get_supabase_admin()
    row = (
        sb.table("contact_reminder")
        .select(
            "id, note, reminder_type, "
            "contact(first_name, last_name, email), "
            "tenant(name, country)"
        )
        .eq("id", reminder_id)
        .eq("tenant_id", tenant_id)
        .single()
        .execute()
    ).data

    if not row:
        raise HTTPException(404, "Relance introuvable")

    contact = row.get("contact") or {}
    tenant  = row.get("tenant") or {}

    preview = build_crm_reminder_preview(
        country=tenant.get("country", "BE"),
        reminder_type=row.get("reminder_type", "custom"),
        tenant_name=tenant.get("name", ""),
        contact_first_name=contact.get("first_name", ""),
        note=row.get("note") or "",
    )

    return {
        **preview,
        "contact_email": contact.get("email", ""),
        "contact_name": f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip(),
    }


@router.post("/{reminder_id}/send")
async def send_reminder_email(
    reminder_id: str,
    opts: ReminderSendOptions = ReminderSendOptions(),
    tenant_id: str = Depends(get_current_tenant),
):
    """
    Envoie immédiatement la relance par email au contact.
    Requiert que le contact ait une adresse email.
    """
    from app.services.email import send_crm_reminder_to_contact
    from app.core.config import settings as cfg

    sb = get_supabase_admin()

    row = (
        sb.table("contact_reminder")
        .select(
            "id, note, reminder_type, sent_at, done, "
            "contact(first_name, last_name, email, telegram_chat_id), "
            "tenant(name, country, slug, site(site_style, email_contact))"
        )
        .eq("id", reminder_id)
        .eq("tenant_id", tenant_id)
        .single()
        .execute()
    ).data

    if not row:
        raise HTTPException(404, "Relance introuvable")

    contact = row.get("contact") or {}
    tenant  = row.get("tenant") or {}
    email   = contact.get("email")

    if not email:
        raise HTTPException(422, "Ce contact n'a pas d'adresse email")

    sites = tenant.get("site") or []
    site_style    = (sites[0].get("site_style") or {}) if sites else {}
    email_contact = (sites[0].get("email_contact") or "") if sites else ""
    slug          = tenant.get("slug", "")
    booking_url   = f"{cfg.frontend_url}/{slug}" if slug else ""
    reply_url = (
        f"mailto:{email_contact}" if email_contact
        else (f"{cfg.frontend_url}/{slug}#contact" if slug else "")
    )

    await asyncio.to_thread(
        send_crm_reminder_to_contact,
        contact_email=email,
        contact_first_name=contact.get("first_name", ""),
        tenant_name=tenant.get("name", ""),
        tenant_country=tenant.get("country", "BE"),
        reminder_type=row.get("reminder_type", "custom"),
        note=row.get("note") or "",
        booking_url=booking_url,
        primary_color=site_style.get("primary_color", ""),
        logo_url=site_style.get("logo_url", ""),
        logo_option=site_style.get("logo_option", "text_only"),
        subject_override=opts.subject_override or "",
        message_override=opts.message_override or "",
        reply_url=reply_url,
    )

    # Envoi Telegram si le contact a un chat_id et le tenant a un bot configuré
    telegram_chat_id = contact.get("telegram_chat_id")
    if telegram_chat_id:
        agent_cfg = (
            sb.table("agent_config")
            .select("telegram_bot_token")
            .eq("tenant_id", tenant_id)
            .eq("agent_type", "support_client")
            .limit(1)
            .execute()
        ).data
        bot_token = (agent_cfg[0].get("telegram_bot_token") if agent_cfg else None) or ""
        if bot_token:
            from app.services.telegram import send_message as tg_send
            note_text = (opts.message_override or "").strip() or (row.get("note") or "").strip()
            tg_text = f"📨 {tenant.get('name', '')}" + (f"\n\n{note_text}" if note_text else "")
            try:
                await asyncio.to_thread(tg_send, bot_token, telegram_chat_id, tg_text)
            except Exception:
                pass

    now = datetime.now(timezone.utc).isoformat()
    sb.table("contact_reminder").update({"sent_at": now}).eq("id", reminder_id).execute()

    return {"sent": True, "sent_at": now}
