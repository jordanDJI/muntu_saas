"""
Endpoint public de réservation (sans auth).
GET  /api/v1/booking/{tenant_slug}/slots?date=YYYY-MM-DD  → créneaux disponibles
POST /api/v1/booking/{tenant_slug}/book                   → créer contact + RDV ou lead
"""
import logging
from calendar import monthrange
from datetime import datetime, timedelta, timezone, time as dtime, date
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
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
    Retourne les numéros de jours du mois ayant au moins un créneau réservable.
    Un créneau est réservable s'il est dans le futur, non bloqué, et pas à capacité pleine.
    """
    check_rate(request, "available_days", max_calls=60, window_seconds=60)

    now_year = datetime.now(timezone.utc).year
    if not (now_year <= year <= now_year + 2) or not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="Paramètres year/month invalides")

    sb = get_supabase_admin()
    tenant, cal_id = _get_tenant_and_calendar(sb, tenant_slug)
    tz = _tenant_tz(tenant)

    # Créneaux de disponibilité (tous les jours configurés)
    avail_res = (
        sb.table("availability_slot")
        .select("*")
        .eq("calendar_id", cal_id)
        .eq("is_active", True)
        .execute()
    )
    if not avail_res.data:
        return []

    available_weekdays: set[int] = {row["day_of_week"] for row in avail_res.data}
    avail_by_weekday: dict[int, list] = {}
    for row in avail_res.data:
        avail_by_weekday.setdefault(row["day_of_week"], []).append(row)

    _, days_in_month = monthrange(year, month)
    month_start = datetime(year, month, 1, tzinfo=timezone.utc)
    month_end = datetime(year, month, days_in_month, 23, 59, 59, tzinfo=timezone.utc)

    # Périodes bloquées du mois
    blocked_res = (
        sb.table("blocked_period")
        .select("start_at, end_at")
        .eq("calendar_id", cal_id)
        .lte("start_at", month_end.isoformat())
        .gte("end_at", month_start.isoformat())
        .execute()
    )
    blocked_periods: list[tuple[datetime, datetime]] = []
    for b in blocked_res.data:
        try:
            if b.get("start_at") and b.get("end_at"):
                bs = datetime.fromisoformat(str(b["start_at"]).replace("Z", "+00:00"))
                be = datetime.fromisoformat(str(b["end_at"]).replace("Z", "+00:00"))
                # S'assurer que les datetimes sont UTC-aware
                if bs.tzinfo is None:
                    bs = bs.replace(tzinfo=timezone.utc)
                if be.tzinfo is None:
                    be = be.replace(tzinfo=timezone.utc)
                blocked_periods.append((bs, be))
        except Exception as exc:
            logger.warning("available-days: blocked_period ignoré (parse error): %s", exc)

    # RDV du mois (pour vérifier la capacité)
    appts_res = (
        sb.table("appointment")
        .select("scheduled_at, end_at")
        .eq("calendar_id", cal_id)
        .neq("status", "cancelled")
        .gte("scheduled_at", month_start.isoformat())
        .lte("scheduled_at", month_end.isoformat())
        .execute()
    )
    month_appts: list[tuple[datetime, datetime]] = []
    for a in appts_res.data:
        try:
            if a.get("scheduled_at") and a.get("end_at"):
                s = datetime.fromisoformat(str(a["scheduled_at"]).replace("Z", "+00:00"))
                e = datetime.fromisoformat(str(a["end_at"]).replace("Z", "+00:00"))
                # Heure locale naive → UTC via tz du tenant pour comparer avec les slots (UTC)
                if s.tzinfo is None:
                    s = s.replace(tzinfo=tz).astimezone(timezone.utc)
                if e.tzinfo is None:
                    e = e.replace(tzinfo=tz).astimezone(timezone.utc)
                month_appts.append((s, e))
        except Exception as exc:
            logger.warning("available-days: appointment ignoré (parse error): %s", exc)

    today = datetime.now(timezone.utc).date()
    now = datetime.now(timezone.utc)
    result: list[int] = []

    for day_num in range(1, days_in_month + 1):
        try:
            d = date(year, month, day_num)
            if d < today:
                continue
            if d.weekday() not in available_weekdays:
                continue

            day_start = datetime.combine(d, dtime.min).replace(tzinfo=timezone.utc)
            day_end = datetime.combine(d, dtime.max).replace(tzinfo=timezone.utc)

            # Jour entièrement bloqué par une période manuelle ?
            if any(b_s <= day_start and b_e >= day_end for b_s, b_e in blocked_periods):
                continue

            # Périodes bloquées partiellement ce jour
            day_blocked = [(bs, be) for bs, be in blocked_periods if bs < day_end and day_start < be]
            # RDV de ce jour
            day_appts = [(s, e) for s, e in month_appts if day_start <= s <= day_end]

            # Cherche au moins un créneau réservable (futur + non bloqué + capacité dispo)
            has_slot = False
            for avail in avail_by_weekday.get(d.weekday(), []):
                h_s, m_s = map(int, str(avail["start_time"])[:5].split(":"))
                h_e, m_e = map(int, str(avail["end_time"])[:5].split(":"))
                duration = int(avail.get("slot_duration_min") or 30)
                capacity = int(avail.get("capacity") or 1)

                slot_start = _local_slot(d, h_s, m_s, tz)
                period_end = _local_slot(d, h_e, m_e, tz)

                while slot_start + timedelta(minutes=duration) <= period_end:
                    slot_end = slot_start + timedelta(minutes=duration)

                    if slot_start <= now:
                        slot_start = slot_end
                        continue

                    if any(bs < slot_end and slot_start < be for bs, be in day_blocked):
                        slot_start = slot_end
                        continue

                    booked = sum(1 for s, e in day_appts if s < slot_end and slot_start < e)
                    if booked < capacity:
                        has_slot = True
                        break

                    slot_start = slot_end

                if has_slot:
                    break

            if has_slot:
                result.append(day_num)
        except Exception as exc:
            logger.error("available-days: erreur jour %s/%s/%s : %s", year, month, day_num, exc)

    return result


def _get_tenant_and_calendar(sb, tenant_slug: str) -> tuple[dict, str]:
    tenant_res = (
        sb.table("tenant")
        .select("id, name, timezone")
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


def _tenant_tz(tenant: dict) -> ZoneInfo:
    """Retourne le ZoneInfo du tenant, avec fallback sur UTC si invalide."""
    try:
        return ZoneInfo(tenant.get("timezone") or "UTC")
    except (ZoneInfoNotFoundError, KeyError):
        return ZoneInfo("UTC")


def _local_slot(d: date, h: int, m: int, tz: ZoneInfo) -> datetime:
    """Crée un datetime UTC à partir d'une heure locale (h:m) dans la timezone du tenant."""
    return datetime(d.year, d.month, d.day, h, m, tzinfo=tz).astimezone(timezone.utc)


