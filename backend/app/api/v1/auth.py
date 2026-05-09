from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant

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
        return TokenOut(
            access_token=resp.session.access_token,
            refresh_token=resp.session.refresh_token,
        )
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


@router.get("/me/tenant")
async def get_my_tenant(tenant_id: str = Depends(get_current_tenant)):
    """Retourne le slug et le nom du tenant courant — utilisé par le dashboard."""
    sb = get_supabase_admin()
    res = sb.table("tenant").select("id, slug, name").eq("id", tenant_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    return res.data
