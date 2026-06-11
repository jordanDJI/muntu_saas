import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timedelta, timezone
from app.core.supabase import get_supabase_admin
from app.services.email import send_appointment_reminder, send_crm_reminder_to_contact

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
    scheduler.start()


def stop_scheduler() -> None:
    scheduler.shutdown()
