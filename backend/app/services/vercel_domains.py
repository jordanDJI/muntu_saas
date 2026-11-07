import logging

import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


def live_domain_ops_allowed() -> bool:
    """Les écritures sur les domaines ne partent vers Vercel / OVH qu'en production."""
    return settings.app_env == "production" or settings.allow_live_domains

_VERCEL_API = "https://api.vercel.com"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.vercel_api_token}",
        "Content-Type": "application/json",
    }


def _parse_status(data: dict) -> dict:
    """Extrait les indicateurs de progression depuis la réponse brute Vercel."""
    ssl_info = data.get("ssl") or {}
    ssl_state = ssl_info.get("state", "PENDING") if ssl_info else "PENDING"

    config_status = data.get("configStatus", "WAITING")
    propagated = config_status == "PROPAGATED"
    verified = data.get("verified", False)
    ssl_active = ssl_state == "VALID"

    conflicts = [
        v for v in data.get("verification", [])
        if v.get("reason") == "conflict"
    ]

    return {
        "verified": verified,
        "propagated": propagated,
        "ssl": ssl_active,
        "ssl_state": ssl_state,
        "config_status": config_status,
        "conflicts": conflicts,
    }


async def add_domain(domain: str) -> dict:
    if not live_domain_ops_allowed():
        logger.warning("add_domain(%s) simulé (app_env=%s)", domain, settings.app_env)
        return {"name": domain, "verified": False, "simulated": True}
    if not settings.vercel_api_token or not settings.vercel_project_id:
        raise RuntimeError("Vercel API non configurée (VERCEL_API_TOKEN / VERCEL_PROJECT_ID manquants)")
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            f"{_VERCEL_API}/v10/projects/{settings.vercel_project_id}/domains",
            headers=_headers(),
            json={"name": domain},
        )
        r.raise_for_status()
        return r.json()


# Repli si l'API ne renvoie pas de recommandation (non configurée, réponse
# ancienne). Même valeur que celle posée sur les domaines achetés via OVH.
APEX_A_FALLBACK = "216.198.79.1"


async def get_apex_a_value(domain: str) -> str:
    """IPv4 à mettre dans l'enregistrement A d'un domaine racine.

    Un CNAME sur la racine (`@`) est refusé par la plupart des registraires
    (OVH compris) : c'est ce que le code renvoyait avant, pour tous les
    domaines.
    """
    if not settings.vercel_api_token:
        return APEX_A_FALLBACK
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{_VERCEL_API}/v6/domains/{domain}/config", headers=_headers())
            r.raise_for_status()
            data = r.json()
        ranked = sorted(data.get("recommendedIPv4") or [], key=lambda x: x.get("rank", 99))
        for entry in ranked:
            values = entry.get("value") or []
            if values:
                return values[0]
    except Exception as exc:
        logger.warning("Recommandation IPv4 Vercel indisponible pour %s, repli %s : %s", domain, APEX_A_FALLBACK, exc)
    return APEX_A_FALLBACK


async def get_domain_status(domain: str) -> dict:
    """Retourne le statut enrichi : verified, propagated, ssl, conflicts."""
    if not settings.vercel_api_token or not settings.vercel_project_id:
        return {"verified": False, "propagated": False, "ssl": False, "ssl_state": "PENDING",
                "config_status": "NOT_CONFIGURED", "conflicts": []}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{_VERCEL_API}/v9/projects/{settings.vercel_project_id}/domains/{domain}",
            headers=_headers(),
        )
        if r.status_code == 404:
            return {"verified": False, "propagated": False, "ssl": False, "ssl_state": "PENDING",
                    "config_status": "NOT_FOUND", "conflicts": []}
        r.raise_for_status()
        return _parse_status(r.json())


async def remove_domain(domain: str) -> None:
    if not live_domain_ops_allowed():
        logger.warning("remove_domain(%s) simulé (app_env=%s)", domain, settings.app_env)
        return
    if not settings.vercel_api_token or not settings.vercel_project_id:
        return
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.delete(
            f"{_VERCEL_API}/v9/projects/{settings.vercel_project_id}/domains/{domain}",
            headers=_headers(),
        )
        if r.status_code not in (200, 204, 404):
            r.raise_for_status()
