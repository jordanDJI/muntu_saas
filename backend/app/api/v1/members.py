"""
Gestion des membres d'équipe (multi-tenant).

Routes :
  GET    /api/v1/members/                        → liste membres + invitations en attente
  POST   /api/v1/members/invite                  → inviter par email
  DELETE /api/v1/members/invite/{invite_id}      → annuler une invitation
  GET    /api/v1/members/invite/{token}          → valider un token (public)
  POST   /api/v1/members/invite/{token}/accept   → accepter l'invitation (auth requise)
  GET    /api/v1/members/me/role                 → rôle du user courant
  PATCH  /api/v1/members/{user_id}/role          → changer le rôle (owner uniquement)
  DELETE /api/v1/members/{user_id}               → retirer un membre
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from app.core.config import settings
from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant, get_current_user
from app.services.email import send_team_invite

router = APIRouter(prefix="/members", tags=["members"])
logger = logging.getLogger(__name__)

_VALID_ROLES = {"owner", "admin", "member"}


class InviteIn(BaseModel):
    email: EmailStr
    role: str = "member"


class RoleUpdate(BaseModel):
    role: str


# ── GET /members/ ─────────────────────────────────────────────────────────────

@router.get("/")
async def list_members(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()

    mem_res = (
        sb.table("membership")
        .select("id, user_id, role")
        .eq("tenant_id", tenant_id)
        .execute()
    )
    members = []
    for m in (mem_res.data or []):
        email, first_name, last_name = "", "", ""
        try:
            resp = sb.auth.admin.get_user_by_id(m["user_id"])
            if resp.user:
                meta = resp.user.user_metadata or {}
                email = resp.user.email or ""
                first_name = meta.get("first_name", "")
                last_name = meta.get("last_name", "")
        except Exception:
            pass
        members.append({
            "id": m["id"],
            "user_id": m["user_id"],
            "role": m["role"],
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "status": "active",
        })

    inv_res = (
        sb.table("team_invite")
        .select("id, email, role, created_at, expires_at")
        .eq("tenant_id", tenant_id)
        .is_("accepted_at", "null")
        .execute()
    )
    pending = [
        {
            "id": i["id"],
            "email": i["email"],
            "role": i["role"],
            "created_at": i["created_at"],
            "expires_at": i["expires_at"],
            "status": "pending",
        }
        for i in (inv_res.data or [])
    ]

    return {"members": members, "pending": pending}


# ── GET /members/me/role ──────────────────────────────────────────────────────

@router.get("/me/role")
async def get_my_role(
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(get_current_user),
):
    sb = get_supabase_admin()
    return {"role": _get_role(sb, tenant_id, user["sub"])}


# ── POST /members/invite ──────────────────────────────────────────────────────

@router.post("/invite")
async def invite_member(
    body: InviteIn,
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(get_current_user),
):
    if body.role not in _VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Rôle invalide. Valeurs : {', '.join(_VALID_ROLES)}")

    sb = get_supabase_admin()
    my_role = _get_role(sb, tenant_id, user["sub"])
    if my_role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Seuls les propriétaires et admins peuvent inviter des membres.")

    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

    # Remplacer une invitation existante non acceptée pour ce même email
    sb.table("team_invite").delete().eq("tenant_id", tenant_id).eq("email", body.email).is_("accepted_at", "null").execute()

    sb.table("team_invite").insert({
        "tenant_id": tenant_id,
        "email": body.email,
        "role": body.role,
        "token": token,
        "invited_by": user["sub"],
        "expires_at": expires_at,
    }).execute()

    tenant_res = sb.table("tenant").select("name").eq("id", tenant_id).single().execute()
    tenant_name = (tenant_res.data or {}).get("name", "")

    base_url = settings.frontend_url_prod if settings.frontend_url_prod else settings.frontend_url
    invite_url = f"{base_url}/join?token={token}"
    email_sent = True
    try:
        send_team_invite(email=body.email, tenant_name=tenant_name, invite_url=invite_url, role=body.role)
    except Exception as exc:
        logger.warning("Invite email failed (domain not verified?): %s", exc)
        email_sent = False

    return {"status": "invited", "email": body.email, "invite_url": invite_url, "email_sent": email_sent}


# ── DELETE /members/invite/{invite_id} ────────────────────────────────────────

@router.delete("/invite/{invite_id}")
async def cancel_invite(
    invite_id: str,
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(get_current_user),
):
    sb = get_supabase_admin()
    my_role = _get_role(sb, tenant_id, user["sub"])
    if my_role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Accès refusé.")

    sb.table("team_invite").delete().eq("id", invite_id).eq("tenant_id", tenant_id).execute()
    return {"status": "cancelled"}


# ── GET /members/invite/{token} (public) ──────────────────────────────────────

@router.get("/invite/{token}")
async def get_invite(token: str):
    sb = get_supabase_admin()
    res = (
        sb.table("team_invite")
        .select("id, tenant_id, email, role, expires_at, accepted_at")
        .eq("token", token)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Invitation invalide ou expirée.")

    invite = res.data[0]
    if invite.get("accepted_at"):
        raise HTTPException(status_code=410, detail="Cette invitation a déjà été acceptée.")

    exp = datetime.fromisoformat(invite["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > exp:
        raise HTTPException(status_code=410, detail="Cette invitation a expiré.")

    tenant_res = sb.table("tenant").select("name").eq("id", invite["tenant_id"]).single().execute()
    tenant_name = (tenant_res.data or {}).get("name", "")

    return {"email": invite["email"], "role": invite["role"], "tenant_name": tenant_name}


# ── POST /members/invite/{token}/accept ───────────────────────────────────────

@router.post("/invite/{token}/accept")
async def accept_invite(
    token: str,
    user: dict = Depends(get_current_user),
):
    sb = get_supabase_admin()
    res = sb.table("team_invite").select("*").eq("token", token).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Invitation invalide.")

    invite = res.data[0]
    if invite.get("accepted_at"):
        raise HTTPException(status_code=410, detail="Invitation déjà acceptée.")

    exp = datetime.fromisoformat(invite["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > exp:
        raise HTTPException(status_code=410, detail="Invitation expirée.")

    if user.get("email", "").lower() != invite["email"].lower():
        raise HTTPException(status_code=403, detail="Cette invitation est destinée à une autre adresse email.")

    tenant_id = invite["tenant_id"]
    user_id = user["sub"]

    existing = (
        sb.table("membership")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("user_id", user_id)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="Vous êtes déjà membre de cet espace.")

    sb.table("membership").insert({
        "tenant_id": tenant_id,
        "user_id": user_id,
        "role": invite["role"],
    }).execute()

    # Mettre à jour l'app_metadata pour que le JWT inclut le tenant_id
    try:
        sb.auth.admin.update_user_by_id(user_id, {"app_metadata": {"tenant_id": tenant_id}})
    except Exception as exc:
        logger.warning("Failed to update app_metadata for user %s: %s", user_id, exc)

    sb.table("team_invite").update(
        {"accepted_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", invite["id"]).execute()

    return {"status": "accepted", "tenant_id": tenant_id}


# ── PATCH /members/{user_id}/role ─────────────────────────────────────────────

@router.patch("/{member_user_id}/role")
async def update_member_role(
    member_user_id: str,
    body: RoleUpdate,
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(get_current_user),
):
    if body.role not in _VALID_ROLES:
        raise HTTPException(status_code=400, detail="Rôle invalide.")

    sb = get_supabase_admin()
    my_role = _get_role(sb, tenant_id, user["sub"])
    if my_role != "owner":
        raise HTTPException(status_code=403, detail="Seul le propriétaire peut modifier les rôles.")

    if member_user_id == user["sub"]:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas modifier votre propre rôle.")

    res = (
        sb.table("membership")
        .update({"role": body.role})
        .eq("tenant_id", tenant_id)
        .eq("user_id", member_user_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Membre introuvable.")

    return {"status": "updated"}


# ── DELETE /members/{user_id} ─────────────────────────────────────────────────

@router.delete("/{member_user_id}")
async def remove_member(
    member_user_id: str,
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(get_current_user),
):
    sb = get_supabase_admin()
    my_role = _get_role(sb, tenant_id, user["sub"])
    if my_role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Seuls les propriétaires et admins peuvent retirer des membres.")

    if member_user_id == user["sub"]:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous retirer vous-même.")

    target_role = _get_role(sb, tenant_id, member_user_id)
    if target_role == "owner":
        raise HTTPException(status_code=403, detail="Le propriétaire ne peut pas être retiré.")

    sb.table("membership").delete().eq("tenant_id", tenant_id).eq("user_id", member_user_id).execute()
    return {"status": "removed"}


# ── Helper ────────────────────────────────────────────────────────────────────

def _get_role(sb, tenant_id: str, user_id: str) -> str:
    res = (
        sb.table("membership")
        .select("role")
        .eq("tenant_id", tenant_id)
        .eq("user_id", user_id)
        .execute()
    )
    return res.data[0]["role"] if res.data else "member"
