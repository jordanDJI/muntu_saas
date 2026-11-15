"""
Panel admin — Acquisition (/admin/acquisition, migration 086).

Trois listes : entreprises nouvellement immatriculées (SIRENE), leads de l'outil
public « demande locale », parrainages. Lecture et suivi à partir du niveau
support ; import manuel et exports réservés au super admin (les exports sortent
des données personnelles du panel : ils sont journalisés).
"""
from __future__ import annotations

import csv
import io
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.api.v1.admin import _log
from app.core.supabase import get_supabase_admin
from app.middleware.admin import get_current_admin, support_or_above
from app.services import sirene

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/acquisition", tags=["Admin — Acquisition"])

PROSPECT_STATUSES = ("new", "contacted", "converted", "ignored")
_PROSPECT_COLUMNS = (
    "id, name, naf_code, sector, headcount_band, legal_category, created_on, street, postal_code, "
    "city, department, country, status, notes, imported_at, status_changed_at"
)


def _safe_search(q: str | None) -> str:
    """Retire les caractères qui ont un sens dans un filtre PostgREST (`or=(...)`)."""
    return re.sub(r"[,()*%\\:]", " ", q or "").strip()[:60]


def _prospect_query(sb, status: str | None, sector: str | None, department: str | None, q: str | None,
                    count: bool = False):
    query = sb.table("prospect_company").select(_PROSPECT_COLUMNS, count="exact" if count else None)
    if status:
        query = query.eq("status", status)
    if sector:
        query = query.eq("sector", sector)
    if department:
        query = query.eq("department", department.strip())
    term = _safe_search(q)
    if term:
        query = query.or_(f"name.ilike.*{term}*,city.ilike.*{term}*,postal_code.ilike.{term}*")
    return query


def _csv(rows: list[dict], columns: list[tuple[str, str]]) -> Response:
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";")
    writer.writerow([label for _, label in columns])
    for row in rows:
        writer.writerow([row.get(key) if row.get(key) is not None else "" for key, _ in columns])
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return Response(
        content="﻿" + buf.getvalue(),  # BOM : Excel lit l'UTF-8 correctement
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="acquisition-{stamp}.csv"'},
    )


# ── Synthèse ──────────────────────────────────────────────────────────────────

@router.get("/summary")
async def summary(admin=Depends(support_or_above)):
    sb = get_supabase_admin()
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    def count(table: str, **filters) -> int:
        query = sb.table(table).select("id", count="exact").limit(1)
        for key, value in filters.items():
            if key.endswith("__gte"):
                query = query.gte(key[:-5], value)
            elif key.endswith("__not_null"):
                query = query.not_.is_(key[:-10], "null")
            else:
                query = query.eq(key, value)
        try:
            return query.execute().count or 0
        except Exception as exc:  # migration 086 non appliquée
            logger.warning("Acquisition : comptage %s impossible : %s", table, exc)
            return 0

    return {
        "insee_configured": sirene.is_configured(),
        "prospects": {
            "new": count("prospect_company", status="new"),
            "contacted": count("prospect_company", status="contacted"),
            "converted": count("prospect_company", status="converted"),
            "imported_7d": count("prospect_company", imported_at__gte=week_ago),
        },
        "leads": {
            "total": count("marketing_lead"),
            "last_7d": count("marketing_lead", created_at__gte=week_ago),
            "consented": count("marketing_lead", marketing_consent=True),
            "converted": count("marketing_lead", converted_tenant_id__not_null=True),
        },
        "referrals": {
            "signed_up": count("referral"),
            "converted": count("referral", status="converted"),
            "rewarded_failed": count("referral", reward_status="failed"),
        },
    }


# ── Entreprises nouvellement immatriculées ────────────────────────────────────

@router.get("/prospects")
async def list_prospects(
    status: Optional[str] = None,
    sector: Optional[str] = None,
    department: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    admin=Depends(support_or_above),
):
    sb = get_supabase_admin()
    start = (page - 1) * page_size
    res = (
        _prospect_query(sb, status, sector, department, q, count=True)
        .order("created_on", desc=True)
        .order("name")
        .range(start, start + page_size - 1)
        .execute()
    )
    return {"items": res.data or [], "total": res.count or 0, "page": page, "page_size": page_size}


class ProspectUpdateIn(BaseModel):
    status: Optional[Literal["new", "contacted", "converted", "ignored"]] = None
    notes: Optional[str] = Field(None, max_length=2000)


