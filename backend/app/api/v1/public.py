"""
Endpoints publics (sans authentification) pour servir les données du site vitrine.
Utilise la clé service-role côté backend — le frontend n'a pas besoin de SUPABASE_SERVICE_ROLE_KEY.
"""

from fastapi import APIRouter, HTTPException, Query
from app.core.supabase import get_supabase_admin as get_supabase

router = APIRouter(prefix="/public", tags=["Public"])


@router.get("/stats")
async def get_public_stats():
    sb = get_supabase()
    res = sb.table("tenant").select("id", count="exact").eq("is_active", True).execute()
    return {"tenant_count": res.count or 0}


@router.get("/published-slugs")
async def get_published_slugs():
    sb = get_supabase()
    rows = (
        sb.table("tenant")
        .select("slug, site!inner(status)")
        .eq("site.status", "published")
        .execute()
    )
    slugs = [r["slug"] for r in rows.data if r.get("slug")]
    return {"slugs": slugs}


@router.get("/directory-slugs")
async def get_directory_slugs():
    import unicodedata
    def to_slug(s: str) -> str:
        s = unicodedata.normalize("NFD", s.lower())
        s = "".join(c for c in s if unicodedata.category(c) != "Mn")
        return s.replace(" ", "-")

    sb = get_supabase()
    rows = (
        sb.table("directory_listing")
        .select("metier_slug, primary_zone, tenant!inner(slug)")
        .eq("is_listed", True)
        .execute()
    )
    slugs = []
    for r in rows.data:
        tenant_slug = r.get("tenant", {}).get("slug", "")
        metier = r.get("metier_slug", "")
        ville_slug = to_slug(r.get("primary_zone") or "")
        if tenant_slug and metier and ville_slug:
            slugs.append({"metier": metier, "ville": ville_slug, "slug": tenant_slug})
    return {"slugs": slugs}


@router.get("/site/{slug}")
async def get_public_site(slug: str, preview: bool = Query(False)):
    sb = get_supabase()

    tenant_res = sb.table("tenant").select("id, name, country").eq("slug", slug).limit(1).execute()
    if not tenant_res.data:
        raise HTTPException(status_code=404, detail="Site introuvable")

    tenant = tenant_res.data[0]

    query = (
        sb.table("site")
        .select("*, service_offer(*), service_area(*), testimonial(*)")
        .eq("tenant_id", tenant["id"])
    )

    if not preview:
        query = query.eq("status", "published")

    site_res = query.single().execute()
    if not site_res.data:
        raise HTTPException(status_code=404, detail="Site introuvable ou non publié")

    domain_res = sb.table("custom_domain").select("domain").eq("tenant_id", tenant["id"]).eq("status", "active").limit(1).execute()
    custom_domain = domain_res.data[0]["domain"] if domain_res.data else None

    return {**site_res.data, "tenant": {**tenant, "country": tenant_res.data[0].get("country", "FR"), "custom_domain": custom_domain}}
