import httpx
from app.core.config import settings

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
    if not settings.vercel_api_token or not settings.vercel_project_id:
        return
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.delete(
            f"{_VERCEL_API}/v9/projects/{settings.vercel_project_id}/domains/{domain}",
            headers=_headers(),
        )
        if r.status_code not in (200, 204, 404):
            r.raise_for_status()
