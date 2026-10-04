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
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from app.core.config import settings
from app.core.supabase import get_supabase_admin
from app.middleware.rate_limit import check_rate, check_rate_async
from app.models.calendar import PublicBookIn
from app.services.lead import ensure_lead
from app.services.paypal import (capture_order, create_order, get_deposit_config,
                                 get_order, refund_capture, refund_order)
from app.services.retention import CONSENT_CHANNELS, record_consent, touch_contact_interaction

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


# -- Validation de créneau (partagée par /book et /paypal-capture) -----------

# Un RDV en attente de paiement n'immobilise le créneau que pendant ce délai :
# passé ce point, le client a abandonné le tunnel PayPal et le créneau doit
# redevenir réservable. Le job scheduler les annule par ailleurs.
DEPOSIT_PENDING_TTL_MINUTES = 30

_DAYS_FR = {0: "Lundi", 1: "Mardi", 2: "Mercredi", 3: "Jeudi",
            4: "Vendredi", 5: "Samedi", 6: "Dimanche"}


def _is_stale(created_at, cutoff: datetime) -> bool:
    """True si created_at est antérieur au cutoff (naïf traité comme UTC)."""
    if not created_at:
        return False
    try:
        dt = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return False
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt < cutoff


def _assert_slot_bookable(sb, tenant: dict, cal_id: str, start_local: datetime,
                          end_local: datetime, party_size: int) -> None:
    """
    Valide qu'un créneau est réellement réservable. Lève une HTTPException sinon.

    Appelée par les DEUX chemins de réservation publique. Auparavant seul
    /book validait, et partiellement : capacité et taille de groupe étaient
    contrôlées, mais ni les horaires d'ouverture, ni les périodes bloquées, ni
    le fait que le créneau soit dans le futur. Un POST construit à la main
    pouvait donc réserver un dimanche à 3 h du matin, et le chemin avec
    acompte ne validait rien du tout.

    start_local / end_local sont naïfs, en heure locale du tenant
    (invariant de stockage du projet).
    """
    tz = _tenant_tz(tenant)
    start_utc = start_local.replace(tzinfo=tz).astimezone(timezone.utc)
    end_utc = end_local.replace(tzinfo=tz).astimezone(timezone.utc)

    if end_utc <= start_utc:
        raise HTTPException(status_code=400, detail="Créneau invalide.")

    if start_utc <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400,
                            detail="Ce créneau est déjà passé. Veuillez choisir un autre horaire.")

    day_of_week = start_local.weekday()
    day_label = _DAYS_FR.get(day_of_week, "")

    avail_res = (
        sb.table("availability_slot")
        .select("start_time, end_time, capacity, max_party_size")
        .eq("calendar_id", cal_id)
        .eq("day_of_week", day_of_week)
        .eq("is_active", True)
        .execute()
    )
    windows = avail_res.data or []
    if not windows:
        raise HTTPException(status_code=400,
                            detail=f"Le professionnel ne prend pas de rendez-vous le {day_label.lower()}.")

    # Le créneau demandé doit tenir entièrement dans une plage d'ouverture.
    # On lit capacité et taille de groupe sur CETTE plage, et non en prenant
    # le max de la journée : une pause déjeuner avec une capacité différente
    # ne doit pas relever la limite du reste de la journée.
    containing = None
    for w in windows:
        try:
            h_s, m_s = map(int, str(w["start_time"])[:5].split(":"))
            h_e, m_e = map(int, str(w["end_time"])[:5].split(":"))
        except (ValueError, KeyError, TypeError):
            continue
        w_start = _local_slot(start_local.date(), h_s, m_s, tz)
        w_end = _local_slot(start_local.date(), h_e, m_e, tz)
        if w_start <= start_utc and end_utc <= w_end:
            containing = w
            break

    if containing is None:
        raise HTTPException(status_code=400,
                            detail="Ce créneau est en dehors des horaires d'ouverture. "
                                   "Veuillez choisir un autre horaire.")

    capacity = max(1, int(containing.get("capacity") or 1))
    max_party_size = max(1, int(containing.get("max_party_size") or 1))

    # Message conservé à l'identique : il est documenté dans CLAUDE.md.
    if party_size > max_party_size:
        raise HTTPException(
            status_code=400,
            detail=f"Le nombre de personnes maximum par réservation des {day_label} "
                   f"pour cette période est de {max_party_size} personne(s).",
        )

    blocked_res = (
        sb.table("blocked_period")
        .select("start_at, end_at")
        .eq("calendar_id", cal_id)
        .lte("start_at", end_utc.isoformat())
        .gte("end_at", start_utc.isoformat())
        .execute()
    )
    for b in blocked_res.data or []:
        try:
            bs = datetime.fromisoformat(str(b["start_at"]).replace("Z", "+00:00"))
            be = datetime.fromisoformat(str(b["end_at"]).replace("Z", "+00:00"))
        except (ValueError, KeyError, TypeError):
            continue
        if bs.tzinfo is None:
            bs = bs.replace(tzinfo=timezone.utc)
        if be.tzinfo is None:
            be = be.replace(tzinfo=timezone.utc)
        if bs < end_utc and start_utc < be:
            raise HTTPException(status_code=409,
                                detail="Le professionnel est indisponible sur ce créneau. "
                                       "Veuillez choisir un autre horaire.")

    existing = (
        sb.table("appointment")
        .select("id, status, created_at")
        .eq("calendar_id", cal_id)
        .neq("status", "cancelled")
        .lt("scheduled_at", end_local.isoformat())
        .gt("end_at", start_local.isoformat())
        .execute()
    )
    stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=DEPOSIT_PENDING_TTL_MINUTES)
    booked_count = 0
    for a in existing.data or []:
        if a.get("status") == "pending_payment" and _is_stale(a.get("created_at"), stale_cutoff):
            continue
        booked_count += 1

    if booked_count >= capacity:
        raise HTTPException(
            status_code=409,
            detail=("Ce créneau vient d'être réservé. Veuillez choisir un autre horaire."
                    if capacity == 1
                    else "Ce créneau est complet. Veuillez choisir un autre horaire."),
        )



