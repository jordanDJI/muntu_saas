"""
Annuaire public Klientys — opt-in par tenant.
Routes publiques : GET /directory/listings, GET /directory/listing/{slug}
Routes auth      : GET|POST|PATCH|DELETE /directory/my-listing
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from app.middleware.tenant import get_current_tenant
from app.core.supabase import get_supabase_admin as get_supabase

router = APIRouter(prefix="/directory", tags=["Directory"])


# ── Schémas ────────────────────────────────────────────────────────────────────

class ListingUpsertIn(BaseModel):
    metier_slug:      str
    display_name:     str
    tagline:          Optional[str] = None
    zones:            list[str]
    primary_zone:     str
    profile_photo_url: Optional[str] = None
    accepts_booking:  bool = True


# ── Endpoints publics ──────────────────────────────────────────────────────────

@router.get("/listings")
async def list_listings(
    metier: str = Query(...),
    ville:  str = Query(...),
    page:   int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
):
    sb = get_supabase()
    offset = (page - 1) * per_page

    rows = (
        sb.table("directory_listing")
        .select("*, tenant!inner(slug, country)")
        .eq("is_listed", True)
        .eq("metier_slug", metier)
        .contains("zones", [ville.title()])
        .range(offset, offset + per_page - 1)
        .execute()
    )

    # Si pas de résultats exacts sur zones, fallback sur primary_zone
    if not rows.data:
        rows = (
            sb.table("directory_listing")
            .select("*, tenant!inner(slug, country)")
            .eq("is_listed", True)
            .eq("metier_slug", metier)
            .ilike("primary_zone", f"%{ville}%")
            .range(offset, offset + per_page - 1)
            .execute()
        )

    listings = []
    for r in rows.data:
        slug = r.get("tenant", {}).get("slug", "")
        listings.append({
            "id": r["id"],
            "slug": slug,
            "display_name": r["display_name"],
            "tagline": r["tagline"],
            "zones": r["zones"],
            "primary_zone": r["primary_zone"],
            "profile_photo_url": r["profile_photo_url"],
            "accepts_booking": r["accepts_booking"],
            "site_url": f"/{slug}",
            "directory_url": f"/annuaire/{metier}/{ville}/{slug}",
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
        "display_name":     body.display_name,
        "tagline":          body.tagline,
        "zones":            body.zones,
        "primary_zone":     body.primary_zone,
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
    updates = {**body.model_dump(exclude_none=True), "updated_at": datetime.now(timezone.utc).isoformat()}
    result = sb.table("directory_listing").update(updates).eq("tenant_id", tenant_id).execute()
    if not result.data:
        raise HTTPException(404, "Fiche introuvable")
    return result.data[0]


@router.delete("/opt-out", status_code=204)
async def opt_out(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    sb.table("directory_listing").update({"is_listed": False}).eq("tenant_id", tenant_id).execute()
