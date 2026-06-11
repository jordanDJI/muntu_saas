from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
from app.middleware.tenant import get_current_tenant
from app.core.supabase import get_supabase_admin as get_supabase
from app.models.calendar import AvailabilitySlotIn, BlockedPeriodIn, CalendarApptIn
from app.services.lead import ensure_lead

router = APIRouter(prefix="/calendar", tags=["Calendar"])


def _ensure_calendar(sb, tenant_id: str) -> str:
    """Retourne le calendar_id du tenant, le crée si absent avec des créneaux par défaut."""
    res = sb.table("calendar").select("id").eq("tenant_id", tenant_id).execute()
    if res.data:
        return res.data[0]["id"]
    new = sb.table("calendar").insert({"tenant_id": tenant_id, "name": "Principal"}).execute()
    cal_id = new.data[0]["id"]
    default_slots = [
        {"calendar_id": cal_id, "day_of_week": day, "start_time": start, "end_time": end, "slot_duration_min": 30, "is_active": True}
        for day in range(5)  # 0=Lun … 4=Ven
        for start, end in [("09:00", "12:00"), ("13:00", "17:00")]
    ]
    sb.table("availability_slot").insert(default_slots).execute()
    return cal_id


# ── Disponibilités ────────────────────────────────────────────────────────────

@router.get("/availability")
async def get_availability(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    cal_id = _ensure_calendar(sb, tenant_id)
    res = sb.table("availability_slot").select("*").eq("calendar_id", cal_id).order("day_of_week").order("start_time").execute()
    return res.data


@router.put("/availability")
async def replace_availability(slots: list[AvailabilitySlotIn], tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    cal_id = _ensure_calendar(sb, tenant_id)
    sb.table("availability_slot").delete().eq("calendar_id", cal_id).execute()
    if slots:
        sb.table("availability_slot").insert([
            {"calendar_id": cal_id, **s.model_dump()} for s in slots
        ]).execute()
    return {"replaced": len(slots)}


# ── Blocages ──────────────────────────────────────────────────────────────────

@router.get("/blocked")
async def get_blocked(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    cal_id = _ensure_calendar(sb, tenant_id)
    now = datetime.now(timezone.utc).isoformat()
    res = (
        sb.table("blocked_period")
        .select("*")
        .eq("calendar_id", cal_id)
        .gte("end_at", now)
        .order("start_at")
        .execute()
    )
    return res.data


@router.post("/blocked", status_code=201)
async def create_blocked(body: BlockedPeriodIn, tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    cal_id = _ensure_calendar(sb, tenant_id)
    row: dict = {
        "calendar_id": cal_id,
        "start_at": body.start_at.isoformat(),
        "end_at": body.end_at.isoformat(),
        "reason": body.reason,
        "created_by": "user",
    }
    if body.color:
        row["color"] = body.color
    res = sb.table("blocked_period").insert(row).execute()
    return res.data[0]


@router.patch("/blocked/{period_id}")
async def update_blocked(body: BlockedPeriodIn, period_id: UUID, tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    cal_id = _ensure_calendar(sb, tenant_id)
    row: dict = {
        "start_at": body.start_at.isoformat(),
        "end_at": body.end_at.isoformat(),
        "reason": body.reason,
    }
    if body.color:
        row["color"] = body.color
    res = sb.table("blocked_period").update(row).eq("id", str(period_id)).eq("calendar_id", cal_id).execute()
    if not res.data:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Blocage introuvable")
    return res.data[0]


@router.delete("/blocked/{period_id}")
async def delete_blocked(period_id: UUID, tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    cal_id = _ensure_calendar(sb, tenant_id)
    sb.table("blocked_period").delete().eq("id", str(period_id)).eq("calendar_id", cal_id).execute()
    return {"deleted": True}


# ── Contacts (recherche pour création inline) ─────────────────────────────────

@router.get("/contacts")
async def search_contacts(q: str = "", tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    query = sb.table("contact").select("id, first_name, last_name, email, phone").eq("tenant_id", tenant_id)
    if q:
        query = query.or_(f"first_name.ilike.%{q}%,last_name.ilike.%{q}%,email.ilike.%{q}%")
    return query.order("last_name").limit(10).execute().data


# ── Rendez-vous (vue calendrier) ──────────────────────────────────────────────

@router.post("/appointments", status_code=201)
async def create_calendar_appointment(body: CalendarApptIn, tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    cal_id = _ensure_calendar(sb, tenant_id)

    if body.contact_id:
        contact_id = str(body.contact_id)
    else:
        new_c = sb.table("contact").insert({
            "tenant_id": tenant_id,
            "first_name": body.first_name or "",
            "last_name": body.last_name or "",
            "email": body.email or "",
            "phone": body.phone,
            "source": body.source,
        }).execute().data[0]
        contact_id = new_c["id"]

    ensure_lead(sb, tenant_id, contact_id, body.source or "dashboard", status="scheduled", request_type="b2c_appointment")

    res = sb.table("appointment").insert({
        "calendar_id": cal_id,
        "contact_id": contact_id,
        "service_offer_id": str(body.service_offer_id) if body.service_offer_id else None,
        "scheduled_at": body.scheduled_at.isoformat(),
        "end_at": body.end_at.isoformat(),
        "status": "confirmed",
        "type": "b2c_appointment",
        "audience_type": "b2c",
    }).execute()
    return res.data[0]


@router.get("/appointments")
async def get_calendar_appointments(
    start: Optional[str] = None,
    end: Optional[str] = None,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase()
    cal_id = _ensure_calendar(sb, tenant_id)
    q = (
        sb.table("appointment")
        .select("id, status, scheduled_at, end_at, notes, service_offer_id, contact_id, contact(first_name, last_name, email, phone), service_offer(name)")
        .eq("calendar_id", cal_id)
        .neq("status", "cancelled")
    )
    if start:
        q = q.gte("scheduled_at", start)
    if end:
        q = q.lte("scheduled_at", end)
    return q.order("scheduled_at").execute().data