@router.post("/{tenant_slug}/book", status_code=status.HTTP_201_CREATED)
async def book_appointment(tenant_slug: str, body: PublicBookIn, request: Request):
    await check_rate_async(request, "book", max_calls=5, window_seconds=300)  # 5 résa / IP / 5 min
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

    for channel in body.consent_channels:
        if channel in CONSENT_CHANNELS:
            record_consent(tenant["id"], contact_id, channel, granted=True, source="public_form")

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

    # Validation complète du créneau (horaires, blocages, capacité, groupe)
    _assert_slot_bookable(sb, tenant, cal_id, scheduled_at_store, end_at, body.party_size)

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
    if body.custom_answers:
        appt_row["custom_answers"] = body.custom_answers

    appt = sb.table("appointment").insert(appt_row).execute().data[0]
    touch_contact_interaction(contact_id)

    # Notifier le tenant via Telegram/WhatsApp + email (avec le message du visiteur)
    _notify_tenant_pending(sb, tenant["id"], body.first_name, body.last_name,
                           scheduled_at_store.isoformat(), message=body.message)
    _email_tenant_pending(sb, tenant, {"first_name": body.first_name, "last_name": body.last_name,
                                        "email": body.email, "phone": body.phone}, appt,
                          message=body.message)

    # Accusé de réception au client
    _email_client_booking_received(tenant, body.first_name, body.last_name, body.email, appt)

    # Push au tenant : nouveau RDV
    import asyncio
    from app.services import push as push_svc
    client_name = f"{body.first_name or ''} {body.last_name or ''}".strip() or "Client"
    try:
        asyncio.create_task(
            push_svc.send_push_to_tenant(
                sb, tenant["id"],
                title="Nouveau rendez-vous 📅",
                body=f"{client_name} vient de réserver un créneau.",
                url=f"{settings.frontend_url_prod or settings.frontend_url}/dashboard/appointments",
            )
        )
    except Exception:
        pass

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


# ── Acompte PayPal ────────────────────────────────────────────────────────────

class _PaypalOrderIn(BaseModel):
    """
    Corps de la requête pour créer un order PayPal avant la réservation.

    Volontairement vide de toute donnée monétaire : le montant, la devise et
    le mode sandbox sont lus côté serveur depuis site_style.deposit. Ils
    étaient auparavant fournis par le client, qui pouvait donc régler un
    acompte de 0,01 € en appelant l'endpoint directement.
    """
    pass


