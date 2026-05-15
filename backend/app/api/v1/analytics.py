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

from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import httpx
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
    # Sessions → leads (acquisition rate)
    conv_lead = round(len(leads) / pageviews * 100, 1) if pageviews > 0 else None
    # Leads → confirmed appointments (capped at 100% — direct dashboard appts excluded)
    confirmed_appts = sum(1 for a in appts if a.get("status") == "confirmed")
    conv_appt = round(min(confirmed_appts / len(leads) * 100, 100.0), 1) if leads else None

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


# ── ROI / Demand potential (Google Trends via pytrends) ───────────────────────

_CACHE_TTL = timedelta(hours=24)
_VALID_PERIODS = {"week", "month", "quarter", "year"}


@router.get("/roi-potential")
async def get_roi_potential(
    period: str = "month",
    tenant_id: str = Depends(get_current_tenant),
):
    if period not in _VALID_PERIODS:
        period = "month"

    sb = get_supabase()

    # ── Cache lookup ──────────────────────────────────────────────────────────
    try:
        cached = (
            sb.table("tenant_roi_cache")
            .select("data, computed_at")
            .eq("tenant_id", tenant_id)
            .eq("period", period)
            .single()
            .execute()
        )
        if cached.data:
            computed_at = datetime.fromisoformat(
                cached.data["computed_at"].replace("Z", "+00:00")
            )
            if datetime.now(timezone.utc) - computed_at < _CACHE_TTL:
                return {**cached.data["data"], "cached_at": cached.data["computed_at"]}
    except Exception:
        pass

    # ── Tenant info ───────────────────────────────────────────────────────────
    tenant_row = (
        sb.table("tenant")
        .select("sector, country")
        .eq("id", tenant_id)
        .single()
        .execute()
    ).data or {}
    sector  = tenant_row.get("sector", "other") or "other"
    country = tenant_row.get("country", "BE") or "BE"

    # ── Site + zones + offers ─────────────────────────────────────────────────
    site_row = (
        sb.table("site").select("id").eq("tenant_id", tenant_id).single().execute()
    ).data

    zones: list[str] = []
    offer_names: list[str] = []
    if site_row:
        site_id = site_row["id"]
        areas = sb.table("service_area").select("city").eq("site_id", site_id).execute()
        zones = [a["city"] for a in (areas.data or []) if a.get("city")]
        offers = sb.table("service_offer").select("name").eq("site_id", site_id).execute()
        offer_names = [o["name"] for o in (offers.data or []) if o.get("name")]

    # ── Fetch from pytrends ───────────────────────────────────────────────────
    from app.services.trends import get_demand_data
    data = await get_demand_data(sector, country, zones, period, offer_names)
    data["period"] = period

    # ── Store cache ───────────────────────────────────────────────────────────
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        sb.table("tenant_roi_cache").upsert(
            {"tenant_id": tenant_id, "period": period, "data": data, "computed_at": now_iso},
            on_conflict="tenant_id,period",
        ).execute()
    except Exception:
        pass

    return {**data, "cached_at": now_iso}


# ── Google Analytics (GA4) connection ────────────────────────────────────────

class GoogleConnectIn(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None


class GoogleConfigIn(BaseModel):
    ga4_property_id: str


@router.post("/google/connect")
async def connect_google_analytics(body: GoogleConnectIn, tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    sb.table("google_analytics_connection").upsert(
        {"tenant_id": tenant_id, "access_token": body.access_token, "refresh_token": body.refresh_token},
        on_conflict="tenant_id",
    ).execute()
    return {"status": "connected"}


@router.get("/google/status")
async def google_analytics_status(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    row = sb.table("google_analytics_connection").select("ga4_property_id, connected_at").eq("tenant_id", tenant_id).maybe_single().execute()
    if not row.data:
        return {"connected": False, "property_configured": False}
    return {
        "connected": True,
        "property_configured": bool(row.data.get("ga4_property_id")),
        "ga4_property_id": row.data.get("ga4_property_id"),
        "connected_at": row.data.get("connected_at"),
    }


@router.patch("/google/configure")
async def configure_google_analytics(body: GoogleConfigIn, tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    sb.table("google_analytics_connection").upsert(
        {"tenant_id": tenant_id, "ga4_property_id": body.ga4_property_id},
        on_conflict="tenant_id",
    ).execute()
    return {"status": "ok"}


@router.get("/google/data")
async def get_google_analytics_data(days: int = 30, tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    row = sb.table("google_analytics_connection").select("access_token, ga4_property_id").eq("tenant_id", tenant_id).maybe_single().execute()
    if not row.data or not row.data.get("ga4_property_id"):
        raise HTTPException(status_code=404, detail="Google Analytics non configuré")

    access_token = row.data["access_token"]
    property_id = row.data["ga4_property_id"]

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://analyticsdata.googleapis.com/v1beta/properties/{property_id}:runReport",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "dateRanges": [{"startDate": f"{days}daysAgo", "endDate": "today"}],
                "metrics": [
                    {"name": "sessions"},
                    {"name": "activeUsers"},
                    {"name": "screenPageViews"},
                    {"name": "bounceRate"},
                ],
                "dimensions": [{"name": "date"}],
                "orderBys": [{"dimension": {"dimensionName": "date"}}],
            },
            timeout=15.0,
        )

    if resp.status_code == 401:
        raise HTTPException(status_code=401, detail="Token Google expiré — reconnectez-vous via Google")
    if not resp.is_success:
        raise HTTPException(status_code=502, detail=f"Erreur Google Analytics API : {resp.text[:200]}")

    rows = resp.json().get("rows", [])
    result = []
    for r in rows:
        dims = r.get("dimensionValues", [])
        vals = r.get("metricValues", [])
        result.append({
            "date": dims[0]["value"] if dims else "",
            "sessions": int(vals[0]["value"]) if len(vals) > 0 else 0,
            "active_users": int(vals[1]["value"]) if len(vals) > 1 else 0,
            "pageviews": int(vals[2]["value"]) if len(vals) > 2 else 0,
            "bounce_rate": round(float(vals[3]["value"]) * 100, 1) if len(vals) > 3 else 0,
        })

    return {"rows": result, "property_id": property_id}
