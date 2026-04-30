import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timedelta, timezone
from app.core.supabase import get_supabase_admin
from app.services.email import send_appointment_reminder

scheduler = AsyncIOScheduler(timezone="Europe/Brussels")
logger = logging.getLogger(__name__)


# ── Rappels de rendez-vous (job existant) ─────────────────────────────────────

async def send_appointment_reminders() -> None:
    supabase = get_supabase_admin()
    tomorrow_start = (datetime.now(timezone.utc) + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    tomorrow_end = tomorrow_start + timedelta(days=1)

    result = (
        supabase.table("appointment")
        .select("*, contact(first_name, last_name, email), calendar(tenant(name))")
        .eq("status", "confirmed")
        .gte("scheduled_at", tomorrow_start.isoformat())
        .lt("scheduled_at", tomorrow_end.isoformat())
        .execute()
    )

    for appt in result.data or []:
        contact = appt.get("contact", {})
        if contact.get("email"):
            tenant_name = appt.get("calendar", {}).get("tenant", {}).get("name", "")
            try:
                await asyncio.to_thread(
                    send_appointment_reminder,
                    contact_email=contact["email"],
                    contact_name=f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip(),
                    appointment=appt,
                    tenant_name=tenant_name,
                )
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
            last_end = datetime.fromisoformat(last_res.data[0]["period_end"].replace("Z", "+00:00"))
            if (now - last_end).total_seconds() < schedule_min * 60:
                continue
            period_start = last_end
        else:
            period_start = now - timedelta(minutes=schedule_min)

        # Récupère les conversations non encore synthétisées sur la période
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


# ── Démarrage / arrêt ─────────────────────────────────────────────────────────

def start_scheduler() -> None:
    scheduler.add_job(
        send_appointment_reminders,
        CronTrigger(hour=9, minute=0),
        id="appointment_reminders",
        replace_existing=True,
    )
    # Worker de synthèse : vérifie toutes les 30 min si un tenant doit être synthétisé
    scheduler.add_job(
        run_synthesis_worker,
        IntervalTrigger(minutes=30),
        id="synthesis_worker",
        replace_existing=True,
    )
    scheduler.start()


def stop_scheduler() -> None:
    scheduler.shutdown()
