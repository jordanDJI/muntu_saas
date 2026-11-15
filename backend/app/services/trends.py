"""
Google Trends demand estimation via pytrends (unofficial API).
All pytrends calls are synchronous — wrapped in asyncio.to_thread.

Granularité : **la région**. Pour la France et la Belgique, Google ne publie pas
de données par ville — même en demandant la résolution « CITY », il renvoie les
22 anciennes régions françaises ou les 3 régions belges, et à l'intérieur d'une
région les valeurs par ville sont presque toutes nulles. Les scores « par zone
d'intervention » affichaient donc l'indice national sous un nom de ville.
`REGIONS` liste les codes réellement publiés (relevés sur Google en novembre 2026).
"""
import asyncio
import logging

logger = logging.getLogger(__name__)

_semaphore = asyncio.Semaphore(3)  # max 3 appels Google Trends simultanés

SECTOR_KEYWORDS: dict[str, list[str]] = {
    "health":     ["infirmière à domicile", "kinésithérapeute", "médecin généraliste"],
    "beauty":     ["coiffeur", "esthéticienne", "salon de beauté"],
    "coaching":   ["coach de vie", "coaching personnel", "coach sportif"],
    "finance":    ["comptable indépendant", "conseiller financier", "expert comptable"],
    "trade":      ["plombier", "électricien", "artisan"],
    "restaurant": ["restaurant", "livraison repas", "réservation restaurant"],
    "commerce":   ["boutique", "magasin", "commerce de proximité"],
    "other":      ["prestataire de service", "indépendant"],
}


def get_sector_keywords() -> dict[str, list[str]]:
    """Retourne les mots-clés depuis system_config (admin panel), avec fallback sur SECTOR_KEYWORDS."""
    try:
        from app.core.supabase import get_supabase_admin
        row = get_supabase_admin().table("system_config").select("value").eq("key", "sector_keywords").limit(1).execute().data
        if row and isinstance(row[0]["value"], dict):
            return {**SECTOR_KEYWORDS, **row[0]["value"]}
    except Exception as exc_ignored:
        logger.warning("Erreur ignorée : %s", exc_ignored, exc_info=True)
    return SECTOR_KEYWORDS

TIMEFRAMES: dict[str, str] = {
    "week":    "now 7-d",
    "month":   "today 1-m",
    "quarter": "today 3-m",
    "year":    "today 12-m",
}

