"""
Annuaire public Klientys — opt-in par tenant.
Routes publiques : GET /directory/listings, GET /directory/listing/{slug}
Routes auth      : GET|POST|PATCH|DELETE /directory/my-listing
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from app.middleware.tenant import get_current_tenant
from app.core.supabase import get_supabase_admin as get_supabase

_log = logging.getLogger(__name__)

router = APIRouter(prefix="/directory", tags=["Directory"])


# ── Schémas ────────────────────────────────────────────────────────────────────

class ListingUpsertIn(BaseModel):
    metier_slug:      str
    metier_label:     Optional[str] = None
    display_name:     str
    tagline:          Optional[str] = None
    zones:            list[str]
    primary_zone:     str
    profile_photo_url: Optional[str] = None
    accepts_booking:  bool = True


# ── Endpoints publics ──────────────────────────────────────────────────────────

@router.get("/listings")
async def list_listings(
    ville:   str = Query(...),
    metier:  Optional[str] = Query(None),
    page:    int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
):
    sb = get_supabase()
    offset = (page - 1) * per_page
    ville_title = ville.strip().title()

    _log.info("directory/listings — metier=%s ville=%s ville_title=%s", metier, ville, ville_title)

    def _base_query():
        q = (
            sb.table("directory_listing")
            .select("*, tenant(slug)")
            .eq("is_listed", True)
        )
        if metier:
            q = q.eq("metier_slug", metier)
        return q

    rows = _base_query().contains("zones", [ville_title]).range(offset, offset + per_page - 1).execute()

    _log.info("directory/listings — zones match: %d rows", len(rows.data or []))

    # Fallback sur primary_zone (ilike) si pas de résultat par zones
    if not rows.data:
        rows = _base_query().ilike("primary_zone", f"%{ville}%").range(offset, offset + per_page - 1).execute()
        _log.info("directory/listings — primary_zone fallback: %d rows", len(rows.data or []))

    # Résoudre les slugs manquants si le join a retourné null
    tenant_ids = [r["tenant_id"] for r in (rows.data or []) if not r.get("tenant")]
    slug_map: dict = {}
    if tenant_ids:
        t_rows = sb.table("tenant").select("id, slug").in_("id", tenant_ids).execute()
        slug_map = {t["id"]: t["slug"] for t in (t_rows.data or [])}

    ville_slug = ville.lower().replace(" ", "-")
    listings = []
    for r in (rows.data or []):
        tenant_info = r.get("tenant") or {}
        slug = tenant_info.get("slug") or slug_map.get(r["tenant_id"], "")
        m_slug = r.get("metier_slug", "")
        listings.append({
            "id": r["id"],
            "slug": slug,
            "metier_slug": m_slug,
            "display_name": r["display_name"],
            "tagline": r["tagline"],
            "zones": r["zones"],
            "primary_zone": r["primary_zone"],
            "profile_photo_url": r["profile_photo_url"],
            "accepts_booking": r["accepts_booking"],
            "metier_label": r.get("metier_label"),
            "site_url": f"/{slug}",
            "directory_url": f"/annuaire/{m_slug}/{ville_slug}/{slug}",
        })

    return {"metier": metier, "ville": ville, "page": page, "per_page": per_page, "listings": listings}


@router.get("/listing/{slug}")
async def get_listing_by_slug(slug: str):
    sb = get_supabase()
    tenant_res = sb.table("tenant").select("id, slug").eq("slug", slug).single().execute()
    if not tenant_res.data:
        raise HTTPException(404, "Pro introuvable")

    row = (
        sb.table("directory_listing")
        .select("*")
        .eq("tenant_id", tenant_res.data["id"])
        .eq("is_listed", True)
        .single()
        .execute()
    )
    if not row.data:
        raise HTTPException(404, "Fiche non publiée")
    return {**row.data, "tenant_slug": slug}


# ── Endpoints authentifiés ─────────────────────────────────────────────────────

@router.get("/promoted-metiers")
async def list_promoted_metiers():
    """Métiers custom promus par l'admin — utilisés dans le hub /annuaire."""
    sb = get_supabase()
    row = sb.table("system_config").select("value").eq("key", "custom_metiers").limit(1).execute().data
    return row[0]["value"] if row else []


@router.get("/metiers")
async def list_metiers():
    """Retourne les métiers custom distincts déjà utilisés dans l'annuaire (metier_label non nul)."""
    sb = get_supabase()
    rows = (
        sb.table("directory_listing")
        .select("metier_slug, metier_label")
        .eq("is_listed", True)
        .not_.is_("metier_label", "null")
        .execute()
    ).data or []

    seen: dict[str, str] = {}
    for r in rows:
        slug  = r.get("metier_slug", "").strip()
        label = (r.get("metier_label") or "").strip()
        if slug and label and slug not in seen:
            seen[slug] = label

    return [{"slug": s, "label": l} for s, l in sorted(seen.items(), key=lambda x: x[1])]


@router.get("/my-listing")
async def get_my_listing(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    row = sb.table("directory_listing").select("*").eq("tenant_id", tenant_id).limit(1).execute()
    return row.data[0] if row.data else None


@router.post("/opt-in", status_code=201)
async def opt_in(body: ListingUpsertIn, tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    payload = {
        "tenant_id":        tenant_id,
        "is_listed":        True,
        "listed_at":        now,
        "metier_slug":      body.metier_slug,
        "metier_label":     body.metier_label,
        "display_name":     body.display_name,
        "tagline":          body.tagline,
        "zones":            [z.strip().title() for z in body.zones if z.strip()],
        "primary_zone":     body.primary_zone.strip().title(),
        "profile_photo_url": body.profile_photo_url,
        "accepts_booking":  body.accepts_booking,
        "updated_at":       now,
    }

    existing = sb.table("directory_listing").select("id").eq("tenant_id", tenant_id).limit(1).execute()
    if existing.data:
        result = sb.table("directory_listing").update(payload).eq("tenant_id", tenant_id).execute()
    else:
        result = sb.table("directory_listing").insert(payload).execute()

    return result.data[0]


@router.patch("/my-listing")
async def update_my_listing(body: ListingUpsertIn, tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    from datetime import datetime, timezone
    raw = body.model_dump(exclude_none=True)
    if "zones" in raw:
        raw["zones"] = [z.strip().title() for z in raw["zones"] if z.strip()]
    if "primary_zone" in raw:
        raw["primary_zone"] = raw["primary_zone"].strip().title()
    updates = {**raw, "updated_at": datetime.now(timezone.utc).isoformat()}
    result = sb.table("directory_listing").update(updates).eq("tenant_id", tenant_id).execute()
    if not result.data:
        raise HTTPException(404, "Fiche introuvable")
    return result.data[0]


@router.delete("/opt-out", status_code=204)
async def opt_out(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    sb.table("directory_listing").update({"is_listed": False}).eq("tenant_id", tenant_id).execute()
