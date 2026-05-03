"""
Endpoint public de réservation (sans auth).
GET  /api/v1/booking/{tenant_slug}/slots?date=YYYY-MM-DD  → créneaux disponibles
POST /api/v1/booking/{tenant_slug}/book                   → créer contact + RDV ou lead
"""
import logging
from calendar import monthrange
from datetime import datetime, timedelta, timezone, time as dtime, date
from fastapi import APIRouter, HTTPException, status
from app.core.supabase import get_supabase_admin
from app.models.calendar import PublicBookIn
from app.services.lead import ensure_lead

router = APIRouter(prefix="/booking", tags=["Booking"])
logger = logging.getLogger(__name__)


@router.get("/{tenant_slug}/available-days")
async def get_available_days(tenant_slug: str, year: int, month: int):
    """
    Retourne les numéros de jours du mois ayant des créneaux disponibles.
    Utilisé par le calendrier public pour griser les jours sans disponibilité.
    """
    sb = get_supabase_admin()
    _, cal_id = _get_tenant_and_calendar(sb, tenant_slug)

    avail_res = (
        sb.table("availability_slot")
        .select("day_of_week")
        .eq("calendar_id", cal_id)
        .eq("is_active", True)
        .execute()
    )
    available_weekdays: set[int] = {row["day_of_week"] for row in avail_res.data}

    if not available_weekdays:
        return []

    # Périodes bloquées sur le mois entier
    _, days_in_month = monthrange(year, month)
    month_start = datetime(year, month, 1, tzinfo=timezone.utc)
    month_end = datetime(year, month, days_in_month, 23, 59, 59, tzinfo=timezone.utc)

    blocked_res = (
        sb.table("blocked_period")
        .select("start_at, end_at")
        .eq("calendar_id", cal_id)
        .lte("start_at", month_end.isoformat())
        .gte("end_at", month_start.isoformat())
        .execute()
    )
    full_day_blocks: list[tuple[datetime, datetime]] = [
        (
            datetime.fromisoformat(b["start_at"].replace("Z", "+00:00")),
            datetime.fromisoformat(b["end_at"].replace("Z", "+00:00")),
        )
        for b in blocked_res.data
    ]

    today = datetime.now(timezone.utc).date()
    result: list[int] = []

    for day_num in range(1, days_in_month + 1):
        d = date(year, month, day_num)
        if d < today:
            continue
        if d.weekday() not in available_weekdays:
            continue
        # Vérifie si le jour entier est bloqué
        day_start = datetime.combine(d, dtime.min).replace(tzinfo=timezone.utc)
        day_end = datetime.combine(d, dtime.max).replace(tzinfo=timezone.utc)
        fully_blocked = any(b_s <= day_start and b_e >= day_end for b_s, b_e in full_day_blocks)
        if not fully_blocked:
            result.append(day_num)

    return result


def _get_tenant_and_calendar(sb, tenant_slug: str) -> tuple[dict, str]:
    tenant_res = (
        sb.table("tenant")
        .select("id, name")
        .eq("slug", tenant_slug)
        .neq("is_active", False)
        .single()
        .execute()
    )
    if not tenant_res.data:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    tenant = tenant_res.data

    cal_res = sb.table("calendar").select("id").eq("tenant_id", tenant["id"]).execute()
    if not cal_res.data:
        raise HTTPException(status_code=404, detail="Calendrier non configuré")
    return tenant, cal_res.data[0]["id"]


