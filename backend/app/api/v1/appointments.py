from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from uuid import UUID
from app.middleware.tenant import get_current_tenant
from app.core.supabase import get_supabase_admin as get_supabase
from app.core.config import settings
from app.models.appointment import AppointmentCreateIn, AppointmentUpdateIn, AppointmentOut
from app.services.email import send_appointment_confirmation, send_appointment_cancellation

router = APIRouter(prefix="/appointments", tags=["Appointments"])


@router.get("/", response_model=list[AppointmentOut])
async def list_appointments(
    status: str | None = None,
    tenant_id: str = Depends(get_current_tenant),
):
    supabase = get_supabase()
    # Récupérer les calendar_ids du tenant d'abord
    calendars = supabase.table("calendar").select("id").eq("tenant_id", tenant_id).execute().data
    if not calendars:
        return []
    calendar_ids = [c["id"] for c in calendars]

    query = (
        supabase.table("appointment")
        .select("*, contact(first_name, last_name, email, phone), service_offer(name)")
        .in_("calendar_id", calendar_ids)
        .order("scheduled_at", desc=False)
    )
    if status:
        query = query.eq("status", status)
    return query.execute().data


@router.post("/", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    body: AppointmentCreateIn,
    background_tasks: BackgroundTasks,
    tenant_id: str = Depends(get_current_tenant),
):
    supabase = get_supabase()

    calendar = supabase.table("calendar").select("id").eq("tenant_id", tenant_id).single().execute().data
    if not calendar:
        raise HTTPException(status_code=404, detail="Calendrier introuvable")

    appt_data = {
        "calendar_id": calendar["id"],
        "contact_id": str(body.contact_id),
        "type": body.type,
        "audience_type": body.audience_type,
        "scheduled_at": body.scheduled_at.isoformat(),
        "end_at": body.end_at.isoformat(),
        "status": "confirmed",
    }
    if body.service_offer_id:
        appt_data["service_offer_id"] = str(body.service_offer_id)
    if body.lead_id:
        appt_data["lead_id"] = str(body.lead_id)
    if body.cal_booking_id:
        appt_data["cal_booking_id"] = body.cal_booking_id

    appt = supabase.table("appointment").insert(appt_data).execute().data[0]

    if body.lead_id:
        supabase.table("lead").update({"status": "scheduled"}).eq("id", str(body.lead_id)).execute()

    contact = supabase.table("contact").select("first_name, last_name, email").eq("id", str(body.contact_id)).single().execute().data
    tenant = supabase.table("tenant").select("name").eq("id", tenant_id).single().execute().data

    if contact and contact.get("email") and tenant:
        background_tasks.add_task(
            send_appointment_confirmation,
            contact_email=contact["email"],
            contact_name=f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip(),
            appointment=appt,
            tenant_name=tenant.get("name", ""),
        )

    contact_name = (
        f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
        if contact else ""
    )
    background_tasks.add_task(
        _notify_tenant_whatsapp,
        tenant_id=tenant_id,
        contact_name=contact_name,
        scheduled_at=appt.get("scheduled_at", ""),
    )

    return appt


def _notify_tenant_whatsapp(tenant_id: str, contact_name: str, scheduled_at: str) -> None:
    """Envoie une notification WhatsApp au professionnel quand un nouveau RDV est créé."""
    from app.services.whatsapp import send_text

    sb = get_supabase()
    cfg_res = (
        sb.table("agent_config")
        .select("whatsapp_number, telegram_bot_token, telegram_notify_chat_id, status")
        .eq("tenant_id", tenant_id)
        .eq("agent_type", "assistant_tenant")
        .eq("status", "active")
        .execute()
    )
    if not cfg_res.data:
        return

    cfg = cfg_res.data[0]
    try:
        dt = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
        date_str = dt.strftime("%A %d/%m/%Y à %H:%M")
    except Exception:
        date_str = scheduled_at

    msg = f"Nouveau RDV confirmé :\n{contact_name or 'Client'} — {date_str}"

    # WhatsApp
    if cfg.get("whatsapp_number"):
        send_text(cfg["whatsapp_number"], msg)

    # Telegram
    if cfg.get("telegram_bot_token") and cfg.get("telegram_notify_chat_id"):
        from app.services.telegram import send_message
        send_message(cfg["telegram_bot_token"], cfg["telegram_notify_chat_id"], msg)


