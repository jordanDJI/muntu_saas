"""Client 360dialog pour l'envoi de messages WhatsApp (format Meta Cloud API compatible)."""
import hashlib
import hmac
import logging

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

_BASE = "https://waba.360dialog.io/v1"


def _headers() -> dict:
    return {
        "D360-API-KEY": settings.dialog360_api_key,
        "Content-Type": "application/json",
    }


def send_text(to: str, text: str) -> bool:
    """Envoie un message texte WhatsApp. Retourne True si succès."""
    if not settings.dialog360_api_key:
        logger.warning("DIALOG360_API_KEY non configurée — message non envoyé vers %s", to)
        return False
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {"preview_url": False, "body": text},
    }
    try:
        r = requests.post(f"{_BASE}/messages", json=payload, headers=_headers(), timeout=10)
        r.raise_for_status()
        return True
    except Exception as exc:
        logger.error("WhatsApp send_text vers %s échoué : %s", to, exc)
        return False


def download_media(media_id: str) -> tuple[bytes, str]:
    """Télécharge un média WhatsApp (image ou document) via l'API 360dialog."""
    headers = {"D360-API-KEY": settings.dialog360_api_key}
    url_res = requests.get(f"{_BASE}/media/{media_id}", headers=headers, timeout=15)
    url_res.raise_for_status()
    media_url = url_res.json().get("url", "")
    if not media_url:
        raise ValueError(f"URL introuvable pour le média {media_id}")
    media_res = requests.get(media_url, headers=headers, timeout=30)
    media_res.raise_for_status()
    return media_res.content, media_res.headers.get("content-type", "image/jpeg")


def verify_signature(payload: bytes, signature: str) -> bool:
    """Vérifie la signature HMAC-SHA256 envoyée par 360dialog sur le webhook."""
    if not settings.dialog360_webhook_secret:
        return True  # Pas de secret configuré — mode développement
    expected = "sha256=" + hmac.new(
        settings.dialog360_webhook_secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
