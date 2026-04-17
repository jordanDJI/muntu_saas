from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timedelta, timezone
from app.core.supabase import get_supabase_admin
from app.services.email import send_appointment_reminder

scheduler = AsyncIOScheduler(timezone="Europe/Brussels")


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
            send_appointment_reminder(
                contact_email=contact["email"],
                contact_name=f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip(),
                appointment=appt,
                tenant_name=tenant_name,
            )


def start_scheduler() -> None:
    scheduler.add_job(
        send_appointment_reminders,
        CronTrigger(hour=9, minute=0),
        id="appointment_reminders",
        replace_existing=True,
    )
    scheduler.start()


def stop_scheduler() -> None:
    scheduler.shutdown()
