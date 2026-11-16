"""
Partage des articles du blog sur la page LinkedIn de Klientys (migration 087, KLT-1521).

API : Community Management API (Posts API), niveau « Development Tier ».
- Publication au nom de la **page** (`urn:li:organization:{id}`), jamais d'un profil.
- Jeton d'accès d'environ 60 jours. Le jeton de rafraîchissement n'est pas garanti
  à ce niveau d'accès : s'il existe on rafraîchit, sinon l'opérateur reconnecte la
  page (alerte dans /admin/content et email 7 jours avant l'expiration).
- La personne qui autorise doit être administratrice de la page.

Les fonctions sans réseau (`sign_state`, `escape_commentary`…) sont testées dans
tests/test_linkedin.py.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx

from app.core.config import settings
from app.core.crypto import decrypt, encrypt

logger = logging.getLogger(__name__)

AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
API_BASE = "https://api.linkedin.com/rest"
STATE_TTL_SECONDS = 15 * 60
REFRESH_MARGIN = timedelta(days=7)
COMMENTARY_MAX = 3000


class LinkedInError(Exception):
    """Erreur renvoyée par LinkedIn, avec un message lisible par l'opérateur."""


# ── Règles pures ───────────────────────────────────────────────────────────────

def is_configured() -> bool:
    return bool(settings.linkedin_client_id and settings.linkedin_client_secret
                and settings.linkedin_organization_id)


def redirect_uri() -> str:
    return f"{settings.app_url.rstrip('/')}/api/v1/admin/linkedin/callback"


def organization_urn() -> str:
    return f"urn:li:organization:{settings.linkedin_organization_id.strip()}"


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def sign_state(admin_id: str, admin_email: str, now: float | None = None) -> str:
    """Paramètre `state` OAuth signé : le retour de LinkedIn arrive sans JWT admin."""
    payload = json.dumps({
        "sub": admin_id, "email": admin_email,
        "exp": int((now or time.time()) + STATE_TTL_SECONDS), "n": secrets.token_hex(8),
    }, separators=(",", ":")).encode()
    sig = hmac.new(settings.secret_key.encode(), payload, hashlib.sha256).digest()
    return f"{_b64(payload)}.{_b64(sig)}"


def verify_state(state: str, now: float | None = None) -> dict | None:
    """Contenu du `state` s'il est authentique et non expiré, sinon None."""
    try:
        payload_b64, sig_b64 = state.split(".", 1)
        payload = _unb64(payload_b64)
        expected = hmac.new(settings.secret_key.encode(), payload, hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _unb64(sig_b64)):
            return None
        data = json.loads(payload)
        if data.get("exp", 0) < (now or time.time()):
            return None
        return data
    except Exception:
        return None


# Caractères réservés du « little text format » des posts LinkedIn : non échappés,
# ils sont interprétés (mentions, hashtags…) ou font rejeter le post.
_RESERVED = re.compile(r"([\\|{}@\[\]()<>#*_~])")


def escape_commentary(text: str) -> str:
    out = _RESERVED.sub(r"\\\1", (text or "").strip())[:COMMENTARY_MAX]
    # La coupe ne doit pas laisser un « \ » orphelin, qui échapperait la fin du texte.
    trailing = len(out) - len(out.rstrip("\\"))
    return out[:-1] if trailing % 2 else out


def default_commentary(title: str, description: str | None) -> str:
    parts = [title.strip()]
    if description and description.strip():
        parts.append(description.strip())
    parts.append("À lire sur le blog Klientys :")
    return "\n\n".join(parts)


def post_url(urn: str) -> str:
    return f"https://www.linkedin.com/feed/update/{urn}/"


def days_left(expires_at: str | None, now: datetime | None = None) -> int | None:
    if not expires_at:
        return None
    end = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    return max(0, (end - (now or datetime.now(timezone.utc))).days)


# ── OAuth ──────────────────────────────────────────────────────────────────────

def authorize_url(state: str) -> str:
    return AUTH_URL + "?" + urlencode({
        "response_type": "code",
        "client_id": settings.linkedin_client_id,
        "redirect_uri": redirect_uri(),
        "state": state,
        "scope": settings.linkedin_scopes,
    })


async def _token_request(form: dict) -> dict:
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(TOKEN_URL, data={
            **form,
            "client_id": settings.linkedin_client_id,
            "client_secret": settings.linkedin_client_secret,
        })
    data = resp.json() if resp.content else {}
    if resp.status_code != 200 or "access_token" not in data:
        raise LinkedInError(data.get("error_description") or data.get("error") or f"HTTP {resp.status_code}")
    return data


def _token_columns(data: dict, now: datetime) -> dict:
    columns = {
        "access_token": encrypt(data["access_token"]),
        "expires_at": (now + timedelta(seconds=int(data.get("expires_in", 0)))).isoformat(),
        "scopes": data.get("scope"),
        "expiry_notified_at": None,
    }
    if data.get("refresh_token"):
        columns["refresh_token"] = encrypt(data["refresh_token"])
        if data.get("refresh_token_expires_in"):
            columns["refresh_expires_at"] = (
                now + timedelta(seconds=int(data["refresh_token_expires_in"]))
            ).isoformat()
    return columns