class _PaypalCaptureIn(PublicBookIn):
    """Corps de la requête pour capturer un paiement et créer le RDV."""
    paypal_order_id: str


def _deposit_or_400(sb, tenant_id: str) -> dict:
    """Config d'acompte du tenant, ou 400 si l'acompte n'est pas utilisable."""
    cfg = get_deposit_config(sb, tenant_id)
    if cfg is None:
        raise HTTPException(
            status_code=400,
            detail="L'acompte en ligne n'est pas disponible pour ce professionnel.",
        )
    return cfg


@router.post("/{tenant_slug}/paypal-order", status_code=201)
async def create_paypal_order(tenant_slug: str, body: _PaypalOrderIn, request: Request):
    """
    Crée un order PayPal côté backend.
    Retourne { order_id, approve_url } — le frontend affiche les boutons PayPal
    avec order_id. Le montant provient exclusivement de la config du tenant.
    """
    await check_rate_async(request, "paypal_order", max_calls=10, window_seconds=300)
    sb = get_supabase_admin()
    tenant, _ = _get_tenant_and_calendar(sb, tenant_slug)
    cfg = _deposit_or_400(sb, tenant["id"])

    tenant_name = tenant.get("name") or ""
    description = f"Acompte réservation {tenant_name}".strip()

    try:
        result = await create_order(
            client_id=cfg["client_id"],
            client_secret=cfg["client_secret"],
            amount=cfg["amount"],
            currency=cfg["currency"],
            description=description,
            sandbox=cfg["sandbox"],
        )
    except Exception as exc:
        logger.error("PayPal create_order tenant %s : %s", tenant["id"], exc)
        raise HTTPException(status_code=502, detail="Erreur PayPal lors de la création de l'order.")

    # Montant renvoyé pour affichage uniquement — le backend ne le relit jamais
    # depuis le client.
    return {**result, "amount": cfg["amount"], "currency": cfg["currency"]}


