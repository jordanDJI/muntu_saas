import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timedelta, timezone
from app.core.supabase import get_supabase_admin
from app.services.email import send_appointment_reminder, send_crm_reminder_to_contact, send_monthly_report

scheduler = AsyncIOScheduler(timezone="Europe/Brussels")
logger = logging.getLogger(__name__)


# ── Rappels de rendez-vous 24h avant ─────────────────────────────────────────

async def send_appointment_reminders() -> None:
    """
    Envoie les rappels 24h avant les RDV confirmés.
    Utilise reminder_sent_at pour éviter les doublons si le job tourne plusieurs fois.
    Migration requise : ALTER TABLE appointment ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
    """
    supabase = get_supabase_admin()
    now = datetime.now(timezone.utc)
    window_start = (now + timedelta(hours=23)).isoformat()
    window_end = (now + timedelta(hours=25)).isoformat()

    try:
        result = (
            supabase.table("appointment")
            .select("*, contact(first_name, last_name, email), calendar(tenant(name))")
            .eq("status", "confirmed")
            .is_("reminder_sent_at", "null")
            .gte("scheduled_at", window_start)
            .lte("scheduled_at", window_end)
            .execute()
        )
    except Exception as exc:
        logger.error("Reminder query failed (colonne reminder_sent_at manquante ?): %s", exc)
        return

    for appt in result.data or []:
        contact = appt.get("contact") or {}
        email = contact.get("email")
        if not email:
            continue

        tenant_name = (appt.get("calendar") or {}).get("tenant", {}).get("name", "")
        try:
            await asyncio.to_thread(
                send_appointment_reminder,
                contact_email=email,
                contact_name=f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip(),
                appointment=appt,
                tenant_name=tenant_name,
            )
            supabase.table("appointment").update(
                {"reminder_sent_at": now.isoformat()}
            ).eq("id", appt["id"]).execute()
            logger.info("Reminder sent for appointment %s", appt["id"])
        except Exception as exc:
            logger.error("Reminder email failed for appt %s: %s", appt.get("id"), exc)


# ── Worker de synthèse — Agent 4 ──────────────────────────────────────────────

async def run_synthesis_worker() -> None:
    """
    Pour chaque tenant actif ayant un agent_config 'assistant_tenant',
    vérifie si le schedule est échu et produit une synthèse des conversations récentes.
    """
    from app.services.llm import summarize_conversations

    sb = get_supabase_admin()
    now = datetime.now(timezone.utc)

    configs_res = (
        sb.table("agent_config")
        .select("id, tenant_id, model, synthesis_schedule_minutes")
        .eq("agent_type", "assistant_tenant")
        .eq("status", "active")
        .execute()
    )

    for config in configs_res.data or []:
        tenant_id = config["tenant_id"]
        schedule_min = config.get("synthesis_schedule_minutes", 180)
        config_id = config["id"]

        last_res = (
            sb.table("agent_synthesis")
            .select("period_end")
            .eq("tenant_id", tenant_id)
            .order("period_end", desc=True)
            .limit(1)
            .execute()
        )

        if last_res.data:
            raw = last_res.data[0]["period_end"]
            last_end = datetime.fromisoformat(raw)
            if last_end.tzinfo is None:
                last_end = last_end.replace(tzinfo=timezone.utc)
            if (now - last_end).total_seconds() < schedule_min * 60:
                continue
            period_start = last_end
        else:
            period_start = now - timedelta(minutes=schedule_min)

        convs_res = (
            sb.table("conversation")
            .select("id, started_at, message(sender_type, content, sent_at)")
            .eq("tenant_id", tenant_id)
            .gte("started_at", period_start.isoformat())
            .lt("started_at", now.isoformat())
            .execute()
        )

        if not convs_res.data:
            continue

        raw_lines = []
        for conv in convs_res.data:
            for msg in conv.get("message", []):
                sender = msg.get("sender_type", "inconnu")
                raw_lines.append(f"[{sender}] {msg.get('content', '')}")

        if not raw_lines:
            continue

        raw_text = "\n".join(raw_lines)
        try:
            summary = await asyncio.to_thread(
                summarize_conversations, raw_text, config.get("model", "gemini-2.5-flash")
            )
        except Exception as exc:
            logger.error("Synthesis LLM error for tenant %s: %s", tenant_id, exc)
            continue

        sb.table("agent_synthesis").insert({
            "tenant_id": tenant_id,
            "agent_config_id": config_id,
            "content": summary,
            "period_start": period_start.isoformat(),
            "period_end": now.isoformat(),
        }).execute()

        logger.info("Synthesis generated for tenant %s (%d messages)", tenant_id, len(raw_lines))


