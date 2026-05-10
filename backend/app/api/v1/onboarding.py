from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_user
from app.services.tenant_setup import provision_tenant

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


class TenantSetupIn(BaseModel):
    first_name: str
    last_name: str
    tenant_name: str
    tenant_slug: str
    sector: str = "other"
    country: str = "BE"


@router.post("/setup")
async def setup_tenant(body: TenantSetupIn, user: dict = Depends(get_current_user)):
    """Appelé après le signup Supabase Auth côté frontend. Crée le tenant et tout ce qui va avec."""
    supabase = get_supabase_admin()
    user_id = user["sub"]
    email = user.get("email", "")

    # Vérifier que le slug est disponible
    existing = supabase.table("tenant").select("id").eq("slug", body.tenant_slug).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Ce slug est déjà pris")

    # Vérifier que l'utilisateur n'a pas déjà un tenant
    already = supabase.table("membership").select("id").eq("user_id", user_id).execute()
    if already.data:
        raise HTTPException(status_code=400, detail="Cet utilisateur a déjà un espace")

    # Créer le tenant
    try:
        tenant = supabase.table("tenant").insert({
            "name": body.tenant_name,
            "slug": body.tenant_slug,
            "sector": body.sector,
            "country": body.country,
        }).execute().data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur création tenant: {e}")
    tenant_id = tenant["id"]

    # Créer l'app_user (password_hash géré par Supabase Auth)
    try:
        supabase.table("app_user").upsert({
            "id": user_id,
            "email": email,
            "first_name": body.first_name,
            "last_name": body.last_name,
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur création app_user: {e}")

    # Créer le membership owner
    supabase.table("membership").insert({
        "tenant_id": tenant_id,
        "user_id": user_id,
        "role": "owner",
    }).execute()

    # Créer calendrier, pipeline, site, agents IA
    await provision_tenant(tenant_id, user_id, body.tenant_name)

    # Injecter tenant_id dans app_metadata du JWT
    import httpx
    from app.core.config import settings
    import logging as _logging
    _log = _logging.getLogger(__name__)
    try:
        async with httpx.AsyncClient(timeout=15.0) as _client:
            _resp = await _client.put(
                f"{settings.supabase_url}/auth/v1/admin/users/{user_id}",
                headers={
                    "apikey": settings.supabase_service_role_key,
                    "Authorization": f"Bearer {settings.supabase_service_role_key}",
                    "Content-Type": "application/json",
                },
                json={"app_metadata": {"tenant_id": tenant_id}},
            )
            _resp.raise_for_status()
    except Exception as e:
        _log.error("Failed to update app_metadata for user %s: %s", user_id, e)

    return {"tenant_id": tenant_id, "slug": body.tenant_slug}
