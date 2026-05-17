from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant, get_current_user
from app.services.activity import log_activity

router = APIRouter(prefix="/auth", tags=["Auth"])


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshIn(BaseModel):
    refresh_token: str


@router.post("/login", response_model=TokenOut)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Connexion via email/password — retourne access_token + refresh_token."""
    supabase = get_supabase_admin()
    try:
        resp = supabase.auth.sign_in_with_password({
            "email": form_data.username,
            "password": form_data.password,
        })
        if not resp.session:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants incorrects")
        token_out = TokenOut(
            access_token=resp.session.access_token,
            refresh_token=resp.session.refresh_token,
        )
        try:
            user_id = resp.session.user.id
            sb = get_supabase_admin()
            mem = sb.table("membership").select("tenant_id").eq("user_id", user_id).limit(1).execute()
            if mem.data:
                log_activity(mem.data[0]["tenant_id"], user_id, "Connexion", "Via email/mot de passe")
        except Exception:
            pass
        return token_out
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants incorrects")


@router.post("/refresh", response_model=TokenOut)
async def refresh_token(body: RefreshIn):
    """Renouvelle l'access_token à partir du refresh_token."""
    supabase = get_supabase_admin()
    try:
        resp = supabase.auth.refresh_session(body.refresh_token)
        if not resp.session:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session invalide")
        return TokenOut(
            access_token=resp.session.access_token,
            refresh_token=resp.session.refresh_token,
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session invalide ou expirée")


@router.post("/ensure-profile")
async def ensure_profile(user: dict = Depends(get_current_user)):
    """Crée ou met à jour app_user depuis les métadonnées Supabase Auth (utile après Google OAuth)."""
    import httpx
    from app.core.config import settings

    user_id = user["sub"]
    email = user.get("email", "")
    sb = get_supabase_admin()

    # Récupérer user_metadata depuis l'Admin API (contient les données Google)
    first_name, last_name = "", ""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.supabase_url}/auth/v1/admin/users/{user_id}",
                headers={
                    "apikey": settings.supabase_service_role_key,
                    "Authorization": f"Bearer {settings.supabase_service_role_key}",
                },
            )
            if resp.status_code == 200:
                meta = resp.json().get("user_metadata", {})
                full_name = meta.get("full_name") or meta.get("name") or ""
                parts = full_name.strip().split(" ", 1)
                first_name = parts[0] if parts else ""
                last_name = parts[1] if len(parts) > 1 else ""
    except Exception:
        pass

    sb.table("app_user").upsert(
        {"id": user_id, "email": email, "first_name": first_name, "last_name": last_name},
        on_conflict="id",
    ).execute()

    return {"ok": True}


@router.get("/me/tenant")
async def get_my_tenant(tenant_id: str = Depends(get_current_tenant)):
    """Retourne le slug et le nom du tenant courant — utilisé par le dashboard."""
    sb = get_supabase_admin()
    res = sb.table("tenant").select("id, slug, name").eq("id", tenant_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    return res.data


@router.get("/me/tenants")
async def get_my_tenants(user: dict = Depends(get_current_user)):
    """Retourne tous les tenants auxquels l'utilisateur appartient."""
    user_id = user.get("sub")
    sb = get_supabase_admin()
    res = (
        sb.table("membership")
        .select("role, tenant:tenant_id(id, slug, name)")
        .eq("user_id", user_id)
        .execute()
    )
    tenants = []
    for row in res.data or []:
        tenant = row.get("tenant") or {}
        if tenant:
            tenants.append({
                "id": tenant["id"],
                "slug": tenant["slug"],
                "name": tenant["name"],
                "role": row["role"],
            })
    return tenants