# ── Relances CRM auto-send ────────────────────────────────────────────────────

async def send_crm_auto_reminders() -> None:
    """
    Chaque matin à 8h : envoie les relances CRM dont auto_send=true et due_date=today.
    Utilise sent_at pour éviter les doublons.
    """
    from app.core.config import settings as cfg

    sb = get_supabase_admin()
    today = datetime.now(timezone.utc).date().isoformat()

    try:
        rows = (
            sb.table("contact_reminder")
            .select(
                "id, note, reminder_type, tenant_id, "
                "contact(first_name, last_name, email), "
                "tenant(name, country, slug, site(site_style))"
            )
            .eq("due_date", today)
            .eq("auto_send", True)
            .eq("done", False)
            .is_("sent_at", "null")
            .execute()
        ).data or []
    except Exception as exc:
        logger.error("CRM auto-reminders query failed: %s", exc)
        return

    for row in rows:
        contact = row.get("contact") or {}
        tenant  = row.get("tenant") or {}
        email   = contact.get("email")
        if not email:
            continue

        sites       = tenant.get("site") or []
        site_style  = (sites[0].get("site_style") or {}) if sites else {}
        slug        = tenant.get("slug", "")
        booking_url = f"{cfg.frontend_url}/{slug}" if slug else ""

        try:
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
            )
            now = datetime.now(timezone.utc).isoformat()
            sb.table("contact_reminder").update({"sent_at": now}).eq("id", row["id"]).execute()
            logger.info("CRM auto-reminder sent for reminder %s", row["id"])
        except Exception as exc:
            logger.error("CRM auto-reminder failed for %s: %s", row.get("id"), exc)


# ── Rappels expiration trial ─────────────────────────────────────────────────