# ── Régions publiées par Google Trends ───────────────────────────────────────
# (code Google, nom, indication pour s'y retrouver). La France est découpée selon
# les anciennes régions : l'indication liste leurs départements.
REGIONS: dict[str, list[tuple[str, str, str]]] = {
    "FR": [
        ("FR-A", "Alsace", "67, 68"),
        ("FR-B", "Aquitaine", "24, 33, 40, 47, 64"),
        ("FR-C", "Auvergne", "03, 15, 43, 63"),
        ("FR-P", "Basse-Normandie", "14, 50, 61"),
        ("FR-D", "Bourgogne", "21, 58, 71, 89"),
        ("FR-E", "Bretagne", "22, 29, 35, 56"),
        ("FR-F", "Centre-Val de Loire", "18, 28, 36, 37, 41, 45"),
        ("FR-G", "Champagne-Ardenne", "08, 10, 51, 52"),
        ("FR-H", "Corse", "2A, 2B"),
        ("FR-I", "Franche-Comté", "25, 39, 70, 90"),
        ("FR-Q", "Haute-Normandie", "27, 76"),
        ("FR-J", "Île-de-France", "75, 77, 78, 91, 92, 93, 94, 95"),
        ("FR-K", "Languedoc-Roussillon", "11, 30, 34, 48, 66"),
        ("FR-L", "Limousin", "19, 23, 87"),
        ("FR-M", "Lorraine", "54, 55, 57, 88"),
        ("FR-N", "Midi-Pyrénées", "09, 12, 31, 32, 46, 65, 81, 82"),
        ("FR-O", "Nord-Pas-de-Calais", "59, 62"),
        ("FR-R", "Pays de la Loire", "44, 49, 53, 72, 85"),
        ("FR-S", "Picardie", "02, 60, 80"),
        ("FR-T", "Poitou-Charentes", "16, 17, 79, 86"),
        ("FR-U", "Provence-Alpes-Côte d'Azur", "04, 05, 06, 13, 83, 84"),
        ("FR-V", "Rhône-Alpes", "01, 07, 26, 38, 42, 69, 73, 74"),
    ],
    "BE": [
        ("BE-BRU", "Bruxelles", ""),
        ("BE-WAL", "Wallonie", ""),
        ("BE-VLG", "Région flamande", ""),
    ],
    "CH": [
        ("CH-AG", "Argovie", ""), ("CH-AI", "Appenzell Rhodes-Intérieures", ""),
        ("CH-AR", "Appenzell Rhodes-Extérieures", ""), ("CH-BL", "Bâle-Campagne", ""),
        ("CH-BS", "Bâle-Ville", ""), ("CH-BE", "Berne", ""), ("CH-FR", "Fribourg", ""),
        ("CH-GE", "Genève", ""), ("CH-GL", "Glaris", ""), ("CH-GR", "Grisons", ""),
        ("CH-JU", "Jura", ""), ("CH-LU", "Lucerne", ""), ("CH-NE", "Neuchâtel", ""),
        ("CH-NW", "Nidwald", ""), ("CH-OW", "Obwald", ""), ("CH-SG", "Saint-Gall", ""),
        ("CH-SH", "Schaffhouse", ""), ("CH-SZ", "Schwytz", ""), ("CH-SO", "Soleure", ""),
        ("CH-TG", "Thurgovie", ""), ("CH-TI", "Tessin", ""), ("CH-UR", "Uri", ""),
        ("CH-VS", "Valais", ""), ("CH-VD", "Vaud", ""), ("CH-ZG", "Zoug", ""),
        ("CH-ZH", "Zurich", ""),
    ],
    "LU": [
        ("LU-D", "Diekirch", ""),
        ("LU-G", "Grevenmacher", ""),
        ("LU-L", "District de Luxembourg", ""),
    ],
    "CA": [
        ("CA-AB", "Alberta", ""), ("CA-BC", "Colombie-Britannique", ""),
        ("CA-PE", "Île-du-Prince-Édouard", ""), ("CA-MB", "Manitoba", ""),
        ("CA-NB", "Nouveau-Brunswick", ""), ("CA-NS", "Nouvelle-Écosse", ""),
        ("CA-NU", "Nunavut", ""), ("CA-ON", "Ontario", ""), ("CA-QC", "Québec", ""),
        ("CA-SK", "Saskatchewan", ""), ("CA-NL", "Terre-Neuve-et-Labrador", ""),
        ("CA-NT", "Territoires du Nord-Ouest", ""), ("CA-YT", "Territoire du Yukon", ""),
    ],
}

_REGION_NAMES: dict[str, str] = {
    code: name for regions in REGIONS.values() for code, name, _ in regions
}

# Département → ancienne région (codes Google), pour situer un tenant français.
_FR_DEPT_REGION: dict[str, str] = {
    dept: code
    for code, _, depts in REGIONS["FR"]
    for dept in depts.replace("2A", "20").replace("2B", "20").split(", ")
}


def region_name(code: str | None) -> str | None:
    return _REGION_NAMES.get((code or "").upper())


def region_from_postal(country: str | None, postal_code: str | None) -> str | None:
    """Région Google Trends d'une adresse, à partir de son code postal (France, Belgique)."""
    cp = (postal_code or "").strip().replace(" ", "")
    country = (country or "").upper()
    if country == "FR" and len(cp) == 5 and cp.isdigit():
        return _FR_DEPT_REGION.get(cp[:2])
    if country == "BE" and len(cp) == 4 and cp.isdigit():
        n = int(cp)
        if 1000 <= n <= 1299:
            return "BE-BRU"
        if 1300 <= n <= 1499 or 4000 <= n <= 7999:
            return "BE-WAL"
        if 1500 <= n <= 3999 or 8000 <= n <= 9999:
            return "BE-VLG"
    return None