@router.post("/{tenant_slug}/paypal-capture", status_code=201)
async def capture_paypal_and_book(tenant_slug: str, body: _PaypalCaptureIn, request: Request):
    """
    Valide le créneau, capture le paiement PayPal, puis crée le RDV
    (statut pending, deposit_status paid).

    Ordre volontaire : la validation du créneau précède la capture, pour ne
    jamais encaisser un acompte sur un créneau non réservable. Si une écriture
    échoue APRÈS la capture, l'acompte est remboursé automatiquement — sans
    quoi l'argent restait pris sans rendez-vous.
    """
    await check_rate_async(request, "paypal_capture", max_calls=5, window_seconds=300)
    sb = get_supabase_admin()
    tenant, cal_id = _get_tenant_and_calendar(sb, tenant_slug)

    # Bloquer les emails de l'équipe
    if body.email and body.email.strip().lower() in _get_team_emails(sb, tenant["id"]):
        raise HTTPException(status_code=403, detail=_TEAM_EMAIL_ERROR)

    cfg = _deposit_or_400(sb, tenant["id"])

    if not body.scheduled_at:
        raise HTTPException(status_code=400, detail="scheduled_at requis")

    tz = _tenant_tz(tenant)
    if body.scheduled_at.tzinfo is not None:
        scheduled_at_store = body.scheduled_at.astimezone(tz).replace(tzinfo=None)
    else:
        scheduled_at_store = body.scheduled_at
    end_at = scheduled_at_store + timedelta(minutes=body.slot_duration_min)

    # 1. Créneau réservable — avant tout encaissement
    _assert_slot_bookable(sb, tenant, cal_id, scheduled_at_store, end_at, body.party_size)

    # 2. Capturer le paiement
    try:
        payment = await capture_order(
            cfg["client_id"], cfg["client_secret"], body.paypal_order_id, sandbox=cfg["sandbox"],
        )
    except Exception as exc:
        logger.error("PayPal capture_order %s tenant %s : %s", body.paypal_order_id, tenant["id"], exc)
        raise HTTPException(status_code=402, detail="Paiement PayPal non complété. Veuillez réessayer.")

    # 3. Le montant capturé doit correspondre à l'acompte configuré. Un order
    #    créé hors de notre endpoint pourrait sinon financer la réservation à
    #    n'importe quel prix.
    expected = round(float(cfg["amount"]), 2)
    captured = round(float(payment["amount"]), 2)
    if captured + 0.01 < expected or payment["currency"] != cfg["currency"]:
        logger.error(
            "PayPal montant/devise inattendu (tenant=%s order=%s) : %.2f %s au lieu de %.2f %s",
            tenant["id"], body.paypal_order_id, captured, payment["currency"],
            expected, cfg["currency"],
        )
        await _refund_and_record(
            sb, tenant["id"], cfg, payment, body.paypal_order_id,
            kind="deposit_amount_mismatch",
            detail=f"capture {captured} {payment['currency']} au lieu de {expected} {cfg['currency']}",
        )
        raise HTTPException(
            status_code=402,
            detail="Le montant de l'acompte ne correspond pas. Le paiement a été remboursé.",
        )

    # 4. Créer contact + lead + RDV. Toute erreur ici déclenche un remboursement.
    try:
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

        for channel in body.consent_channels:
            if channel in CONSENT_CHANNELS:
                record_consent(tenant["id"], contact_id, channel, granted=True, source="public_form")

        ensure_lead(sb, tenant["id"], contact_id, "website", status="scheduled",
                    request_type="b2c_appointment", notes=body.message or None)

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
            "deposit_status": "paid",
            "deposit_amount": captured,
            "deposit_currency": payment["currency"],
            "deposit_paypal_order_id": body.paypal_order_id,
            "deposit_capture_id": payment.get("capture_id"),
        }
        if body.message and body.message.strip():
            appt_row["notes"] = body.message.strip()
        if body.custom_answers:
            appt_row["custom_answers"] = body.custom_answers

        appt = sb.table("appointment").insert(appt_row).execute().data[0]
    except Exception as exc:
        logger.error("Création RDV après capture PayPal échouée (tenant=%s order=%s): %s",
                     tenant["id"], body.paypal_order_id, exc)
        refunded = await _refund_and_record(
            sb, tenant["id"], cfg, payment, body.paypal_order_id,
            kind="deposit_booking_failed", detail=str(exc)[:500],
        )
        raise HTTPException(
            status_code=500,
            detail=("Votre acompte a été remboursé, la réservation n'a pas pu être enregistrée. "
                    "Veuillez réessayer." if refunded else
                    "La réservation n'a pas pu être enregistrée. Notre équipe a été alertée et "
                    "vous recontactera au sujet de votre acompte."),
        )

    touch_contact_interaction(contact_id)

    _notify_tenant_pending(sb, tenant["id"], body.first_name, body.last_name,
                           scheduled_at_store.isoformat(), message=body.message)
    _email_tenant_pending(sb, tenant, {"first_name": body.first_name, "last_name": body.last_name,
                                        "email": body.email, "phone": body.phone}, appt,
                          message=body.message)
    _email_client_booking_received(tenant, body.first_name, body.last_name, body.email, appt)

    return {"type": "appointment", "id": appt["id"], "deposit_status": "paid",
            "deposit_amount": captured}


async def _refund_and_record(sb, tenant_id: str, cfg: dict, payment: dict,
                             order_id: str, kind: str, detail: str) -> bool:
    """
    Rembourse une capture et journalise l'incident. Renvoie True si le
    remboursement a abouti.

    L'incident est enregistré dans payment_incident même en cas de succès :
    un acompte encaissé puis rendu doit rester traçable côté opérateur.
    """
    refunded = False
    try:
        capture_id = payment.get("capture_id")
        if capture_id:
            await refund_capture(
                cfg["client_id"], cfg["client_secret"], capture_id, sandbox=cfg["sandbox"],
                amount=payment.get("amount"), currency=payment.get("currency", cfg["currency"]),
                note="Réservation non aboutie",
            )
        else:
            await refund_order(
                cfg["client_id"], cfg["client_secret"], order_id, sandbox=cfg["sandbox"],
                note="Réservation non aboutie",
            )
        refunded = True
    except Exception as exc:
        logger.error("Remboursement PayPal échoué (tenant=%s order=%s): %s", tenant_id, order_id, exc)

    try:
        sb.table("payment_incident").insert({
            "tenant_id": tenant_id,
            "kind": kind,
            "provider": "paypal",
            "reference": order_id,
            "amount": payment.get("amount"),
            "currency": payment.get("currency"),
            "refunded": refunded,
            "detail": detail,
        }).execute()
    except Exception as exc:
        logger.error("payment_incident non enregistré (%s): %s", kind, exc)

    return refunded


