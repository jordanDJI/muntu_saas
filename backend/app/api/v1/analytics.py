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

import re
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, Query, Request
from fastapi.responses import RedirectResponse, StreamingResponse
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime, timezone, timedelta
import io, httpx, hmac, hashlib, json, base64
from app.middleware.tenant import get_current_tenant
from app.middleware.rate_limit import check_rate
from app.core.supabase import get_supabase_admin as get_supabase
from app.core.config import settings

router = APIRouter(prefix="/analytics", tags=["Analytics"])

_VALID_EVENT_TYPES = frozenset({
    "pageview", "section_view", "cta_click",
    "form_open", "form_submit",
    "chatbot_open", "chatbot_message",
})
_VALID_SECTIONS = frozenset({
    "hero", "a-propos", "prestations", "contact",
    "services", "about", "footer", "galerie", "temoignages",
})
_SLUG_RE = re.compile(r'^[a-z0-9\-]{1,80}$')
_SESSION_RE = re.compile(r'^[a-zA-Z0-9\-_]{8,100}$')


# ── Public event tracking ─────────────────────────────────────────────────────

class EventIn(BaseModel):
    tenant_slug: str = Field(max_length=80)
    session_id: str = Field(max_length=100)
    event_type: str = Field(max_length=50)
    section: Optional[str] = Field(default=None, max_length=50)
    data: Optional[dict] = None

    @field_validator("tenant_slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        if not _SLUG_RE.match(v):
            raise ValueError("slug invalide")
        return v

    @field_validator("session_id")
    @classmethod
    def validate_session(cls, v: str) -> str:
        if not _SESSION_RE.match(v):
            raise ValueError("session_id invalide")
        return v

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, v: str) -> str:
        if v not in _VALID_EVENT_TYPES:
            raise ValueError(f"event_type '{v}' non reconnu")
        return v

    @field_validator("section")
    @classmethod
    def validate_section(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _VALID_SECTIONS:
            return None  # ignore silencieusement les sections inconnues
        return v


@router.post("/event", status_code=204)
async def track_event(body: EventIn, request: Request, background_tasks: BackgroundTasks):
    check_rate(request, "analytics_event", max_calls=60, window_seconds=60)
    background_tasks.add_task(_do_track, body)


async def _do_track(body: EventIn):
    try:
        sb = get_supabase()
        res = sb.table("tenant").select("id").eq("slug", body.tenant_slug).single().execute()
        if not res.data:
            return
        # Tronquer data pour éviter les abus de stockage
        safe_data = {}
        if body.data:
            safe_data = {k: str(v)[:200] for k, v in list(body.data.items())[:10]}
        sb.table("site_event").insert({
            "tenant_id": res.data["id"],
            "session_id": body.session_id,
            "event_type": body.event_type,
            "section": body.section,
            "data": safe_data,
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


# ── PDF report ───────────────────────────────────────────────────────────────

async def _build_summary(sb, tenant_id: str, since: str, until: Optional[str] = None) -> dict:
    """Reusable summary builder for a given time window."""
    leads_r = (
        sb.table("lead").select("id, source, status")
        .eq("tenant_id", tenant_id).gte("created_at", since)
    )
    if until:
        leads_r = leads_r.lte("created_at", until)
    leads = leads_r.execute().data or []

    leads_by_source: dict = {}
    leads_by_status: dict = {}
    for lead in leads:
        src = lead.get("source") or "inconnu"
        st  = lead.get("status") or "inconnu"
        leads_by_source[src] = leads_by_source.get(src, 0) + 1
        leads_by_status[st]  = leads_by_status.get(st, 0) + 1

    cal_r  = sb.table("calendar").select("id").eq("tenant_id", tenant_id).execute()
    cal_id = (cal_r.data or [{}])[0].get("id") if cal_r.data else None
    appts: list = []
    appts_by_status: dict = {}
    if cal_id:
        q = (sb.table("appointment").select("id, status")
             .eq("calendar_id", cal_id).gte("created_at", since))
        if until:
            q = q.lte("created_at", until)
        appts = q.execute().data or []
        for a in appts:
            st = a.get("status") or "inconnu"
            appts_by_status[st] = appts_by_status.get(st, 0) + 1

    contacts_r = sb.table("contact").select("id", count="exact").eq("tenant_id", tenant_id).execute()

    pageviews = unique_sessions = form_opens = form_submits = chatbot_conversations = chatbot_messages = 0
    sections_viewed: dict = {}
    cta_clicks: dict = {}
    try:
        q = (sb.table("site_event").select("event_type, session_id, section, data")
             .eq("tenant_id", tenant_id).gte("created_at", since))
        if until:
            q = q.lte("created_at", until)
        sessions: set = set()
        for ev in (q.execute().data or []):
            t = ev.get("event_type", "")
            sessions.add(ev.get("session_id", ""))
            if t == "pageview":       pageviews += 1
            elif t == "form_open":    form_opens += 1
            elif t == "form_submit":  form_submits += 1
            elif t == "chatbot_open": chatbot_conversations += 1
            elif t == "chatbot_message": chatbot_messages += 1
            elif t == "section_view" and ev.get("section"):
                sec = ev["section"]
                sections_viewed[sec] = sections_viewed.get(sec, 0) + 1
            elif t == "cta_click":
                action = (ev.get("data") or {}).get("action", "autre")
                cta_clicks[action] = cta_clicks.get(action, 0) + 1
        unique_sessions = len(sessions)
    except Exception:
        pass

    confirmed_appts = sum(1 for a in appts if a.get("status") == "confirmed")
    conv_appt = round(min(confirmed_appts / len(leads) * 100, 100.0), 1) if leads else None
    conv_lead = round(len(leads) / pageviews * 100, 1) if pageviews > 0 else None

    return {
        "contacts_total": contacts_r.count or 0,
        "leads_total": len(leads),
        "leads_by_source": leads_by_source,
        "leads_by_status": leads_by_status,
        "appointments_total": len(appts),
        "appointments_by_status": appts_by_status,
        "pageviews": pageviews,
        "unique_sessions": unique_sessions,
        "sections_viewed": sections_viewed,
        "form_opens": form_opens,
        "form_submits": form_submits,
        "chatbot_conversations": chatbot_conversations,
        "chatbot_messages": chatbot_messages,
        "cta_clicks": cta_clicks,
        "conversion_lead_rate": conv_lead,
        "conversion_appt_rate": conv_appt,
    }


@router.get("/report.pdf")
async def download_analytics_report(
    days: int = Query(30, ge=1, le=365),
    month: Optional[str] = Query(None, description="YYYY-MM — si fourni, ignore days"),
    tenant_id: str = Depends(get_current_tenant),
):
    """Génère et retourne le rapport analytics en PDF."""
    from app.services.pdf import generate_report_pdf
    import calendar as _cal

    sb = get_supabase()

    # Récupère le nom du tenant
    t_row = sb.table("tenant").select("name").eq("id", tenant_id).single().execute()
    tenant_name = (t_row.data or {}).get("name", "Mon établissement")

    # Détermine la fenêtre temporelle
    now = datetime.now(timezone.utc)
    if month:
        try:
            year, m = [int(x) for x in month.split("-")]
            since = datetime(year, m, 1, tzinfo=timezone.utc).isoformat()
            last_day = _cal.monthrange(year, m)[1]
            until = datetime(year, m, last_day, 23, 59, 59, tzinfo=timezone.utc).isoformat()
            period_label = datetime(year, m, 1).strftime("%B %Y")
        except Exception:
            raise HTTPException(400, "Format month invalide, attendu YYYY-MM")
    else:
        since = (now - timedelta(days=days)).isoformat()
        until = None
        period_label = f"{days} derniers jours"

    summary = await _build_summary(sb, tenant_id, since, until)

    try:
        pdf_bytes = generate_report_pdf(
            tenant_name=tenant_name,
            period_label=period_label,
            summary=summary,
        )
    except RuntimeError as e:
        raise HTTPException(503, str(e))

    filename = f"rapport-{month or f'{days}j'}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── ROI / Demand potential (Google Trends via pytrends) ───────────────────────

_CACHE_TTL = timedelta(hours=24)
_VALID_PERIODS = {"week", "month", "quarter", "year"}


import logging as _logging
_roi_logger = _logging.getLogger(__name__)


@router.get("/roi-potential")
async def get_roi_potential(
    period: str = "month",
    force: bool = False,
    tenant_id: str = Depends(get_current_tenant),
):
    if period not in _VALID_PERIODS:
        period = "month"

    sb = get_supabase()

    # ── Cache lookup ──────────────────────────────────────────────────────────
    if not force:
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
    zones: list[str] = []
    offer_names: list[str] = []
    try:
        sites_res = sb.table("site").select("id, coverage_zones").eq("tenant_id", tenant_id).execute()
        site_row = sites_res.data[0] if sites_res.data else None
        _roi_logger.info("roi-potential tenant=%s site_row=%s", tenant_id, site_row)
        if site_row:
            site_id = site_row["id"]
            raw_zones = site_row.get("coverage_zones") or []
            zones = [str(z).strip() for z in raw_zones if z and str(z).strip()]
            _roi_logger.info("roi-potential zones trouvées: %s", zones)
            offers = sb.table("service_offer").select("name").eq("site_id", site_id).execute()
            offer_names = [o["name"] for o in (offers.data or []) if o.get("name")]
    except Exception as e:
        _roi_logger.warning("roi-potential: erreur lecture site/zones: %s", e)

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


# ── Google Analytics (GA4) — backend OAuth flow ──────────────────────────────

def _ga_redirect_uri() -> str:
    return f"{settings.app_url}/api/v1/analytics/google/oauth-callback"

def _sign_state(tenant_id: str) -> str:
    payload = json.dumps({"tenant_id": tenant_id})
    sig = hmac.new(settings.agent_link_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}|{sig}".encode()).decode()

def _verify_state(state: str) -> str:
    try:
        decoded = base64.urlsafe_b64decode(state.encode()).decode()
        payload, sig = decoded.rsplit("|", 1)
        expected = hmac.new(settings.agent_link_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            raise ValueError
        return json.loads(payload)["tenant_id"]
    except Exception:
        raise HTTPException(status_code=400, detail="State invalide")


@router.get("/google/auth-url")
async def get_google_auth_url(tenant_id: str = Depends(get_current_tenant)):
    from urllib.parse import urlencode
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": _ga_redirect_uri(),
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/analytics.readonly email profile",
        "access_type": "offline",
        "prompt": "consent",
        "state": _sign_state(tenant_id),
    }
    return {"url": f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"}


@router.get("/google/oauth-callback")
async def google_oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
):
    frontend = settings.frontend_url_prod or settings.frontend_url
    fail_url = f"{frontend}/dashboard/settings?section=integrations&ga_error=1"

    if error or not code or not state:
        return RedirectResponse(fail_url)

    tenant_id = _verify_state(state)

    async with httpx.AsyncClient() as client:
        resp = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": _ga_redirect_uri(),
            "grant_type": "authorization_code",
        })
        if resp.status_code != 200:
            return RedirectResponse(fail_url)
        tokens = resp.json()

    sb = get_supabase()
    sb.table("google_analytics_connection").upsert(
        {
            "tenant_id": tenant_id,
            "access_token": tokens.get("access_token"),
            "refresh_token": tokens.get("refresh_token"),
        },
        on_conflict="tenant_id",
    ).execute()

    return RedirectResponse(f"{frontend}/dashboard/settings?section=integrations&ga_connected=1")


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


@router.get("/google/properties")
async def list_google_properties(tenant_id: str = Depends(get_current_tenant)):
    """Liste les propriétés GA4 accessibles avec le compte connecté."""
    sb = get_supabase()
    row = sb.table("google_analytics_connection").select("access_token, refresh_token").eq("tenant_id", tenant_id).maybe_single().execute()
    if not row.data or not row.data.get("access_token"):
        raise HTTPException(status_code=404, detail="Compte Google non connecté")

    access_token = row.data["access_token"]

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        # Token expiré → essayer de le rafraîchir
        if resp.status_code == 401 and row.data.get("refresh_token"):
            refresh_resp = await client.post("https://oauth2.googleapis.com/token", data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "refresh_token": row.data["refresh_token"],
                "grant_type": "refresh_token",
            })
            if refresh_resp.status_code == 200:
                new_token = refresh_resp.json().get("access_token")
                sb.table("google_analytics_connection").update({"access_token": new_token}).eq("tenant_id", tenant_id).execute()
                resp = await client.get(
                    "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
                    headers={"Authorization": f"Bearer {new_token}"},
                )

        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Impossible de récupérer les propriétés GA4")

        summaries = resp.json().get("accountSummaries", [])

    properties = []
    for account in summaries:
        for prop in account.get("propertySummaries", []):
            properties.append({
                "id": prop["property"],          # ex: "properties/123456789"
                "name": prop.get("displayName", prop["property"]),
                "account": account.get("displayName", ""),
            })
    return {"properties": properties}


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