@router.post("/{appointment_id}/confirm", response_model=AppointmentOut)
async def confirm_appointment(
    appointment_id: UUID,
    background_tasks: BackgroundTasks,
    tenant_id: str = Depends(get_current_tenant),
):
    """Confirme un RDV en attente et envoie l'email de confirmation au client."""
    supabase = get_supabase()
    appt = _get_tenant_appointment(supabase, appointment_id, tenant_id)

    if appt["status"] == "confirmed":
        return appt
    if appt["status"] == "cancelled":
        raise HTTPException(status_code=400, detail="Ce rendez-vous est déjà annulé")

    result = supabase.table("appointment").update({"status": "confirmed"}).eq("id", str(appointment_id)).execute()
    appt = result.data[0]

    supabase.table("lead").update({"status": "scheduled"}).eq("contact_id", appt["contact_id"]).eq("tenant_id", tenant_id).execute()

    contact = supabase.table("contact").select("first_name, last_name, email").eq("id", appt["contact_id"]).single().execute().data
    tenant = supabase.table("tenant").select("name").eq("id", tenant_id).single().execute().data

    if contact and contact.get("email") and tenant:
        background_tasks.add_task(
            send_appointment_confirmation,
            contact_email=contact["email"],
            contact_name=f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip(),
            appointment=appt,
            tenant_name=tenant.get("name", ""),
        )

    return appt


@router.post("/{appointment_id}/cancel", response_model=AppointmentOut)
async def cancel_appointment(
    appointment_id: UUID,
    background_tasks: BackgroundTasks,
    tenant_id: str = Depends(get_current_tenant),
):
    """Annule un RDV et envoie un email d'annulation au client si le RDV était confirmé."""
    supabase = get_supabase()
    appt = _get_tenant_appointment(supabase, appointment_id, tenant_id)

    if appt["status"] == "cancelled":
        return appt

    was_confirmed = appt["status"] == "confirmed"
    was_pending = appt["status"] == "pending"
    result = supabase.table("appointment").update({"status": "cancelled"}).eq("id", str(appointment_id)).execute()
    appt = result.data[0]

    supabase.table("lead").update({"status": "closed_lost"}).eq("contact_id", appt["contact_id"]).eq("tenant_id", tenant_id).execute()

    if was_confirmed or was_pending:
        contact = supabase.table("contact").select("first_name, last_name, email").eq("id", appt["contact_id"]).single().execute().data
        tenant = supabase.table("tenant").select("name, slug").eq("id", tenant_id).single().execute().data
        if contact and contact.get("email") and tenant:
            booking_url = f"{settings.frontend_url}/{tenant.get('slug', '')}"
            background_tasks.add_task(
                send_appointment_cancellation,
                contact_email=contact["email"],
                contact_name=f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip(),
                appointment=appt,
                tenant_name=tenant.get("name", ""),
                booking_url=booking_url,
                was_pending=was_pending,
            )

    return appt


def _get_tenant_appointment(supabase, appointment_id: UUID, tenant_id: str) -> dict:
    """Récupère un RDV en vérifiant qu'il appartient bien au tenant."""
    calendars = supabase.table("calendar").select("id").eq("tenant_id", tenant_id).execute().data
    if not calendars:
        raise HTTPException(status_code=404, detail="Rendez-vous introuvable")
    cal_ids = [c["id"] for c in calendars]

    res = (
        supabase.table("appointment")
        .select("*")
        .eq("id", str(appointment_id))
        .in_("calendar_id", cal_ids)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Rendez-vous introuvable")
    return res.data


@router.patch("/{appointment_id}", response_model=AppointmentOut)
async def update_appointment(
    appointment_id: UUID,
    body: AppointmentUpdateIn,
    tenant_id: str = Depends(get_current_tenant),
):
    supabase = get_supabase()
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")

    if "scheduled_at" in updates:
        updates["scheduled_at"] = updates["scheduled_at"].isoformat()
    if "end_at" in updates:
        updates["end_at"] = updates["end_at"].isoformat()

    # Vérifie que le RDV appartient bien au tenant avant de modifier
    _get_tenant_appointment(supabase, appointment_id, tenant_id)

    result = (
        supabase.table("appointment")
        .update(updates)
        .eq("id", str(appointment_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Rendez-vous introuvable")
    return result.data[0]