@router.get("/{tenant_slug}/slots")
async def get_available_slots(tenant_slug: str, date: str, request: Request):
    """Retourne les créneaux libres pour une date donnée (YYYY-MM-DD)."""
    check_rate(request, "slots", max_calls=60, window_seconds=60)
    sb = get_supabase_admin()
    tenant, cal_id = _get_tenant_and_calendar(sb, tenant_slug)
    tz = _tenant_tz(tenant)

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
    appointments: list[tuple[datetime, datetime]] = []
    for a in appts_res.data:
        try:
            if a.get("scheduled_at") and a.get("end_at"):
                s = datetime.fromisoformat(str(a["scheduled_at"]).replace("Z", "+00:00"))
                e = datetime.fromisoformat(str(a["end_at"]).replace("Z", "+00:00"))
                # Les RDV créés depuis le dashboard ou après notre fix timezone sont stockés
                # en heure locale naive. Il faut les convertir en UTC (via le tz du tenant)
                # avant de les comparer aux slots (qui sont toujours en UTC).
                if s.tzinfo is None:
                    s = s.replace(tzinfo=tz).astimezone(timezone.utc)
                if e.tzinfo is None:
                    e = e.replace(tzinfo=tz).astimezone(timezone.utc)
                appointments.append((s, e))
        except Exception as exc:
            logger.warning("slots: appointment ignoré (parse error): %s", exc)

    blocked_res = (
        sb.table("blocked_period")
        .select("start_at, end_at")
        .eq("calendar_id", cal_id)
        .lte("start_at", day_end.isoformat())
        .gte("end_at", day_start.isoformat())
        .execute()
    )
    blocked_periods: list[tuple[datetime, datetime]] = []
    for b in blocked_res.data:
        try:
            if b.get("start_at") and b.get("end_at"):
                bs = datetime.fromisoformat(str(b["start_at"]).replace("Z", "+00:00"))
                be = datetime.fromisoformat(str(b["end_at"]).replace("Z", "+00:00"))
                if bs.tzinfo is None:
                    bs = bs.replace(tzinfo=timezone.utc)
                if be.tzinfo is None:
                    be = be.replace(tzinfo=timezone.utc)
                blocked_periods.append((bs, be))
        except Exception as exc:
            logger.warning("slots: blocked_period ignoré (parse error): %s", exc)

    slots = []
    now = datetime.now(timezone.utc)

    for avail in avail_res.data:
        h_s, m_s = map(int, str(avail["start_time"])[:5].split(":"))
        h_e, m_e = map(int, str(avail["end_time"])[:5].split(":"))
        duration = int(avail.get("slot_duration_min") or 30)
        capacity       = int(avail.get("capacity") or 1)
        max_party_size = avail.get("max_party_size") or 1  # 1 = solo par défaut

        # Interprète les heures en heure locale du tenant → UTC
        slot_start = _local_slot(target_date, h_s, m_s, tz)
        period_end = _local_slot(target_date, h_e, m_e, tz)

        while slot_start + timedelta(minutes=duration) <= period_end:
            slot_end = slot_start + timedelta(minutes=duration)

            if slot_start <= now:
                slot_start = slot_end
                continue

            if any(s < slot_end and slot_start < e for s, e in blocked_periods):
                slot_start = slot_end
                continue

            booked = sum(1 for s, e in appointments if s < slot_end and slot_start < e)
            spots_left = capacity - booked

            if spots_left > 0:
                # Label en heure locale du tenant
                local_label = slot_start.astimezone(tz).strftime("%H:%M")
                slot_data: dict = {
                    "start": slot_start.isoformat(),
                    "end": slot_end.isoformat(),
                    "label": local_label,
                }
                if capacity > 1:
                    slot_data["spots_left"] = spots_left
                    slot_data["capacity"] = capacity
                slot_data["max_party_size"] = max_party_size  # toujours inclus
                slots.append(slot_data)

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
            from app.services.email import send_lead_acknowledgement, get_tenant_brand
            brand = get_tenant_brand(sb, tenant["id"])
            send_lead_acknowledgement(
                body.email,
                contact_name,
                tenant.get("name", ""),
                primary_color=brand["primary_color"],
                logo_url=brand["logo_url"],
                logo_option=brand["logo_option"],
            )
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

    # Convertir l'heure UTC reçue du frontend en heure locale naive du tenant.
    # Les RDV créés depuis le dashboard sont déjà en heure locale naive (via toLocalISO()),
    # cette conversion assure la cohérence d'affichage pour les deux sources.
    tz = _tenant_tz(tenant)
    if body.scheduled_at.tzinfo is not None:
        scheduled_at_store = body.scheduled_at.astimezone(tz).replace(tzinfo=None)
    else:
        scheduled_at_store = body.scheduled_at
    end_at = scheduled_at_store + timedelta(minutes=body.slot_duration_min)

    # Vérification anti-double réservation (TOCTOU)
    target_date_val = scheduled_at_store.date()
    day_of_week = target_date_val.weekday()
    avail_check = (
        sb.table("availability_slot")
        .select("capacity, max_party_size")
        .eq("calendar_id", cal_id)
        .eq("day_of_week", day_of_week)
        .eq("is_active", True)
        .execute()
    )
    slot_capacity  = 1
    max_party_size = 1  # défaut : solo
    for avail in avail_check.data or []:
        slot_capacity  = max(slot_capacity, int(avail.get("capacity") or 1))
        mps = int(avail.get("max_party_size") or 1)
        if mps > max_party_size:
            max_party_size = mps

    # Règle 2 : groupe trop grand
    if body.party_size > max_party_size:
        _DAYS_FR = {0:"Lundi",1:"Mardi",2:"Mercredi",3:"Jeudi",4:"Vendredi",5:"Samedi",6:"Dimanche"}
        _day_name = _DAYS_FR.get(day_of_week, "")
        raise HTTPException(
            status_code=400,
            detail=f"Le nombre de personnes maximum par réservation des {_day_name} pour cette période est de {max_party_size} personne(s).",
        )

    # Règle 1 : créneau plein (nb de réservations simultanées)
    existing = (
        sb.table("appointment")
        .select("id")
        .eq("calendar_id", cal_id)
        .neq("status", "cancelled")
        .lt("scheduled_at", end_at.isoformat())
        .gt("end_at", scheduled_at_store.isoformat())
        .execute()
    )
    booked_count = len(existing.data or [])
    if booked_count >= slot_capacity:
        spots_left = max(0, slot_capacity - booked_count)
        detail = (
            "Ce créneau vient d'être réservé. Veuillez choisir un autre horaire."
            if slot_capacity == 1
            else "Ce créneau est complet. Veuillez choisir un autre horaire."
        )
        raise HTTPException(status_code=409, detail=detail)

    appt_row: dict = {
        "calendar_id": cal_id,
        "contact_id": contact_id,
        "service_offer_id": str(body.service_offer_id) if body.service_offer_id else None,
        "scheduled_at": scheduled_at_store.isoformat(),
        "end_at": end_at.isoformat(),
        "status": "pending",
        "type": "b2c_appointment",
        "audience_type": "b2c",
        "party_size": body.party_size,
    }
    if body.message and body.message.strip():
        appt_row["notes"] = body.message.strip()

    appt = sb.table("appointment").insert(appt_row).execute().data[0]

    # Notifier le tenant via Telegram/WhatsApp + email (avec le message du visiteur)
    _notify_tenant_pending(sb, tenant["id"], body.first_name, body.last_name,
                           scheduled_at_store.isoformat(), message=body.message)
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
            tz_name=tenant.get("timezone", "UTC"),
        )
    except Exception as exc:
        logger.error("Email tenant pending failed: %s", exc)


def _email_client_booking_received(tenant: dict, first_name: str, last_name: str, email: str, appointment: dict) -> None:
    """Envoie un accusé de réception au client après sa demande de rendez-vous."""
    try:
        from app.services.email import send_booking_request_received, get_tenant_brand
        from app.core.supabase import get_supabase_admin as _get_sb
        brand = get_tenant_brand(_get_sb(), tenant["id"])
        contact_name = f"{first_name} {last_name}".strip()
        send_booking_request_received(
            contact_email=email,
            contact_name=contact_name,
            appointment=appointment,
            tenant_name=tenant.get("name", ""),
            tz_name=tenant.get("timezone", "UTC"),
            primary_color=brand["primary_color"],
            logo_url=brand["logo_url"],
            logo_option=brand["logo_option"],
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
