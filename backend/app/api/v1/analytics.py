"""
Analytics — tracking comportemental du site public + métriques métier agrégées.

Migration SQL à exécuter dans Supabase (une seule fois) :
──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_event (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  session_id   TEXT        NOT NULL,
  event_type   TEXT        NOT NULL,   -- pageview | section_view | cta_click | form_open | form_submit | chatbot_open | chatbot_message
  section      TEXT,                   -- hero | a-propos | prestations | contact | …
  data         JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_site_event_tenant_created
  ON site_event (tenant_id, created_at DESC);
──────────────────────────────────────────────────────────
"""

from fastapi import APIRouter, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from app.middleware.tenant import get_current_tenant
from app.core.supabase import get_supabase_admin as get_supabase

router = APIRouter(prefix="/analytics", tags=["Analytics"])


# ── Public event tracking ─────────────────────────────────────────────────────

class EventIn(BaseModel):
    tenant_slug: str
    session_id: str
    event_type: str
    section: Optional[str] = None
    data: Optional[dict] = None


@router.post("/event", status_code=204)
async def track_event(body: EventIn, background_tasks: BackgroundTasks):
    background_tasks.add_task(_do_track, body)


async def _do_track(body: EventIn):
    try:
        sb = get_supabase()
        res = sb.table("tenant").select("id").eq("slug", body.tenant_slug).single().execute()
        if not res.data:
            return
        sb.table("site_event").insert({
            "tenant_id": res.data["id"],
            "session_id": body.session_id,
            "event_type": body.event_type,
            "section": body.section,
            "data": body.data or {},
        }).execute()
    except Exception:
        pass


# ── Authenticated summary ─────────────────────────────────────────────────────

@router.get("/summary")
async def get_summary(days: int = 30, tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    # ── Leads ─────────────────────────────────────────────────────────────────
    leads_r = (
        sb.table("lead")
        .select("id, source, status, request_type, created_at")
        .eq("tenant_id", tenant_id)
        .gte("created_at", since)
        .execute()
    )
    leads = leads_r.data or []

    leads_by_source: dict = {}
    leads_by_status: dict = {}
    for lead in leads:
        src = lead.get("source") or "inconnu"
        st  = lead.get("status") or "inconnu"
        leads_by_source[src] = leads_by_source.get(src, 0) + 1
        leads_by_status[st]  = leads_by_status.get(st, 0) + 1

    # ── Appointments ──────────────────────────────────────────────────────────
    cal_r  = sb.table("calendar").select("id").eq("tenant_id", tenant_id).execute()
    cal_id = (cal_r.data or [{}])[0].get("id") if cal_r.data else None

    appts: list = []
    appts_by_status: dict = {}
    if cal_id:
        appts_r = (
            sb.table("appointment")
            .select("id, status, created_at")
            .eq("calendar_id", cal_id)
            .gte("created_at", since)
            .execute()
        )
        appts = appts_r.data or []
        for a in appts:
            st = a.get("status") or "inconnu"
            appts_by_status[st] = appts_by_status.get(st, 0) + 1

    # ── Contacts total ────────────────────────────────────────────────────────
    contacts_r     = sb.table("contact").select("id", count="exact").eq("tenant_id", tenant_id).execute()
    contacts_total = contacts_r.count or 0

    # ── Behavioural events (optional table) ───────────────────────────────────
    pageviews       = 0
    unique_sessions = 0
    sections_viewed: dict = {}
    cta_clicks: dict      = {}
    chatbot_conversations = 0
    chatbot_messages      = 0
    form_opens            = 0
    form_submits          = 0

    try:
        events_r = (
            sb.table("site_event")
            .select("event_type, session_id, section, data")
            .eq("tenant_id", tenant_id)
            .gte("created_at", since)
            .execute()
        )
        sessions: set = set()
        for ev in (events_r.data or []):
            t = ev.get("event_type", "")
            sessions.add(ev.get("session_id", ""))
            if t == "pageview":
                pageviews += 1
            elif t == "section_view" and ev.get("section"):
                sec = ev["section"]
                sections_viewed[sec] = sections_viewed.get(sec, 0) + 1
            elif t == "cta_click":
                action = (ev.get("data") or {}).get("action", "autre")
                cta_clicks[action] = cta_clicks.get(action, 0) + 1
            elif t == "chatbot_open":
                chatbot_conversations += 1
            elif t == "chatbot_message":
                chatbot_messages += 1
            elif t == "form_open":
                form_opens += 1
            elif t == "form_submit":
                form_submits += 1
        unique_sessions = len(sessions)
    except Exception:
        pass  # table not yet created — degrade gracefully

    # ── Conversion rates ──────────────────────────────────────────────────────
    conv_lead = round(len(leads) / pageviews * 100, 1) if pageviews > 0 else None
    conv_appt = round(len(appts) / len(leads) * 100, 1) if leads else None

    return {
        "period_days": days,
        "contacts_total": contacts_total,
        "leads_total": len(leads),
        "leads_by_source": leads_by_source,
        "leads_by_status": leads_by_status,
        "appointments_total": len(appts),
        "appointments_by_status": appts_by_status,
        "pageviews": pageviews,
        "unique_sessions": unique_sessions,
        "sections_viewed": sections_viewed,
        "cta_clicks": cta_clicks,
        "chatbot_conversations": chatbot_conversations,
        "chatbot_messages": chatbot_messages,
        "form_opens": form_opens,
        "form_submits": form_submits,
        "conversion_lead_rate": conv_lead,
        "conversion_appt_rate": conv_appt,
    }