async def send_trial_reminders() -> None:
    """
    Envoie les rappels d'expiration du trial J-7, J-3, J-1.
    Utilise trial_reminder_log pour éviter les doublons.
    Migration requise : 044_trial_reminder_log.sql
    """
    from app.services.email import send_trial_reminder
    from app.core.config import settings as cfg
    from datetime import date

    sb = get_supabase_admin()
    today = datetime.now(timezone.utc).date()
    TRIAL_DAYS = 14
    THRESHOLDS = {7, 3, 1}

    # Fenêtre normale : tenants créés dans les 21 derniers jours
    normal_start = (today - timedelta(days=21)).isoformat() + "T00:00:00+00:00"
    # Fenêtre extended : trial_extended_until dans les 8 prochains jours
    ext_start = today.isoformat() + "T00:00:00+00:00"
    ext_end   = (today + timedelta(days=8)).isoformat() + "T23:59:59+00:00"

    try:
        res_normal = (
            sb.table("tenant")
            .select("id, name, country, created_at, trial_extended_until, suspended_at, membership(role, app_user(email, first_name))")
            .gte("created_at", normal_start)
            .eq("is_active", True)
            .execute()
        )
        res_extended = (
            sb.table("tenant")
            .select("id, name, country, created_at, trial_extended_until, suspended_at, membership(role, app_user(email, first_name))")
            .gte("trial_extended_until", ext_start)
            .lte("trial_extended_until", ext_end)
            .eq("is_active", True)
            .execute()
        )
        all_tenants = {t["id"]: t for t in (res_normal.data or []) + (res_extended.data or [])}
    except Exception as exc:
        logger.error("Trial reminders: tenant query failed: %s", exc)
        return

    for tenant in all_tenants.values():
        if tenant.get("suspended_at"):
            continue

        # Calcul de la date d'expiration du trial
        try:
            created_date = datetime.fromisoformat(
                tenant["created_at"].replace("Z", "+00:00")
            ).astimezone(timezone.utc).date()
        except Exception:
            continue

        ext_raw = tenant.get("trial_extended_until")
        if ext_raw:
            try:
                ext_date = datetime.fromisoformat(
                    ext_raw.replace("Z", "+00:00")
                ).astimezone(timezone.utc).date()
                trial_end = max(created_date + timedelta(days=TRIAL_DAYS), ext_date)
            except Exception:
                trial_end = created_date + timedelta(days=TRIAL_DAYS)
        else:
            trial_end = created_date + timedelta(days=TRIAL_DAYS)

        days_remaining = (trial_end - today).days
        if days_remaining not in THRESHOLDS:
            continue

        tenant_id = tenant["id"]

        # Pas d'abonnement Stripe actif
        try:
            sub = sb.table("subscription").select("id").eq("tenant_id", tenant_id).in_("status", ["active", "trialing"]).maybe_single().execute()
            if sub.data:
                continue
        except Exception:
            continue

        # Déjà envoyé ?
        try:
            already = sb.table("trial_reminder_log").select("id").eq("tenant_id", tenant_id).eq("days_before", days_remaining).maybe_single().execute()
            if already.data:
                continue
        except Exception:
            pass

        # Owner
        memberships = tenant.get("membership") or []
        owner = None
        for m in memberships:
            if m.get("role") == "owner" and (m.get("app_user") or {}).get("email"):
                owner = m["app_user"]
                break
        if not owner:
            for m in memberships:
                if (m.get("app_user") or {}).get("email"):
                    owner = m["app_user"]
                    break
        if not owner:
            logger.warning("Trial reminder: no owner email for tenant %s", tenant_id)
            continue

        # Résumé d'activité
        contacts_n = leads_n = appts_n = 0
        try:
            contacts_n = sb.table("contact").select("id", count="exact").eq("tenant_id", tenant_id).execute().count or 0
            leads_n    = sb.table("lead").select("id", count="exact").eq("tenant_id", tenant_id).execute().count or 0
            cal = sb.table("calendar").select("id").eq("tenant_id", tenant_id).maybe_single().execute()
            if cal.data:
                appts_n = sb.table("appointment").select("id", count="exact").eq("calendar_id", cal.data["id"]).execute().count or 0
        except Exception as exc:
            logger.warning("Trial reminder: summary query failed for %s: %s", tenant_id, exc)

        try:
            await asyncio.to_thread(
                send_trial_reminder,
                owner_email=owner["email"],
                owner_name=owner.get("first_name", ""),
                tenant_name=tenant["name"],
                country=tenant.get("country", "BE"),
                days_left=days_remaining,
                summary={"contacts": contacts_n, "leads": leads_n, "appointments": appts_n},
                upgrade_url=f"{cfg.frontend_url}/dashboard/settings?section=abonnement",
            )
            sb.table("trial_reminder_log").insert({"tenant_id": tenant_id, "days_before": days_remaining}).execute()
            logger.info("Trial reminder (%dd) sent → tenant %s", days_remaining, tenant_id)
        except Exception as exc:
            logger.error("Trial reminder failed for tenant %s: %s", tenant_id, exc)


# ── Rapports mensuels analytics ──────────────────────────────────────────────

