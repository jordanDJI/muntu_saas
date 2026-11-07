"""
Chiffrement applicatif des secrets tenant et des données de santé.

Concerne : site.paypal_client_secret, google_analytics_connection.access_token /
refresh_token, agent_config.telegram_bot_token, ocr_summary.summary_encrypted.

Une valeur chiffrée porte le préfixe « enc:v1: » suivi d'un jeton Fernet
(AES-128-CBC + HMAC-SHA256). La lecture est tolérante : une valeur sans préfixe
est renvoyée telle quelle, ce qui permet de déployer avant d'avoir migré les
lignes existantes (scripts/encrypt_existing_secrets.py).

Sans DATA_ENCRYPTION_KEY, `encrypt` refuse en production et laisse passer en
clair ailleurs (avec un avertissement), pour ne pas bloquer le développement local.
"""
import hashlib
import logging
from functools import lru_cache
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from app.core.config import settings

logger = logging.getLogger(__name__)

PREFIX = "enc:v1:"


class EncryptionUnavailable(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _fernet() -> Optional[MultiFernet]:
    keys = [k.strip() for k in (settings.data_encryption_key, settings.data_encryption_key_previous) if k.strip()]
    if not keys:
        return None
    return MultiFernet([Fernet(k.encode()) for k in keys])


def is_encrypted(value: Optional[str]) -> bool:
    return isinstance(value, str) and value.startswith(PREFIX)


def encrypt(value: Optional[str]) -> Optional[str]:
    """Chiffre une chaîne. None et chaîne vide sont renvoyés tels quels."""
    if not value or is_encrypted(value):
        return value
    f = _fernet()
    if f is None:
        if settings.app_env == "production":
            raise EncryptionUnavailable("DATA_ENCRYPTION_KEY absente : refus d'écrire un secret en clair")
        logger.warning("DATA_ENCRYPTION_KEY absente — secret écrit en clair (app_env=%s)", settings.app_env)
        return value
    return PREFIX + f.encrypt(value.encode()).decode()


def decrypt(value: Optional[str]) -> Optional[str]:
    """Déchiffre une valeur « enc:v1: » ; renvoie une valeur en clair inchangée."""
    if not is_encrypted(value):
        return value
    f = _fernet()
    if f is None:
        raise EncryptionUnavailable("DATA_ENCRYPTION_KEY absente : impossible de lire une valeur chiffrée")
    try:
        return f.decrypt(value[len(PREFIX):].encode()).decode()
    except InvalidToken:
        logger.error("Valeur chiffrée illisible (clé changée sans DATA_ENCRYPTION_KEY_PREVIOUS ?)")
        raise


def rotate(value: Optional[str]) -> Optional[str]:
    """Rechiffre avec la clé courante (valeur claire ou chiffrée par l'ancienne clé)."""
    if not value:
        return value
    f = _fernet()
    if f is None:
        raise EncryptionUnavailable("DATA_ENCRYPTION_KEY absente")
    if is_encrypted(value):
        return PREFIX + f.rotate(value[len(PREFIX):].encode()).decode()
    return encrypt(value)


def lookup_hash(value: str) -> str:
    """Empreinte déterministe pour retrouver une ligne par un secret chiffré
    (le chiffrement Fernet n'est pas déterministe). Réservée à des secrets à
    forte entropie, comme un jeton de bot Telegram."""
    return hashlib.sha256(value.encode()).hexdigest()
