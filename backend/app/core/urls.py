"""
Origines autorisées + validation des URLs de redirection.

Les endpoints de paiement recevaient `success_url` / `cancel_url` depuis
le client et les passaient tels quels à Stripe, qui redirige donc vers
une URL arbitraire après encaissement. On valide désormais l'origine
côté serveur et on retombe sur une destination sûre sinon.
"""
from urllib.parse import urlparse

from app.core.config import settings

# Domaines de production, toujours acceptés même si la config est partielle
_ALWAYS_ALLOWED: tuple = (
    "https://klientys.co",
    "https://www.klientys.co",
    "https://muntu-saas.vercel.app",
)


def allowed_origins() -> list[str]:
    """Origines autorisées (CORS + redirections de paiement)."""
    configured = [o.strip() for o in (settings.frontend_url, settings.frontend_url_prod) if o]
    return list({*_ALWAYS_ALLOWED, *configured})


def _origin_of(url: str) -> str | None:
    try:
        parsed = urlparse(url)
    except (ValueError, AttributeError):
        return None
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


def default_frontend() -> str:
    return (settings.frontend_url_prod or settings.frontend_url or _ALWAYS_ALLOWED[0]).rstrip("/")


def safe_redirect_url(candidate: str | None, fallback_path: str) -> str:
    """
    Renvoie `candidate` s'il pointe vers une origine autorisée,
    sinon `default_frontend() + fallback_path`.

    `fallback_path` doit commencer par « / ».
    """
    fallback = f"{default_frontend()}{fallback_path}"
    if not candidate:
        return fallback
    origin = _origin_of(candidate)
    if origin and origin.rstrip("/") in {o.rstrip("/") for o in allowed_origins()}:
        return candidate
    return fallback