def rank_region(regions: list[dict], code: str | None) -> dict | None:
    """Position d'une région dans le classement (1 = la plus forte demande)."""
    if not code:
        return None
    ordered = sorted(regions, key=lambda r: r["score"], reverse=True)
    for i, r in enumerate(ordered, start=1):
        if r["code"] == code:
            return {**r, "rank": i, "count": len(ordered)}
    return None


def _run_pytrends(keywords: list[str], geo: str, timeframe: str) -> dict:
    result: dict = {
        "interest_over_time": [],
        "related_queries": [],
        "regions": [],
        "aggregate_score": 0,
        # True quand Google n'a pas répondu (429, changement d'API non officielle) :
        # les zéros ne sont alors pas une mesure, et ne doivent pas être mis en cache.
        "degraded": False,
    }
    try:
        from pytrends.request import TrendReq
        import pandas as pd

        # retries et backoff_factor doivent rester à 0 : au-delà, pytrends 4.9.2
        # construit un urllib3.Retry(method_whitelist=...), paramètre supprimé en
        # urllib3 2.x → TypeError à chaque appel, et toutes les mesures tombaient
        # en « degraded » (potentiel de demande des tenants et outil public).
        pt = TrendReq(hl="fr", tz=60, timeout=(10, 30), retries=0, backoff_factor=0)
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
        except Exception as exc_ignored:
            logger.warning("Google Trends : requêtes associées indisponibles (%s) : %s", geo, exc_ignored)

        # ── Régions ───────────────────────────────────────────────────────────
        # Sur un pays, Google renvoie sa subdivision par défaut (régions, cantons,
        # provinces). 100 = la région où le mot-clé pèse le plus dans les recherches.
        try:
            ibr = pt.interest_by_region(resolution="REGION", inc_low_vol=True, inc_geo_code=True)
            if not ibr.empty and kw[0] in ibr.columns:
                result["regions"] = sorted(
                    (
                        {
                            "code": str(row["geoCode"]),
                            "name": region_name(row["geoCode"]) or str(name),
                            "score": int(row[kw[0]]),
                        }
                        for name, row in ibr.iterrows()
                        if not pd.isna(row[kw[0]])
                    ),
                    key=lambda r: r["score"],
                    reverse=True,
                )
        except Exception as exc_ignored:
            logger.warning("Google Trends : scores par région indisponibles (%s) : %s", geo, exc_ignored)

    except Exception as exc:
        result["degraded"] = True
        logger.warning("Google Trends indisponible (mots-clés=%s, geo=%s) : %s", keywords[:1], geo, exc, exc_info=True)

    return result


async def get_demand_data(
    sector: str,
    country: str,
    period: str,
    offer_names: list[str],
    custom_keywords: list[str] | None = None,
    region: str | None = None,
) -> dict:
    """Demande Google pour un secteur dans un pays, classée par région.

    `region` (code Google, ex. « FR-U ») : la région à mettre en avant, renvoyée
    dans `region` avec son rang. Absente ou inconnue de Google → `region` vaut None.
    """
    # Build keyword list: custom overrides > offer names > sector defaults
    kws: list[str] = []
    if custom_keywords:
        kws = [k.strip() for k in custom_keywords if k.strip()][:10]
    else:
        for name in offer_names[:2]:
            if name:
                kws.append(name)
        _kw_map = get_sector_keywords()
        for kw in _kw_map.get(sector, _kw_map.get("other", [])):
            if kw not in kws:
                kws.append(kw)
        kws = kws[:5]

    geo = country if country else "BE"
    timeframe = TIMEFRAMES.get(period, TIMEFRAMES["month"])

    async with _semaphore:
        trends = await asyncio.to_thread(_run_pytrends, kws, geo, timeframe)

    return {
        "keywords": kws,
        "aggregate_score": trends["aggregate_score"],
        "related_queries": trends["related_queries"],
        "interest_over_time": trends["interest_over_time"],
        "regions": trends["regions"],
        "region": rank_region(trends["regions"], region),
        "degraded": trends["degraded"],
    }
