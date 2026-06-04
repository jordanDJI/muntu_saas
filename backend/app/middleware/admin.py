from fastapi import Depends, HTTPException, status
from app.middleware.tenant import get_current_user

# Niveaux d'accès (valeur croissante = plus de droits)
SUPPORT_LEVELS: dict[str, int] = {"viewer": 1, "support": 2, "super_admin": 3}


def _user_level(user: dict) -> int:
    meta = user.get("app_metadata", {})
    if meta.get("is_super_admin"):
        return 3
    return SUPPORT_LEVELS.get(meta.get("support_role", ""), 0)


def require_level(min_level: str):
    """
    Factory de dépendances FastAPI.

    Niveaux :
      viewer      — lecture seule (L1)
      support     — actions safe : email, mot de passe, trial, cache, domaine, Stripe (L2)
      super_admin — accès total : impersonate, suspension, suppression, config (L3)
    """
    required = SUPPORT_LEVELS.get(min_level, 3)

    async def dep(user: dict = Depends(get_current_user)) -> dict:
        level = _user_level(user)
        if level < required:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Accès insuffisant pour cette opération.",
            )
        return {**user, "_level": level}

    return dep


# ── Shortcuts utilisés dans les routes ───────────────────────────────────────

get_current_admin = require_level("super_admin")   # rétrocompat — tous les anciens Depends(get_current_admin)
viewer_or_above   = require_level("viewer")
support_or_above  = require_level("support")
super_admin_only  = require_level("super_admin")
