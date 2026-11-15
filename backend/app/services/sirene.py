"""
Prospection : entreprises nouvellement immatriculées (API Sirene de l'INSEE).

Chaque semaine, `import_recent()` récupère les sièges créés dans la période,
filtrés par les codes NAF des secteurs Klientys, et les range dans
`prospect_company` (migration 086). La liste se consulte dans /admin/acquisition.

Règles :
- Seuls les établissements **diffusibles** sont conservés (statut « O ») :
  un entrepreneur qui a demandé la non-diffusion de ses données ne doit pas être
  prospecté à partir de la base Sirene.
- Les fiches jamais traitées sont purgées après `RETENTION_DAYS` (minimisation RGPD).
- SIRENE ne contient ni email ni téléphone : la liste sert à un premier contact
  par courrier, ou après recherche de coordonnées publiques.

Les fonctions sans accès réseau ni base (`build_query`, `parse_etablissement`…)
sont testées dans tests/test_sirene.py.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Codes NAF rév. 2 retenus par secteur Klientys. La nomenclature NAF 2025
# entrera en vigueur à l'INSEE en 2027 : cette table sera à revoir à ce moment-là.
SECTOR_NAF: dict[str, list[str]] = {
    "health": ["86.21Z", "86.23Z", "86.90D", "86.90E", "86.90F"],
    "beauty": ["96.02A", "96.02B", "96.04Z"],
    "coaching": ["85.51Z", "85.59B", "93.13Z", "96.09Z"],
    "finance": ["66.19B", "66.22Z", "69.20Z"],
    "trade": [
        "43.21A", "43.22A", "43.22B", "43.31Z", "43.32A",
        "43.33Z", "43.34Z", "43.91B", "43.99C", "81.30Z",
    ],
    "restaurant": ["56.10A", "56.10C", "56.21Z", "56.30Z"],
    "commerce": ["10.71C", "47.29Z", "47.59B", "47.71Z", "47.76Z", "47.77Z", "47.78C"],
}

# Tranches d'effectif INSEE → libellé lisible (les codes absents restent tels quels).
HEADCOUNT_LABELS: dict[str, str] = {
    "NN": "Non employeuse", "00": "0 salarié", "01": "1-2", "02": "3-5", "03": "6-9",
    "11": "10-19", "12": "20-49", "21": "50-99", "22": "100-199", "31": "200-249",
}

RETENTION_DAYS = 180
PAGE_SIZE = 1000
# L'API Sirene accepte 30 requêtes par minute : une pause de 2,1 s suffit.
_REQUEST_PAUSE_S = 2.1
_API_KEY_HEADER = "X-INSEE-Api-Key-Integration"

_NAF_TO_SECTOR: dict[str, str] = {
    code: sector for sector, codes in SECTOR_NAF.items() for code in codes
}


def sector_for_naf(naf_code: str | None) -> str | None:
    return _NAF_TO_SECTOR.get((naf_code or "").strip().upper())


def build_query(naf_codes: list[str], since: date, until: date) -> str:
    """Requête multicritère Sirene : sièges créés entre `since` et `until`, dans ces NAF.

    `periode()` est nécessaire pour l'activité, variable historisée de l'établissement.
    """
    if not naf_codes:
        raise ValueError("Au moins un code NAF est requis")
    activities = " OR ".join(f"activitePrincipaleEtablissement:{c}" for c in naf_codes)
    return (
        f"dateCreationEtablissement:[{since.isoformat()} TO {until.isoformat()}]"
        f" AND etablissementSiege:true"
        f" AND periode({activities})"
    )


def department_from_postal(postal_code: str | None) -> str | None:
    """Département à partir du code postal (outre-mer : 3 chiffres ; Corse : « 20 »)."""
    cp = (postal_code or "").strip()
    if len(cp) != 5 or not cp.isdigit():
        return None
    return cp[:3] if cp.startswith("97") else cp[:2]


def _clean(value) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return "" if text in ("[ND]", "null") else text


def format_street(adresse: dict) -> str:
    parts = [
        _clean(adresse.get("numeroVoieEtablissement")),
        _clean(adresse.get("indiceRepetitionEtablissement")),
        _clean(adresse.get("typeVoieEtablissement")),
        _clean(adresse.get("libelleVoieEtablissement")),
    ]
    return " ".join(p for p in parts if p)


def display_name(etab: dict) -> str:
    """Nom commercial s'il existe, sinon dénomination, sinon prénom + nom (entreprise individuelle)."""
    periode = (etab.get("periodesEtablissement") or [{}])[0] or {}
    ul = etab.get("uniteLegale") or {}
    for candidate in (
        periode.get("enseigne1Etablissement"),
        periode.get("denominationUsuelleEtablissement"),
        ul.get("denominationUniteLegale"),
        ul.get("denominationUsuelle1UniteLegale"),
    ):
        if _clean(candidate):
            return _clean(candidate)
    first = _clean(ul.get("prenomUsuelUniteLegale")) or _clean(ul.get("prenom1UniteLegale"))
    last = _clean(ul.get("nomUsageUniteLegale")) or _clean(ul.get("nomUniteLegale"))
    return " ".join(p for p in (first, last.upper() if last else "") if p)