# ── PayPal return (flux Telegram) ─────────────────────────────────────────────




# ── PayPal return (Telegram flow) ─────────────────────────────────────────────

def _notify_tenant_deposit_paid(sb, tenant_id: str, appointment_id: str, deposit_amount: float) -> None:
    """Notifie le tenant via Telegram/WhatsApp qu'un acompte a été reçu pour un RDV Telegram."""
    appt_res = sb.table("appointment").select("scheduled_at, contact_id").eq("id", appointment_id).single().execute()
    appt = appt_res.data or {}
    contact_res = sb.table("contact").select("first_name, last_name").eq("id", appt.get("contact_id")).single().execute()
    contact = contact_res.data or {}
    first_name = contact.get("first_name", "")
    full_name = f"{first_name} {contact.get('last_name', '')}".strip() or "Client"
    try:
        dt = datetime.fromisoformat((appt.get("scheduled_at") or "").replace("Z", "+00:00"))
        date_str = dt.strftime("%A %d/%m/%Y à %H:%M")
    except Exception:
        date_str = appt.get("scheduled_at", "?")

    cfg_res = (
        sb.table("agent_config")
        .select("telegram_bot_token, telegram_notify_chat_id, whatsapp_number")
        .eq("tenant_id", tenant_id)
        .eq("agent_type", "assistant_tenant")
        .eq("status", "active")
        .execute()
    )
    if not cfg_res.data:
        return
    cfg = cfg_res.data[0]
    msg = (
        f"Acompte PayPal reçu ✓\n"
        f"Client : {full_name}\n"
        f"Date : {date_str}\n"
        f"Acompte : {deposit_amount:.2f} €\n\n"
        f"RDV en attente de confirmation.\n"
        f"Dites 'confirme {first_name}' pour valider."
    )
    if cfg.get("telegram_bot_token") and cfg.get("telegram_notify_chat_id"):
        from app.services.telegram import send_message
        send_message(cfg["telegram_bot_token"], cfg["telegram_notify_chat_id"], msg)
    if cfg.get("whatsapp_number"):
        from app.services.whatsapp import send_text
        send_text(cfg["whatsapp_number"], msg)


