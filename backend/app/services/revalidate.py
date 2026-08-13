"""
Déclenche une revalidation à la demande du cache Next.js frontend (fetch cache /
ISR) quand un article de blog est créé, publié, modifié ou supprimé — pour éviter
de servir une réponse "introuvable" mise en cache depuis avant la publication
(fenêtre de cache par défaut : 1h, voir `next: { revalidate: 3600 }` côté frontend).
Variable d'env : REVALIDATE_SECRET (à définir identiquement côté backend ET frontend).
"""

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


async def revalidate_frontend_path(path: str) -> None:
    if not settings.revalidate_secret:
        logger.debug("Revalidation frontend non configurée (REVALIDATE_SECRET vide).")
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{settings.frontend_url}/api/revalidate",
                headers={
                    "X-Revalidate-Secret": settings.revalidate_secret,
                    "Content-Type": "application/json",
                },
                json={"path": path},
            )
            resp.raise_for_status()
            logger.info("Revalidation frontend déclenchée pour %s", path)
    except Exception as exc:
        logger.warning("Revalidation frontend échouée pour %s: %s", path, exc)
