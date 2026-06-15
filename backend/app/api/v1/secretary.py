from fastapi import APIRouter, Depends, Query, HTTPException
from datetime import date, timedelta
from typing import Optional
from pydantic import BaseModel

from app.middleware.tenant import get_current_user
from app.core.supabase import get_supabase_admin

router = APIRouter(prefix="/secretary", tags=["secretary"])

TENANT_COLORS = ["#0D9488", "#2563EB", "#7C3AED", "#EA580C", "#16A34A", "#DC2626", "#D97706", "#0891B2"]


class SecretaryApptUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


def _get_secretary_tenants(sb, user_id: str) -> list[tuple[str, dict]]:
    """Returns [(tenant_id, tenant_row), ...] for tenants where this user has role='secretary'."""
    res = (
        sb.table("membership")
        .select("tenant_id, tenant(id, name, slug)")
        .eq("user_id", user_id)
        .eq("role", "secretary")
        .execute()
    )
    return [
        (m["tenant_id"], m.get("tenant") or {})
        for m in (res.data or [])
        if m.get("tenant")
    ]


@router.get("/appointments")
async def get_secretary_appointments(
    view: str = Query("day"),
    date_str: str = Query(..., alias="date"),
    user: dict = Depends(get_current_user),
):
    """Return all appointments across all tenants for this user, for a given date/week."""
    sb = get_supabase_admin()
    tenant_rows = _get_secretary_tenants(sb, user["sub"])

    if not tenant_rows:
        return []

    try:
        target = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(400, "Invalid date format, expected YYYY-MM-DD")

    if view == "week":
        start = target - timedelta(days=target.weekday())
        end = start + timedelta(days=6)
    elif view == "month":
        start = target.replace(day=1)
        # premier jour du mois suivant - 1 jour = dernier jour du mois courant
        if start.month == 12:
            end = start.replace(year=start.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            end = start.replace(month=start.month + 1, day=1) - timedelta(days=1)
    else:
        start = end = target

    start_str = start.isoformat()
    end_str = (end + timedelta(days=1)).isoformat()

    all_appts = []
    for i, (tenant_id, tenant) in enumerate(tenant_rows):
        cal_res = sb.table("calendar").select("id").eq("tenant_id", tenant_id).limit(1).execute()
        if not cal_res.data:
            continue
        cal_id = cal_res.data[0]["id"]

        appts_res = sb.table("appointment").select(
            "id, status, scheduled_at, end_at, notes, party_size, "
            "contact(id, first_name, last_name, email, phone)"
        ).eq("calendar_id", cal_id).gte("scheduled_at", start_str).lt(
            "scheduled_at", end_str
        ).neq("status", "cancelled").order("scheduled_at").execute()

        for a in (appts_res.data or []):
            c = a.get("contact") or {}
            name = f"{c.get('first_name', '')} {c.get('last_name', '')}".strip() or c.get("email") or "—"
            all_appts.append({
                **a,
                "tenant_id": tenant_id,
                "tenant_name": tenant.get("name", ""),
                "tenant_slug": tenant.get("slug", ""),
                "tenant_color": TENANT_COLORS[i % len(TENANT_COLORS)],
                "contact_name": name,
            })

    all_appts.sort(key=lambda a: a.get("scheduled_at") or "")
    return all_appts


@router.patch("/appointments/{appointment_id}")
async def update_secretary_appointment(
    appointment_id: str,
    body: SecretaryApptUpdate,
    user: dict = Depends(get_current_user),
):
    """Update status and/or notes of an appointment belonging to any of the user's tenants."""
    sb = get_supabase_admin()
    tenant_rows = _get_secretary_tenants(sb, user["sub"])
    tenant_ids = [tid for tid, _ in tenant_rows]

    if not tenant_ids:
        raise HTTPException(403, "Access denied")

    appt_res = sb.table("appointment").select(
        "id, status, calendar(tenant_id)"
    ).eq("id", appointment_id).maybe_single().execute()

    if not appt_res.data:
        raise HTTPException(404, "Appointment not found")

    cal = appt_res.data.get("calendar") or {}
    if cal.get("tenant_id") not in tenant_ids:
        raise HTTPException(403, "Access denied")

    update = body.model_dump(exclude_none=True)
    if not update:
        raise HTTPException(400, "No fields to update")

    result = sb.table("appointment").update(update).eq("id", appointment_id).execute()
    return result.data[0] if result.data else {}