@router.get("/{tenant_slug}/slots")
async def get_available_slots(tenant_slug: str, date: str):
    """Retourne les créneaux libres pour une date donnée (YYYY-MM-DD)."""
    sb = get_supabase_admin()
    _, cal_id = _get_tenant_and_calendar(sb, tenant_slug)

    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide (YYYY-MM-DD)")

    day_of_week = target_date.weekday()  # 0=Lun, 6=Dim

    avail_res = (
        sb.table("availability_slot")
        .select("*")
        .eq("calendar_id", cal_id)
        .eq("day_of_week", day_of_week)
        .eq("is_active", True)
        .execute()
    )
    if not avail_res.data:
        return []

    day_start = datetime.combine(target_date, dtime.min).replace(tzinfo=timezone.utc)
    day_end = datetime.combine(target_date, dtime.max).replace(tzinfo=timezone.utc)

    appts_res = (
        sb.table("appointment")
        .select("scheduled_at, end_at")
        .eq("calendar_id", cal_id)
        .neq("status", "cancelled")
        .gte("scheduled_at", day_start.isoformat())
        .lte("scheduled_at", day_end.isoformat())
        .execute()
    )
    busy = [
        (
            datetime.fromisoformat(a["scheduled_at"].replace("Z", "+00:00")),
            datetime.fromisoformat(a["end_at"].replace("Z", "+00:00")),
        )
        for a in appts_res.data
    ]

    blocked_res = (
        sb.table("blocked_period")
        .select("start_at, end_at")
        .eq("calendar_id", cal_id)
        .lte("start_at", day_end.isoformat())
        .gte("end_at", day_start.isoformat())
        .execute()
    )
    busy += [
        (
            datetime.fromisoformat(b["start_at"].replace("Z", "+00:00")),
            datetime.fromisoformat(b["end_at"].replace("Z", "+00:00")),
        )
        for b in blocked_res.data
    ]

    slots = []
    now = datetime.now(timezone.utc)

    for avail in avail_res.data:
        h_s, m_s = map(int, avail["start_time"][:5].split(":"))
        h_e, m_e = map(int, avail["end_time"][:5].split(":"))
        duration = avail["slot_duration_min"]

        slot_start = datetime.combine(target_date, dtime(h_s, m_s)).replace(tzinfo=timezone.utc)
        period_end = datetime.combine(target_date, dtime(h_e, m_e)).replace(tzinfo=timezone.utc)

        while slot_start + timedelta(minutes=duration) <= period_end:
            slot_end = slot_start + timedelta(minutes=duration)
            is_busy = any(s < slot_end and slot_start < e for s, e in busy)
            if not is_busy and slot_start > now:
                slots.append({
                    "start": slot_start.isoformat(),
                    "end": slot_end.isoformat(),
                    "label": slot_start.strftime("%H:%M"),
                })
            slot_start = slot_end

    return slots


@router.post("/{tenant_slug}/book", status_code=status.HTTP_201_CREATED)
async def book_appointment(tenant_slug: str, body: PublicBookIn):
    sb = get_supabase_admin()
    tenant, cal_id = _get_tenant_and_calendar(sb, tenant_slug)

    # Trouver ou créer le contact
    contact_res = (
        sb.table("contact")
        .select("id")
        .eq("tenant_id", tenant["id"])
        .eq("email", body.email)
        .execute()
    )
    if contact_res.data:
        contact_id = contact_res.data[0]["id"]
    else:
        new_contact = sb.table("contact").insert({
            "tenant_id": tenant["id"],
            "first_name": body.first_name,
            "last_name": body.last_name,
            "email": body.email,
            "phone": body.phone,
        }).execute().data[0]
        contact_id = new_contact["id"]

    # Prise de contact simple → lead
    if body.request_type == "contact":
        lead = sb.table("lead").insert({
            "tenant_id": tenant["id"],
            "contact_id": contact_id,
            "source": "website",
            "status": "new",
            "request_type": "contact",
            "audience_type": "b2c",
            "notes": body.message,
        }).execute().data[0]
        return {"type": "lead", "id": lead["id"]}

    # Prise de rendez-vous
    if not body.scheduled_at:
        raise HTTPException(status_code=400, detail="scheduled_at requis pour un rendez-vous")

    ensure_lead(sb, tenant["id"], contact_id, "website")

    end_at = body.scheduled_at + timedelta(minutes=body.slot_duration_min)

    # Le RDV est créé en attente — la confirmation (et l'email client) sont déclenchés
    # manuellement par le tenant depuis son dashboard ou via l'Agent 3.
    appt = sb.table("appointment").insert({
        "calendar_id": cal_id,
        "contact_id": contact_id,
        "service_offer_id": str(body.service_offer_id) if body.service_offer_id else None,
        "scheduled_at": body.scheduled_at.isoformat(),
        "end_at": end_at.isoformat(),
        "status": "pending",
        "type": "b2c_appointment",
        "audience_type": "b2c",
    }).execute().data[0]

    # Notifier le tenant (Telegram + WhatsApp) qu'un nouveau RDV est en attente
    _notify_tenant_pending(sb, tenant["id"], body.first_name, body.last_name, body.scheduled_at.isoformat())

    return {"type": "appointment", "id": appt["id"]}


def _notify_tenant_pending(sb, tenant_id: str, first_name: str, last_name: str, scheduled_at: str) -> None:
    """Notifie le tenant via Telegram/WhatsApp qu'un nouveau RDV est en attente de confirmation."""
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

    contact_name = f"{first_name} {last_name}".strip() or "Prospect"
    msg = (
        f"Nouveau RDV en attente de confirmation :\n"
        f"{contact_name} — {date_str}\n"
        f"Répondez 'confirme {first_name}' ou 'annule {first_name}' pour traiter ce RDV."
    )

    if cfg.get("whatsapp_number"):
        from app.services.whatsapp import send_text
        send_text(cfg["whatsapp_number"], msg)

    if cfg.get("telegram_bot_token") and cfg.get("telegram_notify_chat_id"):
        from app.services.telegram import send_message
        send_message(cfg["telegram_bot_token"], cfg["telegram_notify_chat_id"], msg)
