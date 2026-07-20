"""
Service Web Push — envoie des notifications push via VAPID.
Silencieux si VAPID_PRIVATE_KEY / VAPID_PUBLIC_KEY ne sont pas configurés.
"""
import json
import asyncio
import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


def _is_configured() -> bool:
    return bool(settings.vapid_private_key and settings.vapid_public_key)


def _load_private_key() -> str:
    """
    Accepte deux formats pour VAPID_PRIVATE_KEY :
    - base64url DER (une ligne, généré par le script de génération)
    - PEM multi-lignes (-----BEGIN EC PRIVATE KEY-----)
    Retourne toujours le PEM (ce que pywebpush attend).
    """
    key = settings.vapid_private_key
    if key.startswith("-----BEGIN"):
        return key
    # base64url DER → PEM
    import base64
    from cryptography.hazmat.primitives.serialization import (
        Encoding, PrivateFormat, NoEncryption, load_der_private_key,
    )
    der = base64.urlsafe_b64decode(key + "==")  # padding tolérant
    private_key = load_der_private_key(der, password=None)
    return private_key.private_bytes(Encoding.PEM, PrivateFormat.TraditionalOpenSSL, NoEncryption()).decode()


def _send_one(subscription: dict, payload: dict) -> None:
    """Appel pywebpush synchrone — à wrapper dans run_in_executor."""
    from pywebpush import webpush, WebPushException  # type: ignore
    webpush(
        subscription_info=subscription,
        data=json.dumps(payload),
        vapid_private_key=_load_private_key(),
        vapid_claims={"sub": settings.vapid_claims_email},
    )


async def send_push(subscription: dict, title: str, body: str, url: str = "", icon: str = "") -> bool:
    """Envoie une notification push à un abonnement donné. Retourne True si succès."""
    if not _is_configured():
        return False
    payload = {"title": title, "body": body, "url": url, "icon": icon or "/icon-192.png"}
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send_one, subscription, payload)
        return True
    except Exception as exc:
        logger.warning("Push failed: %s", exc)
        return False


async def send_push_to_tenant(sb: Any, tenant_id: str, title: str, body: str, url: str = "") -> int:
    """Envoie à tous les utilisateurs abonnés d'un tenant. Retourne le nb de succès."""
    if not _is_configured():
        return 0
    rows = (
        sb.table("push_subscription")
        .select("subscription")
        .eq("tenant_id", tenant_id)
        .execute()
    ).data or []
    count = 0
    tasks = [send_push(r["subscription"], title, body, url) for r in rows]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    count = sum(1 for r in results if r is True)
    return count


async def send_push_to_contact(sb: Any, contact_id: str, title: str, body: str, url: str = "") -> bool:
    """Envoie à l'abonnement push d'un contact (site public)."""
    if not _is_configured():
        return False
    row = (
        sb.table("contact_push_subscription")
        .select("subscription")
        .eq("contact_id", contact_id)
        .limit(1)
        .execute()
    ).data
    if not row:
        return False
    return await send_push(row[0]["subscription"], title, body, url)
