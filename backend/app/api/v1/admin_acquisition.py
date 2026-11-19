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
_BASE_COLUMNS = (
    "id, name, naf_code, sector, headcount_band, legal_category, created_on, street, postal_code, "
    "city, department, country, status, notes, imported_at, status_changed_at"
)
# Migration 088 : coordonnées retrouvées et suivi des courriers.
_CONTACT_COLUMNS = (
    ", contact_phone, contact_email, contact_website, contact_source, contact_verified, "
    "contact_lookup_count, contact_checked_at, contact_next_check_at, contacted_via, letter_generated_at"
)
_PROSPECT_COLUMNS = _BASE_COLUMNS + _CONTACT_COLUMNS
CONTACT_CHANNELS = ("courrier", "email", "telephone", "visite")


def _safe_search(q: str | None) -> str:
    """Retire les caractères qui ont un sens dans un filtre PostgREST (`or=(...)`)."""
    return re.sub(r"[,()*%\\:]", " ", q or "").strip()[:60]


def _prospect_query(sb, status: str | None, sector: str | None, department: str | None, q: str | None,
                    count: bool = False, columns: str = _PROSPECT_COLUMNS):
    query = sb.table("prospect_company").select(columns, count="exact" if count else None)
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

    def run(columns: str):
        return (
            _prospect_query(sb, status, sector, department, q, count=True, columns=columns)
            .order("created_on", desc=True)
            .order("name")
            .range(start, start + page_size - 1)
            .execute()
        )

    try:
        res = run(_PROSPECT_COLUMNS)
    except Exception as exc:  # migration 088 pas encore appliquée
        logger.warning("prospect_company : colonnes de contact absentes (migration 088 ?) : %s", exc)
        res = run(_BASE_COLUMNS)
    return {"items": res.data or [], "total": res.count or 0, "page": page, "page_size": page_size}


class ProspectUpdateIn(BaseModel):
    status: Optional[Literal["new", "contacted", "converted", "ignored"]] = None
    notes: Optional[str] = Field(None, max_length=2000)
    contacted_via: Optional[Literal["courrier", "email", "telephone", "visite"]] = None
    # Coordonnées corrigées ou saisies à la main : elles deviennent « vérifiées ».
    contact_phone: Optional[str] = Field(None, max_length=40)
    contact_email: Optional[str] = Field(None, max_length=200)
    contact_website: Optional[str] = Field(None, max_length=300)


@router.patch("/prospects/{prospect_id}")
async def update_prospect(prospect_id: str, body: ProspectUpdateIn, admin=Depends(support_or_above)):
    updates: dict = {}
    if body.status is not None:
        updates["status"] = body.status
        updates["status_changed_at"] = datetime.now(timezone.utc).isoformat()
    if body.notes is not None:
        updates["notes"] = body.notes.strip() or None
    if body.contacted_via is not None:
        updates["contacted_via"] = body.contacted_via
    manual = {k: getattr(body, k) for k in ("contact_phone", "contact_email", "contact_website")
              if getattr(body, k) is not None}
    if manual:
        updates.update({k: (v.strip() or None) for k, v in manual.items()})
        updates.update(contact_verified=True, contact_source="saisie manuelle", contact_next_check_at=None)
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
        ("contact_phone", "Téléphone"), ("contact_email", "Email"), ("contact_website", "Site"),
        ("contact_source", "Source des coordonnées"),
        ("status", "Statut"), ("contacted_via", "Contactée par"), ("notes", "Notes"),
    ])


# ── Coordonnées et courriers (migration 088) ──────────────────────────────────

class IdsIn(BaseModel):
    ids: list[str] = Field(..., min_length=1, max_length=200)


def _fetch_prospects(sb, ids: list[str]) -> list[dict]:
    return sb.table("prospect_company").select("*").in_("id", ids).execute().data or []


@router.post("/prospects/{prospect_id}/lookup")
async def lookup_prospect(prospect_id: str, admin=Depends(support_or_above)):
    """Recherche les coordonnées d'une fiche (10 à 30 s : recherche Google + lecture du site)."""
    from app.services import prospect_contacts

    sb = get_supabase_admin()
    rows = _fetch_prospects(sb, [prospect_id])
    if not rows:
        raise HTTPException(404, "Fiche introuvable")
    return await prospect_contacts.lookup_and_store(sb, rows[0])


