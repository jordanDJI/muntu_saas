"""
Remontée des erreurs JavaScript du frontend (KLT-1931).

Le frontend n'embarque pas de SDK Sentry : components/ErrorReporter.tsx envoie
ici les erreurs non interceptées, que le backend journalise et transmet à Sentry
s'il est configuré. Rien d'identifiant : ni cookie, ni utilisateur, ni query
string — le chemin de la page suffit à reproduire.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.core.config import settings
from app.middleware.rate_limit import check_rate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/client-errors", tags=["Monitoring"])


class ClientErrorIn(BaseModel):
    message: str = Field(max_length=500)
    stack: Optional[str] = Field(default=None, max_length=4000)
    path: Optional[str] = Field(default=None, max_length=300)
    source: Optional[str] = Field(default=None, max_length=40)   # "site" | "dashboard" | "widget" | "admin"
    release: Optional[str] = Field(default=None, max_length=60)


@router.post("", status_code=204)
async def report_client_error(body: ClientErrorIn, request: Request):
    # Une boucle d'erreurs dans un onglet ne doit pas inonder les logs.
    check_rate(request, "client_error", max_calls=20, window_seconds=300)
    path = (body.path or "").split("?", 1)[0].split("#", 1)[0]
    logger.warning("Erreur frontend [%s] %s — %s", body.source or "?", path, body.message)
    if settings.sentry_dsn:
        import sentry_sdk
        with sentry_sdk.new_scope() as scope:
            scope.set_tag("origin", "frontend")
            scope.set_tag("frontend_source", body.source or "unknown")
            scope.set_context("frontend", {"path": path, "stack": body.stack, "release": body.release})
            sentry_sdk.capture_message(f"[frontend] {body.message}", level="error")
