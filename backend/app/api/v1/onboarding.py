import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.supabase import get_supabase_admin
from app.core.config import settings
from app.middleware.tenant import get_current_user
from app.services.tenant_setup import provision_tenant

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])
_log = logging.getLogger(__name__)


class TenantSetupIn(BaseModel):
    first_name: str
    last_name: str
    tenant_name: str
    tenant_slug: str
    sector: str = "other"
    country: str = "BE"


def _upsert_app_user(supabase, user_id: str, email: str, first_name: str, last_name: str) -> None:
    """Crée ou met à jour app_user. Gère le conflit d'email (même email, identité différente)."""
    try:
        res = supabase.table("app_user").upsert(
            {"id": user_id, "email": email, "first_name": first_name, "last_name": last_name},
            on_conflict="id",
        ).execute()
        # Supabase v2 : vérifier aussi le champ error de la réponse
        if hasattr(res, "error") and res.error:
            raise Exception(str(res.error))
    except Exception as e:
        err_str = str(e).lower()
        # Conflit d'email unique (compte email existant avec la même adresse)
        if "unique" in err_str or "duplicate" in err_str or "23505" in err_str:
            # Utiliser un email synthétique pour cet identifiant Google
            synthetic_email = f"_{user_id}@auth.klientys.internal"
            try:
                supabase.table("app_user").upsert(
                    {"id": user_id, "email": synthetic_email, "first_name": first_name, "last_name": last_name},
                    on_conflict="id",
                ).execute()
                _log.warning("Email conflict for user %s — using synthetic email", user_id)
            except Exception as e2:
                raise HTTPException(status_code=500, detail=f"Erreur création app_user: {e2}")
        else:
            raise HTTPException(status_code=500, detail=f"Erreur création app_user: {e}")


@router.post("/setup")
async def setup_tenant(body: TenantSetupIn, user: dict = Depends(get_current_user)):
    """Crée le tenant et tout ce qui va avec. Idempotent."""
    supabase = get_supabase_admin()
    user_id = user["sub"]
    email = user.get("email", "") or ""

    # Idempotent : l'utilisateur a déjà un tenant
    already = (
        supabase.table("membership")
        .select("tenant_id, tenant:tenant_id(id, slug)")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if already.data:
        row = already.data[0]
        # S'assurer que app_user existe (rattrapage si création précédente incomplète)
        _upsert_app_user(supabase, user_id, email, body.first_name, body.last_name)
        existing_slug = row["tenant"]["slug"] if row.get("tenant") else body.tenant_slug
        return {"tenant_id": row["tenant_id"], "slug": existing_slug}

    # Vérifier que le slug est disponible
    existing = supabase.table("tenant").select("id").eq("slug", body.tenant_slug).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Ce slug est déjà pris. Choisissez-en un autre.")

    # Créer le tenant
    try:
        tenant_res = supabase.table("tenant").insert({
            "name": body.tenant_name,
            "slug": body.tenant_slug,
            "sector": body.sector,
            "country": body.country,
        }).execute()
        if not tenant_res.data:
            raise Exception("Aucune donnée retournée")
        tenant = tenant_res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur création tenant: {e}")
    tenant_id = tenant["id"]

    # Créer app_user (gère les conflits d'email)
    _upsert_app_user(supabase, user_id, email, body.first_name, body.last_name)

    # Créer le membership owner
    try:
        mem_res = supabase.table("membership").insert({
            "tenant_id": tenant_id,
            "user_id": user_id,
            "role": "owner",
        }).execute()
        if hasattr(mem_res, "error") and mem_res.error:
            raise Exception(str(mem_res.error))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur création membership: {e}")

    # Créer calendrier, pipeline, site, agents IA
    await provision_tenant(tenant_id, user_id, body.tenant_name)

    # Injecter tenant_id dans app_metadata du JWT
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
