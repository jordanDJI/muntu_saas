"""
Google Indexing API — notifie Google lors de la publication / dépublication d'un site tenant.
Requiert un service account Google avec permission "Owner" dans Google Search Console.
Variable d'env : GOOGLE_SERVICE_ACCOUNT_JSON (contenu JSON stringifié du fichier de clé).
"""

import json
import logging

import httpx
from google.oauth2 import service_account
import google.auth.transport.requests

from app.core.config import settings

logger = logging.getLogger(__name__)

_SCOPES = ["https://www.googleapis.com/auth/indexing"]
_ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish"


def _get_token() -> str | None:
    raw = settings.google_service_account_json.strip()
    if not raw:
        return None
    creds_dict = json.loads(raw)
    credentials = service_account.Credentials.from_service_account_info(
        creds_dict, scopes=_SCOPES
    )
    credentials.refresh(google.auth.transport.requests.Request())
    return credentials.token


async def notify_url_updated(url: str) -> None:
    await _notify(url, "URL_UPDATED")


async def notify_url_deleted(url: str) -> None:
    await _notify(url, "URL_DELETED")


async def _notify(url: str, notification_type: str) -> None:
    token = _get_token()
    if not token:
        logger.debug("Google Indexing API non configuré (GOOGLE_SERVICE_ACCOUNT_JSON vide).")
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                _ENDPOINT,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"url": url, "type": notification_type},
            )
            resp.raise_for_status()
            logger.info("Google Indexing API: %s → %s", notification_type, url)
    except Exception as exc:
        logger.warning("Google Indexing API error pour %s: %s", url, exc)