async def send_monthly_reports() -> None:
    """
    1er du mois à 9h — génère et envoie le rapport analytics PDF
    du mois précédent à tous les tenants actifs (non suspendus, non trial_expired).
    """
    import calendar as _cal
    from app.services.pdf import generate_report_pdf
    from app.core.config import settings as cfg

    sb = get_supabase_admin()
    now = datetime.now(timezone.utc)

    # Fenêtre = mois précédent
    first_this = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_prev  = first_this - timedelta(seconds=1)
    first_prev = last_prev.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    since = first_prev.isoformat()
    until = last_prev.isoformat()
    month_label = first_prev.strftime("%B %Y")

    # Tenants actifs avec abonnement (active ou trialing) et owner
    try:
        subs = (
            sb.table("subscription")
            .select("tenant_id")
            .in_("status", ["active", "trialing"])
            .execute()
        )
        tenant_ids = [r["tenant_id"] for r in (subs.data or [])]
    except Exception as exc:
        logger.error("monthly_reports: subscription query failed: %s", exc)
        return

    if not tenant_ids:
        logger.info("monthly_reports: aucun tenant actif ce mois")
        return

    try:
        tenants = (
            sb.table("tenant")
            .select("id, name, country, suspended_at, membership(role, app_user(email, first_name))")
            .in_("id", tenant_ids)
            .eq("is_active", True)
            .execute()
        ).data or []
    except Exception as exc:
        logger.error("monthly_reports: tenant query failed: %s", exc)
        return

    for tenant in tenants:
        if tenant.get("suspended_at"):
            continue

        tenant_id   = tenant["id"]
        tenant_name = tenant.get("name", "Mon établissement")
        country     = tenant.get("country", "BE")

        # Owner
        memberships = tenant.get("membership") or []
        owner = None
        for m in memberships:
            if m.get("role") == "owner" and (m.get("app_user") or {}).get("email"):
                owner = m["app_user"]
                break
        if not owner:
            continue

        # Résumé du mois précédent
        try:
            # Import local pour éviter la dépendance circulaire
            from app.api.v1.analytics import _build_summary
            summary = await _build_summary(sb, tenant_id, since, until)
        except Exception as exc:
            logger.error("monthly_reports: summary failed for %s: %s", tenant_id, exc)
            continue

        # Génération PDF
        try:
            pdf_bytes = generate_report_pdf(
                tenant_name=tenant_name,
                period_label=month_label,
                summary=summary,
            )
        except Exception as exc:
            logger.error("monthly_reports: PDF generation failed for %s: %s", tenant_id, exc)
            continue

        # Envoi email
        try:
            dashboard_url = f"{cfg.frontend_url}/dashboard/analytics"
            await asyncio.to_thread(
                send_monthly_report,
                owner_email=owner["email"],
                owner_name=owner.get("first_name", ""),
                tenant_name=tenant_name,
                country=country,
                month_label=month_label,
                summary=summary,
                pdf_bytes=pdf_bytes,
                dashboard_url=dashboard_url,
            )
            logger.info("monthly_report sent → tenant %s (%s)", tenant_id, month_label)
        except Exception as exc:
            logger.error("monthly_reports: email failed for %s: %s", tenant_id, exc)


# ── Démarrage / arrêt ─────────────────────────────────────────────────────────

def start_scheduler() -> None:
    # Rappels 24h : vérifie toutes les heures (fenêtre 23h-25h pour absorber les décalages)
    scheduler.add_job(
        send_appointment_reminders,
        IntervalTrigger(hours=1),
        id="appointment_reminders",
        replace_existing=True,
    )
    # Worker de synthèse : vérifie toutes les 30 min
    scheduler.add_job(
        run_synthesis_worker,
        IntervalTrigger(minutes=30),
        id="synthesis_worker",
        replace_existing=True,
    )
    # Relances CRM auto-send : chaque jour à 8h00 (Europe/Brussels)
    scheduler.add_job(
        send_crm_auto_reminders,
        "cron",
        hour=8,
        minute=0,
        id="crm_auto_reminders",
        replace_existing=True,
    )
    # Rappels expiration trial J-7, J-3, J-1 : chaque jour à 9h00
    scheduler.add_job(
        send_trial_reminders,
        "cron",
        hour=9,
        minute=0,
        id="trial_reminders",
        replace_existing=True,
    )
    # Rapport analytics mensuel : 1er du mois à 9h30
    scheduler.add_job(
        send_monthly_reports,
        "cron",
        day=1,
        hour=9,
        minute=30,
        id="monthly_reports",
        replace_existing=True,
    )
    scheduler.start()


def stop_scheduler() -> None:
    scheduler.shutdown()