async def connect(sb, code: str, admin_email: str | None) -> dict:
    """Échange le code OAuth et enregistre la connexion (remplace la précédente)."""
    now = datetime.now(timezone.utc)
    data = await _token_request({
        "grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri(),
    })
    row = {
        "id": 1,
        "organization_id": settings.linkedin_organization_id.strip(),
        "connected_by_email": admin_email,
        "connected_at": now.isoformat(),
        "refresh_token": None,
        "refresh_expires_at": None,
        **_token_columns(data, now),
    }
    sb.table("linkedin_connection").upsert(row, on_conflict="id").execute()
    return row


def get_connection(sb) -> dict | None:
    rows = sb.table("linkedin_connection").select("*").eq("id", 1).limit(1).execute().data or []
    return rows[0] if rows else None


async def access_token(sb) -> str:
    """Jeton valide, rafraîchi si possible à l'approche de l'expiration."""
    conn = get_connection(sb)
    if not conn:
        raise LinkedInError("La page LinkedIn n'est pas connectée.")
    now = datetime.now(timezone.utc)
    expires_at = datetime.fromisoformat(conn["expires_at"].replace("Z", "+00:00"))
    refresh_token = decrypt(conn.get("refresh_token"))
    if refresh_token and expires_at - now < REFRESH_MARGIN:
        try:
            data = await _token_request({"grant_type": "refresh_token", "refresh_token": refresh_token})
            sb.table("linkedin_connection").update(_token_columns(data, now)).eq("id", 1).execute()
            return data["access_token"]
        except LinkedInError as exc:
            logger.warning("LinkedIn : rafraîchissement du jeton impossible : %s", exc)
    if expires_at <= now:
        raise LinkedInError("La connexion LinkedIn a expiré : reconnectez la page depuis /admin/content.")
    return decrypt(conn["access_token"])


# ── Publication ────────────────────────────────────────────────────────────────

def _api_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "LinkedIn-Version": settings.linkedin_api_version,
        "X-Restli-Protocol-Version": "2.0.0",
    }


def _error_message(resp: httpx.Response) -> str:
    try:
        data = resp.json()
        return data.get("message") or data.get("error_description") or f"HTTP {resp.status_code}"
    except Exception:
        return f"HTTP {resp.status_code}"


async def _upload_thumbnail(client: httpx.AsyncClient, token: str, image_url: str) -> str | None:
    """Envoie l'image de l'article à LinkedIn (l'API ne lit pas les balises og:image)."""
    try:
        img = await client.get(image_url, timeout=20.0)
        if img.status_code != 200 or not img.content:
            return None
        init = await client.post(
            f"{API_BASE}/images?action=initializeUpload",
            headers=_api_headers(token),
            json={"initializeUploadRequest": {"owner": organization_urn()}},
        )
        if init.status_code >= 300:
            logger.warning("LinkedIn : initialisation de l'image refusée : %s", _error_message(init))
            return None
        value = init.json().get("value") or {}
        upload = await client.put(
            value["uploadUrl"], content=img.content,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/octet-stream"},
        )
        if upload.status_code >= 300:
            logger.warning("LinkedIn : envoi de l'image refusé (HTTP %s)", upload.status_code)
            return None
        return value.get("image")
    except Exception as exc:
        logger.warning("LinkedIn : vignette non envoyée : %s", exc, exc_info=True)
        return None


async def share_article(sb, *, url: str, title: str, description: str | None,
                        commentary: str, image_url: str | None = None) -> str:
    """Publie un post « article » sur la page. Renvoie l'URN du post."""
    token = await access_token(sb)
    article: dict = {"source": url, "title": title[:200]}
    if description:
        article["description"] = description[:256]
    body = {
        "author": organization_urn(),
        "commentary": escape_commentary(commentary),
        "visibility": "PUBLIC",
        "distribution": {
            "feedDistribution": "MAIN_FEED",
            "targetEntities": [],
            "thirdPartyDistributionChannels": [],
        },
        "content": {"article": article},
        "lifecycleState": "PUBLISHED",
        "isReshareDisabledByAuthor": False,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        thumbnail = await _upload_thumbnail(client, token, image_url) if image_url else None
        if thumbnail:
            article["thumbnail"] = thumbnail
        resp = await client.post(f"{API_BASE}/posts", headers=_api_headers(token), json=body)
        if resp.status_code >= 300 and thumbnail:
            # Une vignette encore en traitement chez LinkedIn peut faire refuser le post :
            # mieux vaut un post sans image que pas de post.
            logger.warning("LinkedIn : post refusé avec vignette (%s), nouvel essai sans", _error_message(resp))
            article.pop("thumbnail", None)
            resp = await client.post(f"{API_BASE}/posts", headers=_api_headers(token), json=body)
    if resp.status_code >= 300:
        raise LinkedInError(_error_message(resp))
    urn = resp.headers.get("x-restli-id") or resp.headers.get("x-linkedin-id")
    if not urn:
        raise LinkedInError("LinkedIn n'a pas renvoyé l'identifiant du post.")
    return urn
