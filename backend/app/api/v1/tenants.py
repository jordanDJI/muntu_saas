from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_user, get_current_tenant
from app.services.subscription import get_tenant_plan
from app.services.tenant_setup import provision_tenant
from app.services.activity import log_activity

router = APIRouter(prefix="/tenants", tags=["Tenants"])


class TenantCreateIn(BaseModel):
    name: str
    slug: str
    sector: str = "other"
    country: str = "BE"


@router.post("/")
async def create_tenant(
    body: TenantCreateIn,
    user: dict = Depends(get_current_user),
    current_tenant_id: str = Depends(get_current_tenant),
):
    """Crée un nouvel espace de travail pour l'utilisateur — réservé au plan Business."""
    plan = await get_tenant_plan(current_tenant_id)
    if not plan["features"].get("multi_tenant"):
        raise HTTPException(
            status_code=403,
            detail="La création de plusieurs espaces est réservée au plan Business",
        )

    sb = get_supabase_admin()
    user_id = user["sub"]

    # Slug disponible ?
    existing = sb.table("tenant").select("id").eq("slug", body.slug).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Ce slug est déjà pris")

    # Créer le tenant
    try:
        tenant = sb.table("tenant").insert({
            "name": body.name,
            "slug": body.slug,
            "sector": body.sector,
            "country": body.country,
        }).execute().data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur création tenant: {e}")

    tenant_id = tenant["id"]

    # Membership owner
    sb.table("membership").insert({
        "tenant_id": tenant_id,
        "user_id": user_id,
        "role": "owner",
    }).execute()

    # Calendrier, pipeline, site, agents IA
    await provision_tenant(tenant_id, user_id, body.name)

    log_activity(tenant_id, user_id, "Nouvel espace créé", body.name)

    return {"id": tenant_id, "slug": body.slug, "name": body.name}


# ── GET /tenants/api-key ──────────────────────────────────────────────────────

@router.get("/api-key")
async def get_api_key(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()
    res = sb.table("tenant").select("api_key").eq("id", tenant_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    key = res.data[0].get("api_key")
    if not key:
        from uuid import uuid4
        key = f"sk_{uuid4().hex}"
        sb.table("tenant").update({"api_key": key}).eq("id", tenant_id).execute()
    return {"api_key": key}


# ── POST /tenants/api-key/regenerate ─────────────────────────────────────────

@router.post("/api-key/regenerate")
async def regenerate_api_key(
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(get_current_user),
):
    from uuid import uuid4
    sb = get_supabase_admin()
    key = f"sk_{uuid4().hex}"
    sb.table("tenant").update({"api_key": key}).eq("id", tenant_id).execute()
    log_activity(tenant_id, user["sub"], "Clé API régénérée", None)
    return {"api_key": key}