async def _lookup_many(ids: list[str]) -> None:
    from app.services import prospect_contacts

    sb = get_supabase_admin()
    for prospect in _fetch_prospects(sb, ids):
        await prospect_contacts.lookup_and_store(sb, prospect)


@router.post("/prospects/lookup")
async def lookup_prospects(body: IdsIn, background: BackgroundTasks, admin=Depends(support_or_above)):
    if len(body.ids) > 20:
        raise HTTPException(400, "20 fiches au plus par recherche groupée.")
    background.add_task(_lookup_many, body.ids)
    return {"started": True, "count": len(body.ids)}


@router.post("/prospects/letters")
async def prospect_letters(body: IdsIn, admin=Depends(get_current_admin)):
    """PDF des courriers, une page par entreprise, dans l'ordre de la sélection."""
    import asyncio
    from app.core.urls import default_frontend
    from app.services import prospect_letters as letters

    sb = get_supabase_admin()
    by_id = {r["id"]: r for r in _fetch_prospects(sb, body.ids)}
    prospects = [by_id[i] for i in body.ids if i in by_id and by_id[i].get("street")]
    if not prospects:
        raise HTTPException(400, "Aucune fiche sélectionnée n'a d'adresse postale.")
    template = letters.merge_template(_saved_letter_template(sb), default_frontend())
    pdf = await asyncio.to_thread(letters.generate_letters_pdf, prospects, template)

    now = datetime.now(timezone.utc).isoformat()
    sb.table("prospect_company").update({"letter_generated_at": now}).in_("id", [p["id"] for p in prospects]).execute()
    _log(admin, "acquisition_letters", payload={"count": len(prospects)})
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="courriers-{stamp}.pdf"'})


class BulkStatusIn(IdsIn):
    status: Literal["new", "contacted", "converted", "ignored"]
    contacted_via: Optional[Literal["courrier", "email", "telephone", "visite"]] = None


@router.post("/prospects/bulk-status")
async def bulk_status(body: BulkStatusIn, admin=Depends(support_or_above)):
    updates: dict = {"status": body.status, "status_changed_at": datetime.now(timezone.utc).isoformat()}
    if body.contacted_via:
        updates["contacted_via"] = body.contacted_via
    res = get_supabase_admin().table("prospect_company").update(updates).in_("id", body.ids).execute()
    return {"updated": len(res.data or [])}


def _saved_letter_template(sb) -> dict | None:
    from app.services.prospect_letters import SYSTEM_CONFIG_KEY

    try:
        rows = sb.table("system_config").select("value").eq("key", SYSTEM_CONFIG_KEY).limit(1).execute().data
        return rows[0]["value"] if rows and isinstance(rows[0].get("value"), dict) else None
    except Exception as exc:
        logger.warning("Modèle de courrier illisible : %s", exc)
        return None


@router.get("/letter-template")
async def get_letter_template(admin=Depends(support_or_above)):
    from app.core.urls import default_frontend
    from app.services import prospect_letters as letters

    return letters.merge_template(_saved_letter_template(get_supabase_admin()), default_frontend())


class LetterTemplateIn(BaseModel):
    brand: str = Field("", max_length=60)
    sender_lines: str = Field("", max_length=300)
    sender_email: str = Field("", max_length=120)
    sender_phone: str = Field("", max_length=40)
    place: str = Field("", max_length=60)
    subject: str = Field("", max_length=200)
    body: str = Field("", max_length=4000)
    cta: str = Field("", max_length=200)
    signature: str = Field("", max_length=120)
    controller: str = Field("", max_length=300)
    qr_url: str = Field("", max_length=300)


@router.put("/letter-template")
async def save_letter_template(body: LetterTemplateIn, admin=Depends(get_current_admin)):
    from app.services.prospect_letters import SYSTEM_CONFIG_KEY

    if body.qr_url and not body.qr_url.startswith("https://"):
        raise HTTPException(400, "Le lien du QR code doit commencer par https://")
    get_supabase_admin().table("system_config").upsert(
        {"key": SYSTEM_CONFIG_KEY, "value": body.model_dump()}, on_conflict="key",
    ).execute()
    _log(admin, "acquisition_letter_template")
    return await get_letter_template(admin)


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