def parse_etablissement(etab: dict) -> dict | None:
    """Convertit un établissement Sirene en ligne `prospect_company`, ou None s'il est à écarter."""
    ul = etab.get("uniteLegale") or {}
    if etab.get("statutDiffusionEtablissement") != "O" or ul.get("statutDiffusionUniteLegale") != "O":
        return None
    periode = (etab.get("periodesEtablissement") or [{}])[0] or {}
    if periode.get("etatAdministratifEtablissement") not in (None, "A"):
        return None
    siret = _clean(etab.get("siret"))
    name = display_name(etab)
    if not siret or not name:
        return None
    naf = _clean(periode.get("activitePrincipaleEtablissement")).upper() or None
    adresse = etab.get("adresseEtablissement") or {}
    postal = _clean(adresse.get("codePostalEtablissement")) or None
    return {
        "source": "sirene",
        "external_id": siret,
        "name": name[:200],
        "naf_code": naf,
        "sector": sector_for_naf(naf),
        "headcount_band": _clean(etab.get("trancheEffectifsEtablissement")) or None,
        "legal_category": _clean(ul.get("categorieJuridiqueUniteLegale")) or None,
        "created_on": _clean(etab.get("dateCreationEtablissement")) or None,
        "street": format_street(adresse) or None,
        "postal_code": postal,
        "city": _clean(adresse.get("libelleCommuneEtablissement")) or None,
        "department": department_from_postal(postal),
        "country": "FR",
    }


# ── Accès réseau ───────────────────────────────────────────────────────────────

def is_configured() -> bool:
    return bool(settings.insee_api_key)


async def _fetch_sector(client: httpx.AsyncClient, naf_codes: list[str], since: date, until: date) -> list[dict]:
    rows: list[dict] = []
    cursor = "*"
    query = build_query(naf_codes, since, until)
    throttled = 0
    while True:
        resp = await client.get(
            f"{settings.insee_sirene_url.rstrip('/')}/siret",
            params={"q": query, "nombre": PAGE_SIZE, "curseur": cursor},
        )
        if resp.status_code == 429 and throttled < 3:
            # Quota minute dépassé : une pause d'une minute puis on reprend la même page.
            throttled += 1
            await asyncio.sleep(60)
            continue
        if resp.status_code == 404:  # « Aucun élément trouvé »
            break
        resp.raise_for_status()
        payload = resp.json()
        for etab in payload.get("etablissements") or []:
            parsed = parse_etablissement(etab)
            if parsed:
                rows.append(parsed)
        next_cursor = (payload.get("header") or {}).get("curseurSuivant")
        if not next_cursor or next_cursor == cursor:
            break
        cursor = next_cursor
        await asyncio.sleep(_REQUEST_PAUSE_S)
    return rows


async def fetch_new_companies(since: date, until: date, sectors: list[str] | None = None) -> list[dict]:
    if not is_configured():
        raise RuntimeError("INSEE_API_KEY non configurée")
    wanted = sectors or list(SECTOR_NAF)
    results: list[dict] = []
    headers = {_API_KEY_HEADER: settings.insee_api_key, "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
        for i, sector in enumerate(wanted):
            codes = SECTOR_NAF.get(sector)
            if not codes:
                continue
            if i:
                await asyncio.sleep(_REQUEST_PAUSE_S)
            results.extend(await _fetch_sector(client, codes, since, until))
    return results


def _store(rows: list[dict]) -> int:
    """Insère les nouvelles fiches ; une fiche déjà connue n'est pas modifiée (statut, notes conservés)."""
    from app.core.supabase import get_supabase_admin

    sb = get_supabase_admin()
    stored = 0
    for start in range(0, len(rows), 500):
        batch = rows[start:start + 500]
        res = (
            sb.table("prospect_company")
            .upsert(batch, on_conflict="source,external_id", ignore_duplicates=True)
            .execute()
        )
        stored += len(res.data or [])
    return stored


def purge_stale(now: datetime | None = None) -> int:
    """Supprime les fiches jamais exploitées (nouvelles ou écartées) au-delà de la durée de conservation."""
    from app.core.supabase import get_supabase_admin

    cutoff = ((now or datetime.now(timezone.utc)) - timedelta(days=RETENTION_DAYS)).isoformat()
    res = (
        get_supabase_admin().table("prospect_company")
        .delete()
        .in_("status", ["new", "ignored"])
        .lt("imported_at", cutoff)
        .execute()
    )
    return len(res.data or [])


async def import_recent(days: int = 8, sectors: list[str] | None = None) -> dict:
    """Importe les créations des `days` derniers jours (8 par défaut : un jour de recouvrement par semaine)."""
    until = date.today()
    since = until - timedelta(days=max(1, min(days, 31)))
    rows = await fetch_new_companies(since, until, sectors)
    stored = await asyncio.to_thread(_store, rows)
    purged = await asyncio.to_thread(purge_stale)
    logger.info("Sirene : %d établissements lus, %d nouveaux, %d purgés (%s → %s)",
                len(rows), stored, purged, since, until)
    return {"fetched": len(rows), "new": stored, "purged": purged,
            "since": since.isoformat(), "until": until.isoformat()}
