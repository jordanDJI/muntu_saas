from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from uuid import UUID
from app.middleware.tenant import get_current_tenant
from app.core.supabase import get_supabase_admin as get_supabase
from app.models.appointment import AppointmentCreateIn, AppointmentUpdateIn, AppointmentOut
from app.services.email import send_appointment_confirmation

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

    return appt


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

    result = (
        supabase.table("appointment")
        .update(updates)
        .eq("id", str(appointment_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Rendez-vous introuvable")
    return result.data[0]
