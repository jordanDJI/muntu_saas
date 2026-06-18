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

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from app.core.config import settings
from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant, get_current_user
from app.services.email import send_team_invite
from app.services.activity import log_activity

router = APIRouter(prefix="/members", tags=["members"])
logger = logging.getLogger(__name__)

_VALID_ROLES = {"owner", "admin", "member", "secretary"}
_ALL_PERMISSIONS = ["crm", "calendar", "site_builder", "analytics", "agents"]


class InviteIn(BaseModel):
    email: EmailStr
    role: str = "member"
    permissions: list[str] = _ALL_PERMISSIONS


class RoleUpdate(BaseModel):
    role: str


class PermissionsUpdate(BaseModel):
    permissions: list[str]


class SignupViaInviteIn(BaseModel):
    password: str


# ── GET /members/ ─────────────────────────────────────────────────────────────

@router.get("/")
async def list_members(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()

    mem_res = (
        sb.table("membership")
        .select("id, user_id, role, permissions")
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
            "permissions": m.get("permissions") or _ALL_PERMISSIONS,
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


# ── GET /members/me/permissions ───────────────────────────────────────────────

@router.get("/me/permissions")
async def get_my_permissions(
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(get_current_user),
):
    sb = get_supabase_admin()
    res = (
        sb.table("membership")
        .select("role, permissions")
        .eq("tenant_id", tenant_id)
        .eq("user_id", user["sub"])
        .execute()
    )
    if not res.data:
        return {"role": "member", "permissions": _ALL_PERMISSIONS}
    row = res.data[0]
    role = row["role"]
    # owner et admin ont toujours toutes les permissions
    if role in ("owner", "admin"):
        return {"role": role, "permissions": _ALL_PERMISSIONS}
    return {"role": role, "permissions": row.get("permissions") or _ALL_PERMISSIONS}


# ── POST /members/invite ──────────────────────────────────────────────────────

@router.post("/invite")
async def invite_member(
    body: InviteIn,
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(get_current_user),
):
    if body.role not in _VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Rôle invalide. Valeurs : {', '.join(_VALID_ROLES)}")

    # Valider les permissions
    perms = [p for p in body.permissions if p in _ALL_PERMISSIONS]
    # owner/admin/secretary ont toujours toutes les permissions — ignorer les perms pour ces rôles
    if body.role in ("owner", "admin", "secretary"):
        perms = _ALL_PERMISSIONS

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
        "permissions": perms,
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

    log_activity(tenant_id, user["sub"], "Membre invité", f"{body.email} ({body.role})")
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

    perms = invite.get("permissions") or _ALL_PERMISSIONS
    sb.table("membership").insert({
        "tenant_id": tenant_id,
        "user_id": user_id,
        "role": invite["role"],
        "permissions": perms,
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


def _ensure_app_user(sb, user_id: str, email: str) -> None:
    """Insère dans app_user si absent. Gère le conflit d'email et les erreurs silencieuses."""
    # 1. Vérifier si l'entrée existe déjà
    existing = sb.table("app_user").select("id").eq("id", user_id).execute()
    if existing.data:
        return

    def _insert(mail: str) -> None:
        try:
            # returning="representation" pour détecter les échecs silencieux (supabase-py v2)
            res = sb.table("app_user").insert({"id": user_id, "email": mail, "first_name": "", "last_name": ""}, returning="representation").execute()
            if hasattr(res, "error") and res.error:
                raise Exception(str(res.error))
            # Vérifier que la ligne a bien été insérée
            if not res.data:
                raise Exception(f"INSERT app_user returned empty data for user {user_id}")
        except Exception as e:
            err_str = str(e).lower()
            if "unique" in err_str or "duplicate" in err_str or "23505" in err_str:
                if mail == email:
                    # Email déjà pris par un autre id → email synthétique
                    synthetic = f"_{user_id}@auth.klientys.internal"
                    logger.warning("app_user email conflict for %s — using synthetic email", user_id)
                    _insert(synthetic)
                else:
                    logger.error("app_user synthetic email also conflicts for %s: %s", user_id, e)
                    raise
            else:
                logger.error("app_user insert failed for %s (email=%s): %s", user_id, mail, e)
                raise

    _insert(email)

    # 2. Double-vérification post-insertion
    check = sb.table("app_user").select("id").eq("id", user_id).execute()
    if not check.data:
        raise Exception(f"app_user row not found after insert for user {user_id}")


# ── POST /members/invite/{token}/signup ───────────────────────────────────────
# Crée un compte directement via l'Admin API (email_confirm: true) sans passer
# par le flow PKCE Supabase — évite les échecs cross-browser / webview email.

@router.post("/invite/{token}/signup")
async def signup_via_invite(token: str, body: SignupViaInviteIn):
    sb = get_supabase_admin()

    # Valider l'invite
    res = sb.table("team_invite").select("*").eq("token", token).execute()
    if not res.data:
        raise HTTPException(404, "Invitation invalide.")
    invite = res.data[0]
    if invite.get("accepted_at"):
        raise HTTPException(410, "Cette invitation a déjà été acceptée.")
    exp = datetime.fromisoformat(invite["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > exp:
        raise HTTPException(410, "Cette invitation a expiré.")

    email = invite["email"]
    tenant_id = invite["tenant_id"]
    admin_headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        # Tenter de créer l'utilisateur (email auto-confirmé)
        r = await client.post(
            f"{settings.supabase_url}/auth/v1/admin/users",
            json={"email": email, "password": body.password, "email_confirm": True},
            headers=admin_headers,
        )

        if r.status_code in (200, 201):
            user_id = r.json()["id"]
        elif r.status_code == 422:
            # Utilisateur existant — chercher son id et confirmer l'email si besoin
            r2 = await client.get(
                f"{settings.supabase_url}/auth/v1/admin/users?email={email}",
                headers=admin_headers,
            )
            users = (r2.json() if r2.status_code == 200 else {}).get("users", [])
            if not users:
                raise HTTPException(409, "Un compte existe déjà avec cet email. Utilisez l'onglet \"J'ai un compte\".")
            existing = users[0]
            user_id = existing["id"]
            # Confirmer si l'email n'est pas encore vérifié
            if not existing.get("email_confirmed_at"):
                await client.put(
                    f"{settings.supabase_url}/auth/v1/admin/users/{user_id}",
                    json={"email_confirm": True},
                    headers=admin_headers,
                )
        else:
            raise HTTPException(500, "Erreur lors de la création du compte.")

    # Garantir que app_user existe — l'Admin API crée auth.users mais pas app_user
    # (app_user est normalement rempli par onboarding.py, pas par trigger)
    _ensure_app_user(sb, user_id, email)

    # Créer le membership si absent
    existing_mem = sb.table("membership").select("id").eq("tenant_id", tenant_id).eq("user_id", user_id).execute()
    if not existing_mem.data:
        perms = invite.get("permissions") or _ALL_PERMISSIONS
        sb.table("membership").insert({"tenant_id": tenant_id, "user_id": user_id, "role": invite["role"], "permissions": perms}).execute()

    # Marquer l'invite acceptée
    sb.table("team_invite").update(
        {"accepted_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", invite["id"]).execute()

    return {"status": "created", "email": email}


# ── PATCH /members/{user_id}/permissions ─────────────────────────────────────

@router.patch("/{member_user_id}/permissions")
async def update_member_permissions(
    member_user_id: str,
    body: PermissionsUpdate,
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(get_current_user),
):
    sb = get_supabase_admin()
    my_role = _get_role(sb, tenant_id, user["sub"])
    if my_role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Seuls les propriétaires et admins peuvent modifier les permissions.")

    if member_user_id == user["sub"]:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas modifier vos propres permissions.")

    perms = [p for p in body.permissions if p in _ALL_PERMISSIONS]
    res = (
        sb.table("membership")
        .update({"permissions": perms})
        .eq("tenant_id", tenant_id)
        .eq("user_id", member_user_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Membre introuvable.")

    return {"status": "updated", "permissions": perms}


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
    log_activity(tenant_id, user["sub"], "Membre retiré", member_user_id)
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
