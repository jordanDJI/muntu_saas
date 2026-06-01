from fastapi import Depends, HTTPException, status
from app.middleware.tenant import get_current_user


async def get_current_admin(user: dict = Depends(get_current_user)) -> dict:
    """Vérifie que l'utilisateur courant est super_admin (app_metadata.is_super_admin = true)."""
    if not user.get("app_metadata", {}).get("is_super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs Klientys",
        )
    return user
