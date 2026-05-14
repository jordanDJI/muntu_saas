from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
from app.middleware.tenant import get_current_tenant, get_current_user
from app.core.supabase import get_supabase_admin as get_supabase
from app.models.site import SiteCreateIn, SiteUpdateIn, SiteOut, ServiceOfferIn, TestimonialIn
from app.services.activity import log_activity
from app.services.google_indexing import notify_url_updated, notify_url_deleted

router = APIRouter(prefix="/sites", tags=["Sites"])


@router.get("/", response_model=list[SiteOut])
async def list_sites(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    result = sb.table("site").select("*").eq("tenant_id", tenant_id).execute()
    return result.data


@router.post("/", response_model=SiteOut, status_code=status.HTTP_201_CREATED)
async def create_site(body: SiteCreateIn, tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    site_data = {
        "tenant_id": tenant_id,
        "title": body.title,
        "audience_mode": body.audience_mode,
        "default_language": body.default_language,
        "status": "draft",
    }
    if body.template_id:
        site_data["template_id"] = str(body.template_id)

    site = sb.table("site").insert(site_data).execute().data[0]

    if body.service_offers:
        sb.table("service_offer").insert(
            [{"site_id": site["id"], **o.model_dump(exclude_none=True)} for o in body.service_offers]
        ).execute()

    if body.service_areas:
        sb.table("service_area").insert(
            [{"site_id": site["id"], **a.model_dump()} for a in body.service_areas]
        ).execute()

    return site


@router.patch("/{site_id}", response_model=SiteOut)
async def update_site(site_id: UUID, body: SiteUpdateIn, tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")
    result = sb.table("site").update(updates).eq("id", str(site_id)).eq("tenant_id", tenant_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Site introuvable")
    return result.data[0]


@router.post("/{site_id}/publish")
async def publish_site(site_id: UUID, tenant_id: str = Depends(get_current_tenant), user: dict = Depends(get_current_user)):
    sb = get_supabase()
    result = sb.table("site").update({"status": "published"}).eq("id", str(site_id)).eq("tenant_id", tenant_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Site introuvable")
    log_activity(tenant_id, user["sub"], "Site publié", result.data[0].get("title"))
    tenant = sb.table("tenant").select("slug").eq("id", tenant_id).single().execute()
    if tenant.data:
        from app.core.config import settings
        url = f"{settings.frontend_url}/{tenant.data['slug']}"
        await notify_url_updated(url)
    return {"status": "published"}


@router.post("/{site_id}/unpublish")
async def unpublish_site(site_id: UUID, tenant_id: str = Depends(get_current_tenant), user: dict = Depends(get_current_user)):
    sb = get_supabase()
    result = sb.table("site").update({"status": "draft"}).eq("id", str(site_id)).eq("tenant_id", tenant_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Site introuvable")
    log_activity(tenant_id, user["sub"], "Site dépublié", result.data[0].get("title"))
    tenant = sb.table("tenant").select("slug").eq("id", tenant_id).single().execute()
    if tenant.data:
        from app.core.config import settings
        url = f"{settings.frontend_url}/{tenant.data['slug']}"
        await notify_url_deleted(url)
    return {"status": "draft"}


# ── Service offers ────────────────────────────────────────────────────────────

def _offer_from_db(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "site_id": row.get("site_id"),
        "name": row.get("name"),
        "description": row.get("description"),
        "duration_min": row.get("duration_min"),
        "price_eur": row.get("price_eur"),
        "created_at": row.get("created_at"),
    }

def _offer_to_db(site_id: str, offer: ServiceOfferIn) -> dict:
    row: dict = {"site_id": site_id, "name": offer.name}
    if offer.description is not None:
        row["description"] = offer.description
    if offer.duration_min is not None:
        row["duration_min"] = offer.duration_min
    if offer.price_eur is not None:
        row["price_eur"] = offer.price_eur
    if offer.image_url is not None:
        row["image_url"] = offer.image_url
    return row


@router.get("/{site_id}/offers")
async def get_offers(site_id: UUID, tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    _assert_owner(sb, str(site_id), tenant_id)
    rows = sb.table("service_offer").select("*").eq("site_id", str(site_id)).execute().data
    return [_offer_from_db(r) for r in rows]


@router.put("/{site_id}/offers")
async def replace_offers(site_id: UUID, offers: list[ServiceOfferIn], tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    _assert_owner(sb, str(site_id), tenant_id)
    try:
        sb.table("service_offer").delete().eq("site_id", str(site_id)).execute()
        if offers:
            sb.table("service_offer").insert(
                [_offer_to_db(str(site_id), o) for o in offers]
            ).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur sauvegarde prestations : {str(e)}")
    return {"replaced": len(offers)}


# ── Testimonials ──────────────────────────────────────────────────────────────

@router.get("/{site_id}/testimonials")
async def get_testimonials(site_id: UUID, tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    _assert_owner(sb, str(site_id), tenant_id)
    return sb.table("testimonial").select("*").eq("site_id", str(site_id)).execute().data


@router.put("/{site_id}/testimonials")
async def replace_testimonials(site_id: UUID, testimonials: list[TestimonialIn], tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase()
    _assert_owner(sb, str(site_id), tenant_id)
    sb.table("testimonial").delete().eq("site_id", str(site_id)).execute()
    if testimonials:
        sb.table("testimonial").insert(
            [{"site_id": str(site_id), **t.model_dump()} for t in testimonials]
        ).execute()
    return {"replaced": len(testimonials)}


# ── Helper ────────────────────────────────────────────────────────────────────

def _assert_owner(sb, site_id: str, tenant_id: str):
    res = sb.table("site").select("id").eq("id", site_id).eq("tenant_id", tenant_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Site introuvable")