@router.get("/{tenant_slug}/paypal-return")
async def paypal_return_redirect(tenant_slug: str, token: str, appointment_id: str, request: Request):
    """
    Appelé par PayPal après approbation du paiement (redirect depuis le navigateur du client).
    Capture le paiement, met à jour le RDV Telegram (pending_payment → pending), notifie le tenant,
    puis redirige vers la page de résultat frontend.
    """
    frontend_url = settings.frontend_url_prod or settings.frontend_url
    success_url = f"{frontend_url}/paypal-return?status=success&slug={tenant_slug}"
    error_url = f"{frontend_url}/paypal-return?status=error&slug={tenant_slug}"

    sb = get_supabase_admin()
    try:
        tenant, _ = _get_tenant_and_calendar(sb, tenant_slug)

        # Vérifier que l'appointment existe, appartient au tenant et attend le paiement
        cal_res = sb.table("calendar").select("id").eq("tenant_id", tenant["id"]).execute()
        cal_ids = [c["id"] for c in (cal_res.data or [])]
        appt_res = (
            sb.table("appointment")
            .select("id, status, calendar_id, deposit_paypal_order_id")
            .eq("id", appointment_id)
            .in_("calendar_id", cal_ids)
            .single()
            .execute()
        )
        appt = appt_res.data
        if not appt or appt.get("status") != "pending_payment":
            logger.warning("PayPal return: appt %s invalide ou déjà traité", appointment_id)
            return RedirectResponse(url=error_url)

        # Le token renvoyé par PayPal doit être l'order émis pour CE rendez-vous.
        # L'URL de retour est publique : sans ce contrôle, un order approuvé
        # ailleurs pouvait être présenté pour valider le RDV d'un tiers.
        expected_order = appt.get("deposit_paypal_order_id")
        if expected_order and expected_order != token:
            logger.warning("PayPal return: token %s != order attendu %s (appt %s)",
                           token, expected_order, appointment_id)
            return RedirectResponse(url=error_url)

        cfg = get_deposit_config(sb, tenant["id"])
        if cfg is None:
            logger.error("PayPal return: config d'acompte indisponible pour tenant %s", tenant["id"])
            return RedirectResponse(url=error_url)

        payment = await capture_order(
            cfg["client_id"], cfg["client_secret"], token, sandbox=cfg["sandbox"],
        )

        # Montant et devise doivent correspondre à l'acompte configuré, comme
        # dans le flux web : le lien de paiement est public, rien ne garantit
        # que l'order approuvé soit bien celui que nous avons créé.
        expected = round(float(cfg["amount"]), 2)
        captured = round(float(payment["amount"]), 2)
        if captured + 0.01 < expected or payment["currency"] != cfg["currency"]:
            logger.error(
                "PayPal return: montant/devise inattendu (tenant=%s appt=%s) : %.2f %s au lieu de %.2f %s",
                tenant["id"], appointment_id, captured, payment["currency"], expected, cfg["currency"],
            )
            await _refund_and_record(
                sb, tenant["id"], cfg, payment, token,
                kind="deposit_amount_mismatch",
                detail=f"telegram appt={appointment_id} capture {captured} {payment['currency']}",
            )
            return RedirectResponse(url=error_url)

        sb.table("appointment").update({
            "status": "pending",
            "deposit_status": "paid",
            "deposit_amount": captured,
            "deposit_currency": payment["currency"],
            "deposit_paypal_order_id": token,
            "deposit_capture_id": payment.get("capture_id"),
        }).eq("id", appointment_id).execute()

        # Notifier le tenant
        try:
            _notify_tenant_deposit_paid(sb, tenant["id"], appointment_id, captured)
        except Exception as exc:
            logger.warning("Notification dépôt PayPal échouée : %s", exc)

        return RedirectResponse(url=success_url)

    except Exception as exc:
        logger.error("PayPal return failed (tenant=%s, appt=%s): %s", tenant_slug, appointment_id, exc)
        return RedirectResponse(url=error_url)


# ── Webhook PayPal ────────────────────────────────────────────────────────────

def _finalize_paid_deposit(sb, tenant_id: str, appointment_id: str, payment: dict) -> None:
    """Passe un RDV de pending_payment à pending et notifie le professionnel."""
    sb.table("appointment").update({
        "status": "pending",
        "deposit_status": "paid",
        "deposit_amount": round(float(payment["amount"]), 2),
        "deposit_currency": payment["currency"],
        "deposit_paypal_order_id": payment.get("order_id"),
        "deposit_capture_id": payment.get("capture_id"),
    }).eq("id", appointment_id).execute()

    try:
        _notify_tenant_deposit_paid(sb, tenant_id, appointment_id, round(float(payment["amount"]), 2))
    except Exception as exc:
        logger.warning("Notification dépôt PayPal échouée : %s", exc)


def _extract_order_id(payload: dict) -> str | None:
    """
    Retrouve l'identifiant d'order dans un événement PayPal.

    Selon le type d'événement, il est soit la ressource elle-même
    (CHECKOUT.ORDER.*), soit une donnée supplémentaire de la capture
    (PAYMENT.CAPTURE.*).
    """
    resource = payload.get("resource") or {}
    event_type = (payload.get("event_type") or "").upper()

    if event_type.startswith("CHECKOUT.ORDER."):
        return resource.get("id")

    related = ((resource.get("supplementary_data") or {}).get("related_ids") or {})
    return related.get("order_id")


