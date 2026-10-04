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
