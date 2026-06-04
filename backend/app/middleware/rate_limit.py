"""
Rate limiter in-memory simple.
En production avec plusieurs workers, préférer Redis + slowapi.
Efficace pour limiter les abus sur un seul process (dev + single-worker prod).
"""
import time
from collections import defaultdict
from fastapi import Request, HTTPException

_buckets: dict[str, list[float]] = defaultdict(list)


def check_rate(
    request: Request,
    key: str,
    max_calls: int,
    window_seconds: int,
) -> None:
    """Lève HTTP 429 si l'IP dépasse max_calls requêtes dans window_seconds."""
    ip = request.client.host if request.client else "unknown"
    bucket = f"{ip}:{key}"
    now = time.time()
    _buckets[bucket] = [t for t in _buckets[bucket] if now - t < window_seconds]
    if len(_buckets[bucket]) >= max_calls:
        raise HTTPException(status_code=429, detail="Trop de requêtes. Veuillez patienter avant de réessayer.")
    _buckets[bucket].append(now)


def check_rate_by_key(identifier: str, key: str, max_calls: int, window_seconds: int) -> None:
    """Lève HTTP 429 si l'identifiant (user_id, email…) dépasse max_calls dans window_seconds."""
    bucket = f"{identifier}:{key}"
    now = time.time()
    _buckets[bucket] = [t for t in _buckets[bucket] if now - t < window_seconds]
    if len(_buckets[bucket]) >= max_calls:
        raise HTTPException(status_code=429, detail="Limite atteinte. Réessaie dans quelques minutes.")
    _buckets[bucket].append(now)
