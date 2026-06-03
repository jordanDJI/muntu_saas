"""
Endpoint public de réservation (sans auth).
GET  /api/v1/booking/{tenant_slug}/slots?date=YYYY-MM-DD  → créneaux disponibles
POST /api/v1/booking/{tenant_slug}/book                   → créer contact + RDV ou lead
"""
import logging
from calendar import monthrange
from datetime import datetime, timedelta, timezone, time as dtime, date
from fastapi import APIRouter, HTTPException, Request, status
from app.core.supabase import get_supabase_admin
from app.middleware.rate_limit import check_rate
from app.models.calendar import PublicBookIn
from app.services.lead import ensure_lead

router = APIRouter(prefix="/booking", tags=["Booking"])
logger = logging.getLogger(__name__)


@router.get("/{tenant_slug}/available-days")
async def get_available_days(tenant_slug: str, year: int, month: int, request: Request):
    """
    Retourne les numéros de jours du mois ayant des créneaux disponibles.
    Utilisé par le calendrier public pour griser les jours sans disponibilité.
    """
    check_rate(request, "available_days", max_calls=60, window_seconds=60)

    now_year = datetime.now(timezone.utc).year
    if not (now_year <= year <= now_year + 2) or not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="Paramètres year/month invalides")

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
async def get_available_slots(tenant_slug: str, date: str, request: Request):
    """Retourne les créneaux libres pour une date donnée (YYYY-MM-DD)."""
    check_rate(request, "slots", max_calls=60, window_seconds=60)
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


def _get_team_emails(sb, tenant_id: str) -> set[str]:
    """Retourne les emails de l'équipe du tenant pour bloquer les auto-réservations."""
    emails: set[str] = set()
    for s in (sb.table("site").select("email_contact").eq("tenant_id", tenant_id).execute().data or []):
        if s.get("email_contact"):
            emails.add(s["email_contact"].strip().lower())
    for m in (sb.table("membership").select("user_id").eq("tenant_id", tenant_id).execute().data or []):
        try:
            u = sb.auth.admin.get_user_by_id(m["user_id"])
            if u and u.user and u.user.email:
                emails.add(u.user.email.strip().lower())
        except Exception:
            pass
    return emails


_TEAM_EMAIL_ERROR = (
    "Cette adresse email appartient à l'équipe du professionnel. "
    "Vous ne pouvez pas effectuer une réservation ou envoyer un message public avec cet email. "
    "Contactez directement le professionnel pour toute question interne."
)


