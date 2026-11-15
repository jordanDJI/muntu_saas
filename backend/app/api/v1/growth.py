"""
Acquisition — routes publiques et tenant (migration 086).

- Outil public « demande locale » : `/growth/demand-preview` (score immédiat) et
  `/growth/demand-report` (rapport complet par email → `marketing_lead`).
- Parrainage : vérification d'un code à l'inscription, et vue « mes parrainages ».

Les routes admin (liste des prospects SIRENE, leads, parrainages) sont dans
`admin_acquisition.py`.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.config import settings
from app.core.supabase import get_supabase_admin
from app.middleware.rate_limit import check_rate_async, check_rate_by_key
from app.middleware.tenant import get_current_tenant
from app.services import referral as referral_svc
from app.services.trends import SECTOR_KEYWORDS, get_demand_data

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/growth", tags=["Growth"])

CACHE_DAYS = 7
SUPPORTED_COUNTRIES = {"FR", "BE", "CH", "LU", "CA", "DE", "NL"}
SECTOR_LABELS = {
    "health": "santé", "beauty": "beauté et bien-être", "coaching": "coaching et sport",
    "finance": "comptabilité et finance", "trade": "artisanat et bâtiment",
    "restaurant": "restauration", "commerce": "commerce", "other": "services",
}


class DemandIn(BaseModel):
    sector: str = "other"
    activity: str = Field("", max_length=60)
    city: str = Field(..., min_length=2, max_length=80)
    country: str = "FR"

    @field_validator("sector")
    @classmethod
    def _sector(cls, v: str) -> str:
        return v if v in SECTOR_KEYWORDS else "other"

    @field_validator("country")
    @classmethod
    def _country(cls, v: str) -> str:
        v = (v or "").strip().upper()
        return v if v in SUPPORTED_COUNTRIES else "FR"

    @field_validator("activity", "city")
    @classmethod
    def _strip(cls, v: str) -> str:
        return " ".join((v or "").split())


class DemandReportIn(DemandIn):
    email: EmailStr
    first_name: str = Field("", max_length=60)
    marketing_consent: bool = False
    website: str = ""  # pot de miel : un humain ne le remplit jamais


def _city_title(city: str) -> str:
    return "-".join(part[:1].upper() + part[1:] for part in city.strip().split("-"))


def trend_pct(points: list[dict]) -> int | None:
    """Écart (en %) entre la moyenne des 3 derniers mois et celle des 12 mois."""
    values = [p.get("value", 0) for p in points or []]
    if len(values) < 16:
        return None
    overall = sum(values) / len(values)
    recent = values[-13:]
    if overall <= 0:
        return None
    return int(round((sum(recent) / len(recent) - overall) / overall * 100))


async def _compute(body: DemandIn) -> dict:
    city = _city_title(body.city)
    key = f"{body.country}|{city.lower()}|{body.sector}|{body.activity.lower()}"
    sb = get_supabase_admin()
    since = (datetime.now(timezone.utc) - timedelta(days=CACHE_DAYS)).isoformat()
    try:
        cached = (
            sb.table("public_demand_cache").select("data")
            .eq("cache_key", key).gte("computed_at", since).limit(1).execute().data
        )
        if cached:
            return cached[0]["data"]
    except Exception as exc:
        logger.warning("public_demand_cache illisible : %s", exc)

    # Plafond global : l'outil public ne doit pas épuiser le quota Google Trends
    # dont dépend le potentiel de demande affiché aux tenants.
    check_rate_by_key("global", "demand_tool_compute", 60, 3600)

    raw = await get_demand_data(
        sector=body.sector,
        country=body.country,
        zones=[city],
        period="year",
        offer_names=[],
        custom_keywords=[body.activity] if body.activity else None,
    )
    zone = (raw.get("zones") or [{}])[0]
    data = {
        "activity": body.activity or SECTOR_LABELS.get(body.sector, "services"),
        "sector": body.sector,
        "city": city,
        "country": body.country,
        "keywords": raw.get("keywords", [])[:3],
        "aggregate_score": raw.get("aggregate_score", 0),
        "city_score": zone.get("score") if zone.get("matched") else None,
        "lat": zone.get("lat"),
        "lng": zone.get("lng"),
        "interest_over_time": raw.get("interest_over_time", []),
        "related_queries": raw.get("related_queries", []),
        "trend_pct": trend_pct(raw.get("interest_over_time", [])),
        "degraded": bool(raw.get("degraded")),
    }
    if not data["degraded"]:
        try:
            sb.table("public_demand_cache").upsert({
                "cache_key": key, "data": data,
                "computed_at": datetime.now(timezone.utc).isoformat(),
            }, on_conflict="cache_key").execute()
        except Exception as exc:
            logger.warning("public_demand_cache non écrit : %s", exc)
    return data


def _public_view(data: dict) -> dict:
    """Ce qui s'affiche sans email : le score et la courbe, pas les recherches associées."""
    return {k: v for k, v in data.items() if k != "related_queries"} | {
        "related_count": len(data.get("related_queries") or []),
    }


