from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
from app.middleware.tenant import get_current_tenant
from app.core.supabase import get_supabase
from app.models.site import SiteCreateIn, SiteUpdateIn, SiteOut

router = APIRouter(prefix="/sites", tags=["Sites"])


@router.get("/", response_model=list[SiteOut])
async def list_sites(tenant_id: str = Depends(get_current_tenant)):
    supabase = get_supabase()
    result = supabase.table("site").select("*").eq("tenant_id", tenant_id).execute()
    return result.data


@router.post("/", response_model=SiteOut, status_code=status.HTTP_201_CREATED)
async def create_site(body: SiteCreateIn, tenant_id: str = Depends(get_current_tenant)):
    supabase = get_supabase()
    site_data = {
        "tenant_id": tenant_id,
        "title": body.title,
        "audience_mode": body.audience_mode,
        "default_language": body.default_language,
        "status": "draft",
    }
    if body.template_id:
        site_data["template_id"] = str(body.template_id)

    site = supabase.table("site").insert(site_data).execute().data[0]

    if body.service_offers:
        supabase.table("service_offer").insert(
            [{"site_id": site["id"], **o.model_dump()} for o in body.service_offers]
        ).execute()

    if body.service_areas:
        supabase.table("service_area").insert(
            [{"site_id": site["id"], **a.model_dump()} for a in body.service_areas]
        ).execute()

    return site


@router.patch("/{site_id}", response_model=SiteOut)
async def update_site(site_id: UUID, body: SiteUpdateIn, tenant_id: str = Depends(get_current_tenant)):
    supabase = get_supabase()
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")
    result = supabase.table("site").update(updates).eq("id", str(site_id)).eq("tenant_id", tenant_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Site introuvable")
    return result.data[0]


@router.post("/{site_id}/publish")
async def publish_site(site_id: UUID, tenant_id: str = Depends(get_current_tenant)):
    supabase = get_supabase()
    result = supabase.table("site").update({"status": "published"}).eq("id", str(site_id)).eq("tenant_id", tenant_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Site introuvable")
    return {"status": "published"}


@router.post("/{site_id}/unpublish")
async def unpublish_site(site_id: UUID, tenant_id: str = Depends(get_current_tenant)):
    supabase = get_supabase()
    result = supabase.table("site").update({"status": "unpublished"}).eq("id", str(site_id)).eq("tenant_id", tenant_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Site introuvable")
    return {"status": "unpublished"}