@router.patch("/prospects/{prospect_id}")
async def update_prospect(prospect_id: str, body: ProspectUpdateIn, admin=Depends(support_or_above)):
    updates: dict = {}
    if body.status is not None:
        updates["status"] = body.status
        updates["status_changed_at"] = datetime.now(timezone.utc).isoformat()
    if body.notes is not None:
        updates["notes"] = body.notes.strip() or None
    if not updates:
        raise HTTPException(400, "Rien à modifier")
    res = get_supabase_admin().table("prospect_company").update(updates).eq("id", prospect_id).execute()
    if not res.data:
        raise HTTPException(404, "Fiche introuvable")
    return res.data[0]


@router.get("/prospects/export")
async def export_prospects(
    status: Optional[str] = None,
    sector: Optional[str] = None,
    department: Optional[str] = None,
    q: Optional[str] = None,
    admin=Depends(get_current_admin),
):
    sb = get_supabase_admin()
    rows = (
        _prospect_query(sb, status, sector, department, q)
        .order("created_on", desc=True).limit(5000).execute().data or []
    )
    _log(admin, "acquisition_export_prospects", payload={
        "count": len(rows), "status": status, "sector": sector, "department": department,
    })
    return _csv(rows, [
        ("name", "Nom"), ("sector", "Secteur"), ("naf_code", "Code NAF"), ("created_on", "Création"),
        ("street", "Adresse"), ("postal_code", "Code postal"), ("city", "Ville"),
        ("department", "Département"), ("headcount_band", "Tranche effectif"),
        ("status", "Statut"), ("notes", "Notes"),
    ])


class ImportIn(BaseModel):
    days: int = Field(8, ge=1, le=31)


async def _run_import(days: int) -> None:
    try:
        await sirene.import_recent(days)
    except Exception as exc:
        logger.error("Import SIRENE manuel échoué : %s", exc, exc_info=True)


@router.post("/prospects/import")
async def import_prospects(body: ImportIn, background: BackgroundTasks, admin=Depends(get_current_admin)):
    if not sirene.is_configured():
        raise HTTPException(400, "INSEE_API_KEY n'est pas configurée sur le backend.")
    # L'import pagine l'API Sirene en respectant son quota (30 requêtes/min) :
    # il peut durer plus longtemps qu'une requête HTTP, il part donc en tâche de fond.
    background.add_task(_run_import, body.days)
    _log(admin, "acquisition_import_sirene", payload={"days": body.days})
    return {"started": True, "days": body.days}


# ── Leads de l'outil « demande locale » ───────────────────────────────────────

_LEAD_COLUMNS = (
    "id, email, first_name, source, sector, activity, city, country, marketing_consent, report, "
    "converted_tenant_id, created_at"
)


@router.get("/leads")
async def list_leads(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    admin=Depends(support_or_above),
):
    start = (page - 1) * page_size
    res = (
        get_supabase_admin().table("marketing_lead")
        .select(_LEAD_COLUMNS, count="exact")
        .order("created_at", desc=True)
        .range(start, start + page_size - 1)
        .execute()
    )
    return {"items": res.data or [], "total": res.count or 0, "page": page, "page_size": page_size}


@router.get("/leads/export")
async def export_leads(admin=Depends(get_current_admin)):
    rows = (
        get_supabase_admin().table("marketing_lead").select(_LEAD_COLUMNS)
        .order("created_at", desc=True).limit(5000).execute().data or []
    )
    _log(admin, "acquisition_export_leads", payload={"count": len(rows)})
    for row in rows:
        row["score"] = (row.get("report") or {}).get("region_score")
        row["rank"] = (row.get("report") or {}).get("region_rank")
        row["consent"] = "oui" if row.get("marketing_consent") else "non"
        row["converted"] = "oui" if row.get("converted_tenant_id") else "non"
    return _csv(rows, [
        ("created_at", "Date"), ("email", "Email"), ("first_name", "Prénom"), ("sector", "Secteur"),
        ("activity", "Activité"), ("city", "Région"), ("country", "Pays"),
        ("score", "Indice régional"), ("rank", "Rang"),
        ("consent", "Accepte d'être recontacté"), ("converted", "Inscrit"),
    ])


# ── Parrainages ───────────────────────────────────────────────────────────────

@router.get("/referrals")
async def list_referrals(admin=Depends(support_or_above)):
    rows = (
        get_supabase_admin().table("referral")
        .select(
            "id, via, status, reward_status, reward_detail, created_at, converted_at, rewarded_at, "
            "referrer:referrer_tenant_id(id, name, slug), referred:referred_tenant_id(id, name, slug)"
        )
        .order("created_at", desc=True)
        .limit(500)
        .execute().data or []
    )
    return rows