@router.post("/demand-preview")
async def demand_preview(body: DemandIn, request: Request):
    await check_rate_async(request, "demand_preview", 10, 600)
    data = await _compute(body)
    if data["degraded"]:
        raise HTTPException(503, "Google Trends ne répond pas pour le moment. Réessayez dans quelques minutes.")
    return _public_view(data)


@router.post("/demand-report")
async def demand_report(body: DemandReportIn, request: Request):
    if body.website:
        return {"ok": True}  # robot : on ne dit rien
    await check_rate_async(request, "demand_report", 3, 3600)
    email = str(body.email).strip().lower()
    check_rate_by_key(email, "demand_report", 3, 86400)

    data = await _compute(body)
    if data["degraded"]:
        raise HTTPException(503, "Google Trends ne répond pas pour le moment. Réessayez dans quelques minutes.")

    sb = get_supabase_admin()
    try:
        sb.table("marketing_lead").insert({
            "email": email,
            "first_name": body.first_name.strip() or None,
            "source": "demand_tool",
            "sector": body.sector,
            "activity": body.activity or None,
            "city": data["city"],
            "country": body.country,
            "marketing_consent": body.marketing_consent,
            "report": {k: data.get(k) for k in ("aggregate_score", "city_score", "trend_pct", "keywords")},
        }).execute()
    except Exception as exc:
        logger.error("marketing_lead non enregistré : %s", exc, exc_info=True)

    base = settings.frontend_url.rstrip("/")
    try:
        from app.services.email import send_demand_report
        await asyncio.to_thread(
            send_demand_report,
            to_email=email,
            first_name=body.first_name.strip(),
            activity_label=data["activity"],
            city=data["city"],
            report=data,
            signup_url=f"{base}/onboarding?via=demand_tool",
            tool_url=f"{base}/outils/demande-locale",
        )
    except Exception as exc:
        logger.error("Rapport de demande non envoyé à %s : %s", email, exc, exc_info=True)
        raise HTTPException(502, "Le rapport n'a pas pu être envoyé. Réessayez dans quelques minutes.")
    return data


# ── Parrainage ────────────────────────────────────────────────────────────────

@router.get("/referral/check")
async def referral_check(request: Request, code: str = Query(..., max_length=200)):
    await check_rate_async(request, "referral_check", 30, 600)
    referrer = referral_svc.resolve_referrer(get_supabase_admin(), code)
    if not referrer:
        return {"valid": False}
    return {"valid": True, "code": referrer["slug"], "name": referrer["name"]}


@router.get("/referral/me")
async def my_referrals(tenant_id: str = Depends(get_current_tenant)):
    return referral_svc.referral_overview(get_supabase_admin(), tenant_id)
