"""
Contrôle du rôle de l'utilisateur DANS le tenant courant.

À ne pas confondre avec `middleware/admin.py`, qui gère les niveaux de
l'opérateur SaaS (viewer / support / super_admin).

Motivation : `get_current_tenant()` ne valide que l'EXISTENCE d'un
membership, jamais son rôle. Les opérations sensibles — facturation,
achats, credentials de paiement — étaient donc accessibles à n'importe
quel membre, le garde-fou n'existant que côté frontend
(`OWNER_ONLY_SECTIONS` dans dashboard/settings).

Usage : remplacer `Depends(get_current_tenant)` par
`Depends(require_owner_or_admin)` — la dépendance renvoie le même
tenant_id, le diff reste donc minimal.
"""
from fastapi import Depends, HTTPException, status

from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant, get_current_user

# Rôles autorisés à gérer la facturation et les moyens de paiement
BILLING_ROLES: frozenset = frozenset({"owner", "admin"})


def get_membership_role(tenant_id: str, user_id: str) -> str | None:
    """Rôle de l'utilisateur dans ce tenant, ou None s'il n'est pas membre."""
    res = (
        get_supabase_admin()
        .table("membership")
        .select("role")
        .eq("tenant_id", tenant_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return res.data[0]["role"] if res.data else None


def require_tenant_role(*allowed: str):
    """
    Factory de dépendances FastAPI. Renvoie le tenant_id, comme
    get_current_tenant, mais refuse si le rôle n'est pas dans `allowed`.

    La requête membership est volontairement refaite ici : le fallback
    `app_metadata.tenant_id` de get_current_tenant ne vérifie aucun
    membership, un JWT encore valide après retrait d'un membre pourrait
    donc passer. Repartir de la base ferme ce trou.
    """
    allowed_set = frozenset(allowed)

    async def dep(
        tenant_id: str = Depends(get_current_tenant),
        user: dict = Depends(get_current_user),
    ) -> str:
        role = get_membership_role(tenant_id, user["sub"])
        if role is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vous n'êtes pas membre de cet espace.",
            )
        if role not in allowed_set:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Action réservée au propriétaire et aux administrateurs de l'espace.",
            )
        return tenant_id

    return dep


# ── Shortcut utilisé par les routes de facturation ───────────────────────────
require_owner_or_admin = require_tenant_role("owner", "admin")


# ── Permissions granulaires (rôle member) ────────────────────────────────────
# Même catalogue que members.py (_ALL_PERMISSIONS) — dupliqué ici pour éviter un
# import circulaire (members.py importe déjà get_current_tenant de ce module).
ALL_PERMISSIONS: list[str] = ["crm", "calendar", "site_builder", "analytics", "agents"]


def require_permission(permission: str):
    """
    Factory de dépendances : renvoie tenant_id comme get_current_tenant, mais
    refuse 403 si le membre (rôle `member`) n'a pas cette permission.

    owner/admin/secretary passent toujours — members.py les traite déjà comme
    ayant systématiquement toutes les permissions (perms ignorées à l'invitation
    comme à l'édition pour ces rôles), ce garde-fou API suit la même règle.

    Avant cette dépendance, `membership.permissions` n'était vérifié que côté
    frontend (masquage de nav) : un member explicitement privé d'un accès via
    Settings → Membres pouvait quand même appeler l'API directement.
    """
    async def dep(
        tenant_id: str = Depends(get_current_tenant),
        user: dict = Depends(get_current_user),
    ) -> str:
        res = (
            get_supabase_admin()
            .table("membership")
            .select("role, permissions")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user["sub"])
            .limit(1)
            .execute()
        )
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vous n'êtes pas membre de cet espace.",
            )
        row = res.data[0]
        if row["role"] in ("owner", "admin", "secretary"):
            return tenant_id
        perms = row.get("permissions")
        if perms is None:
            perms = ALL_PERMISSIONS  # défaut historique : tout activé
        if permission not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Votre rôle ne donne pas accès à cette fonctionnalité.",
            )
        return tenant_id

    return dep


require_crm_access = require_permission("crm")
require_calendar_access = require_permission("calendar")
require_site_builder_access = require_permission("site_builder")
require_analytics_access = require_permission("analytics")
require_agents_access = require_permission("agents")
