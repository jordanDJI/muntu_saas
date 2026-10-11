"""
Rate limiter.

Deux backends :
- **mémoire** (défaut) : suffisant en dev et sur un process unique, mais le
  compteur est local — avec plusieurs workers ou instances, un attaquant
  obtient le quota multiplié par le nombre de process, et chaque déploiement
  remet les compteurs à zéro ;
- **Redis** (si REDIS_URL est configuré) : compteur partagé, donc quota réel.
  Utilisé par les endpoints de paiement via `check_rate_async`.

Le repli est volontaire : une panne Redis ne doit pas rendre la réservation
publique indisponible, elle dégrade seulement la précision du quota.
"""
import logging
import time
from collections import defaultdict

from fastapi import HTTPException, Request

from app.core.config import settings

logger = logging.getLogger(__name__)

_buckets: dict[str, list[float]] = defaultdict(list)

_TOO_MANY = "Trop de requêtes. Veuillez patienter avant de réessayer."

# Client Redis résolu paresseusement : None = non tenté, False = indisponible
_redis_client = None


def _client_ip(request: Request) -> str:
    """
    IP de l'appelant, en tenant compte du proxy.

    Derrière Vercel/Railway, request.client.host est l'IP du reverse proxy :
    sans lire X-Forwarded-For, tous les visiteurs partageaient un seul quota.

    Un reverse proxy conforme (Railway/Vercel inclus) AJOUTE l'IP du client
    qu'il reçoit à la fin de la chaîne — il ne la préfixe jamais. La **dernière**
    valeur est donc toujours celle vue par notre unique proxy de confiance ;
    tout ce qui précède peut être fourni par l'appelant lui-même (un client
    envoyant "1.2.3.4" dans son propre header se faisait passer pour cette IP
    et contournait entièrement le rate limiting en la changeant à chaque appel).
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            return parts[-1]
    return request.client.host if request.client else "unknown"


def _memory_allows(bucket: str, max_calls: int, window_seconds: int) -> bool:
    now = time.time()
    _buckets[bucket] = [t for t in _buckets[bucket] if now - t < window_seconds]
    if len(_buckets[bucket]) >= max_calls:
        return False
    _buckets[bucket].append(now)
    return True


async def _get_redis():
    """Client redis.asyncio partagé, ou None si indisponible."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client or None

    url = getattr(settings, "redis_url", "") or ""
    if not url:
        _redis_client = False
        return None

    try:
        from redis import asyncio as aioredis  # dépendance optionnelle
        _redis_client = aioredis.from_url(url, socket_timeout=1, socket_connect_timeout=1)
        await _redis_client.ping()
        logger.info("Rate limiter: backend Redis actif")
        return _redis_client
    except Exception as exc:
        logger.warning("Rate limiter: Redis indisponible (%s) — repli mémoire", exc)
        _redis_client = False
        return None


async def _redis_allows(client, bucket: str, max_calls: int, window_seconds: int) -> bool:
    """
    Fenêtre glissante approximée par compteur à expiration.

    INCR puis EXPIRE sur la première occurrence : simple, atomique côté Redis,
    et suffisant pour de l'anti-abus (la fenêtre se réinitialise d'un bloc au
    lieu de glisser, ce qui est acceptable ici).
    """
    try:
        count = await client.incr(bucket)
        if count == 1:
            await client.expire(bucket, window_seconds)
        return count <= max_calls
    except Exception as exc:
        logger.warning("Rate limiter: erreur Redis (%s) — repli mémoire", exc)
        return _memory_allows(bucket, max_calls, window_seconds)


# ── API synchrone (compteur local) ───────────────────────────────────────────

def check_rate(request: Request, key: str, max_calls: int, window_seconds: int) -> None:
    """Lève HTTP 429 si l'IP dépasse max_calls requêtes dans window_seconds."""
    if not _memory_allows(f"{_client_ip(request)}:{key}", max_calls, window_seconds):
        raise HTTPException(status_code=429, detail=_TOO_MANY)


def check_rate_by_key(identifier: str, key: str, max_calls: int, window_seconds: int) -> None:
    """Lève HTTP 429 si l'identifiant (user_id, email…) dépasse max_calls."""
    if not _memory_allows(f"{identifier}:{key}", max_calls, window_seconds):
        raise HTTPException(status_code=429, detail="Limite atteinte. Réessaie dans quelques minutes.")


# ── API asynchrone (compteur partagé si Redis configuré) ─────────────────────

async def check_rate_async(request: Request, key: str, max_calls: int, window_seconds: int) -> None:
    """
    Variante partagée entre instances, à utiliser sur les endpoints de paiement.

    Sans REDIS_URL, le comportement est identique à `check_rate`.
    """
    bucket = f"rl:{_client_ip(request)}:{key}"
    client = await _get_redis()
    allowed = (
        await _redis_allows(client, bucket, max_calls, window_seconds)
        if client is not None
        else _memory_allows(bucket, max_calls, window_seconds)
    )
    if not allowed:
        raise HTTPException(status_code=429, detail=_TOO_MANY)
