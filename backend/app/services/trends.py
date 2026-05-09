"""
Google Trends demand estimation via pytrends (unofficial API).
All pytrends calls are synchronous — wrapped in asyncio.to_thread.
"""
import asyncio
import httpx
from typing import Optional

_semaphore = asyncio.Semaphore(3)  # max 3 appels Google Trends simultanés

SECTOR_KEYWORDS: dict[str, list[str]] = {
    "health":   ["infirmière à domicile", "kinésithérapeute", "médecin généraliste"],
    "beauty":   ["coiffeur", "esthéticienne", "salon de beauté"],
    "coaching": ["coach de vie", "coaching personnel", "coach sportif"],
    "finance":  ["comptable indépendant", "conseiller financier", "expert comptable"],
    "trade":    ["plombier", "électricien", "artisan"],
    "other":    ["prestataire de service", "indépendant"],
}

TIMEFRAMES: dict[str, str] = {
    "week":    "now 7-d",
    "month":   "today 1-m",
    "quarter": "today 3-m",
    "year":    "today 12-m",
}


async def _geocode(name: str, country_code: str) -> Optional[tuple[float, float]]:
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": f"{name}, {country_code}", "format": "json", "limit": 1},
                headers={"User-Agent": "LocalPresenceSaaS/1.0 contact@example.com"},
            )
            data = r.json()
            if data:
                return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception:
        pass
    return None


def _run_pytrends(keywords: list[str], geo: str, timeframe: str, zones: list[str]) -> dict:
    result: dict = {
        "interest_over_time": [],
        "zone_scores": {},
        "related_queries": [],
        "aggregate_score": 0,
    }
    try:
        from pytrends.request import TrendReq
        import pandas as pd

        pt = TrendReq(hl="fr", tz=60, timeout=(10, 30), retries=1, backoff_factor=0.5)
        kw = keywords[:1]

        pt.build_payload(kw, geo=geo, timeframe=timeframe)

        # ── Interest over time ────────────────────────────────────────────────
        iot = pt.interest_over_time()
        if not iot.empty and kw[0] in iot.columns:
            col = iot[kw[0]]
            result["aggregate_score"] = int(col.mean())
            result["interest_over_time"] = [
                {"date": str(idx.date()), "value": int(v)}
                for idx, v in col.items()
                if not pd.isna(v)
            ]

        # ── Related queries ───────────────────────────────────────────────────
        try:
            related = pt.related_queries()
            if kw[0] in related:
                top_df = related[kw[0]].get("top")
                if top_df is not None and not top_df.empty:
                    result["related_queries"] = top_df["query"].head(6).tolist()
        except Exception:
            pass

        # ── Zone scores via interest_by_region ────────────────────────────────
        if zones:
            try:
                ibr = pt.interest_by_region(resolution="CITY", inc_low_vol=True)
                if not ibr.empty and kw[0] in ibr.columns:
                    ibr_col = ibr[kw[0]]
                    for zone in zones:
                        matches = [
                            idx for idx in ibr_col.index
                            if zone.lower() in idx.lower() or idx.lower() in zone.lower()
                        ]
                        if matches:
                            result["zone_scores"][zone] = int(ibr_col[matches[0]])
            except Exception:
                pass

    except Exception:
        pass

    return result


async def get_demand_data(
    sector: str,
    country: str,
    zones: list[str],
    period: str,
    offer_names: list[str],
) -> dict:
    # Build keyword list: offer names first, then sector defaults
    kws: list[str] = []
    for name in offer_names[:2]:
        if name:
            kws.append(name)
    for kw in SECTOR_KEYWORDS.get(sector, SECTOR_KEYWORDS["other"]):
        if kw not in kws:
            kws.append(kw)
    kws = kws[:5]

    geo = country if country else "BE"
    timeframe = TIMEFRAMES.get(period, TIMEFRAMES["month"])

    async with _semaphore:
        trends = await asyncio.to_thread(_run_pytrends, kws, geo, timeframe, zones)

    # Geocode each zone in parallel
    geocode_tasks = [_geocode(z, geo) for z in zones]
    coords_list = await asyncio.gather(*geocode_tasks)

    geocoded_zones = []
    for zone, coords in zip(zones, coords_list):
        score = trends["zone_scores"].get(zone, trends["aggregate_score"])
        geocoded_zones.append({
            "name": zone,
            "score": score,
            "lat": coords[0] if coords else None,
            "lng": coords[1] if coords else None,
        })

    return {
        "keywords": kws,
        "zones": geocoded_zones,
        "aggregate_score": trends["aggregate_score"],
        "related_queries": trends["related_queries"],
        "interest_over_time": trends["interest_over_time"],
    }