@router.post("/{tenant_slug}/book", status_code=status.HTTP_201_CREATED)
async def book_appointment(tenant_slug: str, body: PublicBookIn, request: Request):
    check_rate(request, "book", max_calls=5, window_seconds=300)  # 5 résa / IP / 5 min
    sb = get_supabase_admin()
    tenant, cal_id = _get_tenant_and_calendar(sb, tenant_slug)

    # Bloquer les emails de l'équipe
    if body.email and body.email.strip().lower() in _get_team_emails(sb, tenant["id"]):
        raise HTTPException(status_code=403, detail=_TEAM_EMAIL_ERROR)

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
            "contact_type": body.contact_type,
        }).execute().data[0]
        contact_id = new_contact["id"]

    # Prise de contact simple → lead
    if body.request_type == "contact":
        lead_row: dict = {
            "tenant_id": tenant["id"],
            "contact_id": contact_id,
            "source": "website",
            "status": "new",
            "request_type": "contact",
            "audience_type": "b2c",
        }
        if body.message and body.message.strip():
            lead_row["notes"] = body.message.strip()
        lead = sb.table("lead").insert(lead_row).execute().data[0]
        contact_name = f"{body.first_name} {body.last_name}".strip()
        # Accusé de réception au visiteur
        try:
            from app.services.email import send_lead_acknowledgement
            send_lead_acknowledgement(body.email, contact_name, tenant.get("name", ""))
        except Exception as exc:
            logger.error("Email client lead ack failed: %s", exc)
        # Notification au tenant avec le message du visiteur
        try:
            from app.services.email import send_lead_notification
            site_res = sb.table("site").select("email_contact").eq("tenant_id", tenant["id"]).execute()
            tenant_email = (site_res.data or [{}])[0].get("email_contact") if site_res.data else None
            if tenant_email:
                send_lead_notification(
                    tenant_email,
                    lead,
                    {"first_name": body.first_name, "last_name": body.last_name,
                     "email": body.email, "phone": body.phone},
                )
        except Exception as exc:
            logger.error("Email tenant lead notification failed: %s", exc)
        return {"type": "lead", "id": lead["id"]}

    # Prise de rendez-vous
    if not body.scheduled_at:
        raise HTTPException(status_code=400, detail="scheduled_at requis pour un rendez-vous")

    ensure_lead(sb, tenant["id"], contact_id, "website", status="scheduled",
                request_type="b2c_appointment", notes=body.message or None)

    end_at = body.scheduled_at + timedelta(minutes=body.slot_duration_min)

    # Vérification anti-double réservation (TOCTOU) : le créneau est-il encore libre ?
    conflict = (
        sb.table("appointment")
        .select("id")
        .eq("calendar_id", cal_id)
        .neq("status", "cancelled")
        .lt("scheduled_at", end_at.isoformat())
        .gt("end_at", body.scheduled_at.isoformat())
        .limit(1)
        .execute()
    )
    if conflict.data:
        raise HTTPException(
            status_code=409,
            detail="Ce créneau vient d'être réservé. Veuillez choisir un autre horaire.",
        )

    appt_row: dict = {
        "calendar_id": cal_id,
        "contact_id": contact_id,
        "service_offer_id": str(body.service_offer_id) if body.service_offer_id else None,
        "scheduled_at": body.scheduled_at.isoformat(),
        "end_at": end_at.isoformat(),
        "status": "pending",
        "type": "b2c_appointment",
        "audience_type": "b2c",
    }
    if body.message and body.message.strip():
        appt_row["notes"] = body.message.strip()

    appt = sb.table("appointment").insert(appt_row).execute().data[0]

    # Notifier le tenant via Telegram/WhatsApp + email (avec le message du visiteur)
    _notify_tenant_pending(sb, tenant["id"], body.first_name, body.last_name,
                           body.scheduled_at.isoformat(), message=body.message)
    _email_tenant_pending(sb, tenant, {"first_name": body.first_name, "last_name": body.last_name,
                                        "email": body.email, "phone": body.phone}, appt,
                          message=body.message)

    # Accusé de réception au client
    _email_client_booking_received(tenant, body.first_name, body.last_name, body.email, appt)

    return {"type": "appointment", "id": appt["id"]}


def _email_tenant_pending(sb, tenant: dict, contact: dict, appointment: dict, message: str | None = None) -> None:
    """Envoie un email au professionnel pour lui signaler le nouveau RDV en attente."""
    try:
        site_res = (
            sb.table("site")
            .select("email_contact")
            .eq("tenant_id", tenant["id"])
            .execute()
        )
        tenant_email = (site_res.data or [{}])[0].get("email_contact") if site_res.data else None
        if not tenant_email:
            return
        from app.services.email import send_appointment_pending_tenant
        from app.core.config import settings
        dashboard_url = f"{settings.frontend_url}/dashboard/appointments"
        send_appointment_pending_tenant(
            tenant_email=tenant_email,
            tenant_name=tenant.get("name", ""),
            contact=contact,
            appointment=appointment,
            dashboard_url=dashboard_url,
            message=message,
        )
    except Exception as exc:
        logger.error("Email tenant pending failed: %s", exc)


def _email_client_booking_received(tenant: dict, first_name: str, last_name: str, email: str, appointment: dict) -> None:
    """Envoie un accusé de réception au client après sa demande de rendez-vous."""
    try:
        from app.services.email import send_booking_request_received
        contact_name = f"{first_name} {last_name}".strip()
        send_booking_request_received(
            contact_email=email,
            contact_name=contact_name,
            appointment=appointment,
            tenant_name=tenant.get("name", ""),
        )
    except Exception as exc:
        logger.error("Email client booking received failed: %s", exc)


def _notify_tenant_pending(sb, tenant_id: str, first_name: str, last_name: str,
                            scheduled_at: str, message: str | None = None) -> None:
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
    )
    if message and message.strip():
        msg += f"Message : {message.strip()}\n"
    msg += f"Répondez 'confirme {first_name}' ou 'annule {first_name}' pour traiter ce RDV."

    if cfg.get("whatsapp_number"):
        from app.services.whatsapp import send_text
        send_text(cfg["whatsapp_number"], msg)

    if cfg.get("telegram_bot_token") and cfg.get("telegram_notify_chat_id"):
        from app.services.telegram import send_message
        send_message(cfg["telegram_bot_token"], cfg["telegram_notify_chat_id"], msg)