@router.post("/paypal/webhook", status_code=200)
async def paypal_webhook(request: Request):
    """
    Notification PayPal sur un acompte.

    Raison d'être : jusqu'ici la capture ne dépendait que du retour navigateur
    du client. Si celui-ci approuvait le paiement puis fermait son onglet,
    l'order restait APPROVED sans jamais être capturé — aucun encaissement, un
    créneau gelé, et un professionnel jamais prévenu.

    Le corps de la requête n'est PAS considéré comme fiable : chaque tenant
    possède sa propre application PayPal, il n'existe donc pas d'identifiant de
    webhook global permettant de vérifier une signature. On n'en extrait que
    l'identifiant d'order, puis l'état réel est relu via un appel authentifié à
    PayPal avec les credentials du tenant concerné. Un payload forgé ne peut
    donc rien provoquer d'autre que ce que le flux légitime aurait fait.
    """
    await check_rate_async(request, "paypal_webhook", max_calls=120, window_seconds=60)

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Payload invalide")

    order_id = _extract_order_id(payload)
    if not order_id:
        # Événement sans order exploitable (remboursement, litige…) : on
        # acquitte pour éviter que PayPal ne relance indéfiniment.
        return {"received": True, "ignored": True}

    sb = get_supabase_admin()
    appt_res = (
        sb.table("appointment")
        .select("id, status, calendar_id, deposit_status")
        .eq("deposit_paypal_order_id", order_id)
        .limit(1)
        .execute()
    )
    if not appt_res.data:
        return {"received": True, "unknown_order": True}

    appt = appt_res.data[0]
    if appt.get("deposit_status") == "paid":
        return {"received": True, "already_paid": True}

    cal_res = sb.table("calendar").select("tenant_id").eq("id", appt["calendar_id"]).limit(1).execute()
    if not cal_res.data:
        return {"received": True, "orphan": True}
    tenant_id = cal_res.data[0]["tenant_id"]

    cfg = get_deposit_config(sb, tenant_id)
    if cfg is None:
        logger.error("Webhook PayPal : config d'acompte absente (tenant=%s order=%s)", tenant_id, order_id)
        return {"received": True, "no_config": True}

    # État authentique de l'order, côté PayPal
    try:
        order = await get_order(cfg["client_id"], cfg["client_secret"], order_id, sandbox=cfg["sandbox"])
    except Exception as exc:
        logger.error("Webhook PayPal : lecture order %s impossible : %s", order_id, exc)
        raise HTTPException(status_code=502, detail="Order PayPal illisible")

    status_order = (order.get("status") or "").upper()

    if status_order == "APPROVED":
        try:
            payment = await capture_order(
                cfg["client_id"], cfg["client_secret"], order_id, sandbox=cfg["sandbox"],
            )
        except Exception as exc:
            logger.error("Webhook PayPal : capture %s échouée : %s", order_id, exc)
            raise HTTPException(status_code=502, detail="Capture PayPal échouée")
    elif status_order == "COMPLETED":
        # Déjà capturé (course avec /paypal-return) : on relit le montant réel.
        try:
            capture = order["purchase_units"][0]["payments"]["captures"][0]
            payment = {
                "amount": float(capture["amount"]["value"]),
                "currency": capture["amount"]["currency_code"].upper(),
                "capture_id": capture.get("id", ""),
            }
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            logger.error("Webhook PayPal : capture illisible sur %s : %s", order_id, exc)
            return {"received": True, "unreadable": True}
    else:
        # CREATED, VOIDED, PAYER_ACTION_REQUIRED : rien à finaliser.
        return {"received": True, "status": status_order}

    payment["order_id"] = order_id

    expected = round(float(cfg["amount"]), 2)
    captured = round(float(payment["amount"]), 2)
    if captured + 0.01 < expected or payment["currency"] != cfg["currency"]:
        logger.error("Webhook PayPal : montant inattendu (order=%s) %.2f %s au lieu de %.2f %s",
                     order_id, captured, payment["currency"], expected, cfg["currency"])
        await _refund_and_record(
            sb, tenant_id, cfg, payment, order_id,
            kind="deposit_amount_mismatch",
            detail=f"webhook appt={appt['id']} capture {captured} {payment['currency']}",
        )
        return {"received": True, "refunded": True}

    _finalize_paid_deposit(sb, tenant_id, appt["id"], payment)
    return {"received": True, "finalized": True}
