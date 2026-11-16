"""
Panel admin — partage des articles du blog sur la page LinkedIn (migration 087, KLT-1521).

Règles convenues :
- partage manuel, depuis /admin/content, par un super admin (JWT) ; l'agent de
  contenu automatisé (secret partagé) n'a accès à aucune de ces routes ;
- articles **français publiés** uniquement, **une seule fois** par article ;
- un échec LinkedIn n'annule jamais la publication de l'article.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from urllib.parse import quote, urlencode

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from app.api.v1.admin import _blog_path, _log
from app.core.config import settings
from app.core.crypto import decrypt
from app.core.supabase import get_supabase_admin
from app.core.urls import default_frontend
from app.middleware.admin import get_current_admin, viewer_or_above
from app.services import linkedin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin — LinkedIn"])

# Liens publics et retours navigateur : toujours le domaine de production
# (FRONTEND_URL_PROD), jamais FRONTEND_URL qui peut désigner le domaine Vercel —
# LinkedIn affichait « muntu-saas.vercel.app » sous les articles partagés.


def _content_url(**params) -> str:
    return f"{default_frontend()}/admin/content?{urlencode(params)}"


@router.get("/linkedin/status")
async def linkedin_status(admin=Depends(viewer_or_above)):
    configured = linkedin.is_configured()
    conn = linkedin.get_connection(get_supabase_admin()) if configured else None
    if not conn:
        return {"configured": configured, "connected": False, "redirect_uri": linkedin.redirect_uri()}
    left = linkedin.days_left(conn.get("expires_at"))
    return {
        "configured": configured,
        "connected": True,
        "organization_id": conn.get("organization_id"),
        "connected_by": conn.get("connected_by_email"),
        "connected_at": conn.get("connected_at"),
        "expires_at": conn.get("expires_at"),
        "days_left": left,
        "auto_refresh": bool(decrypt(conn.get("refresh_token"))),
        "expired": left == 0,
        "redirect_uri": linkedin.redirect_uri(),
    }


@router.post("/linkedin/connect")
async def linkedin_connect(admin=Depends(get_current_admin)):
    if not linkedin.is_configured():
        raise HTTPException(400, "LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET et LINKEDIN_ORGANIZATION_ID "
                                 "doivent être configurées sur le backend.")
    state = linkedin.sign_state(admin["sub"], admin.get("email") or "")
    return {"url": linkedin.authorize_url(state)}


@router.get("/linkedin/callback", include_in_schema=False)
async def linkedin_callback(
    code: str | None = Query(None),
    state: str = Query(""),
    error: str | None = Query(None),
    error_description: str | None = Query(None),
):
    """Retour navigateur de LinkedIn : authentifié par le `state` signé, pas par un JWT."""
    claims = linkedin.verify_state(state)
    if not claims:
        return RedirectResponse(_content_url(linkedin="error", reason="Lien expiré, recommencez."))
    if error or not code:
        return RedirectResponse(_content_url(linkedin="error", reason=error_description or error or "Accès refusé"))
    try:
        await linkedin.connect(get_supabase_admin(), code, claims.get("email"))
    except linkedin.LinkedInError as exc:
        logger.warning("Connexion LinkedIn refusée : %s", exc)
        return RedirectResponse(_content_url(linkedin="error", reason=str(exc)[:200]))
    _log({"sub": claims["sub"], "email": claims.get("email")}, "linkedin_connect",
         payload={"organization_id": settings.linkedin_organization_id})
    return RedirectResponse(_content_url(linkedin="connected"))


@router.delete("/linkedin/connection")
async def linkedin_disconnect(admin=Depends(get_current_admin)):
    get_supabase_admin().table("linkedin_connection").delete().eq("id", 1).execute()
    _log(admin, "linkedin_disconnect")
    return {"ok": True}


class ShareIn(BaseModel):
    commentary: str = Field(..., min_length=1, max_length=2500)


@router.post("/content/blog/{post_id}/linkedin-share")
async def share_blog_post(post_id: str, body: ShareIn, admin=Depends(get_current_admin)):
    sb = get_supabase_admin()
    rows = (
        sb.table("blog_post")
        .select("id, slug, title, description, status, lang, linkedin_post_urn")
        .eq("id", post_id).limit(1).execute().data or []
    )
    if not rows:
        raise HTTPException(404, "Article introuvable")
    post = rows[0]
    if post.get("status") != "published" or (post.get("lang") or "fr") != "fr":
        raise HTTPException(400, "Seuls les articles français publiés se partagent sur LinkedIn.")
    if post.get("linkedin_post_urn"):
        raise HTTPException(409, "Cet article a déjà été partagé sur LinkedIn.")

    base = default_frontend()
    try:
        urn = await linkedin.share_article(
            sb,
            url=f"{base}{_blog_path('fr', post['slug'])}",
            title=post["title"],
            description=post.get("description"),
            commentary=body.commentary,
            image_url=f"{base}/api/og?title={quote(post['title'])}&color=indigo",
        )
    except linkedin.LinkedInError as exc:
        logger.warning("Partage LinkedIn échoué (article %s) : %s", post_id, exc)
        raise HTTPException(502, f"LinkedIn a refusé la publication : {exc}")

    now = datetime.now(timezone.utc).isoformat()
    sb.table("blog_post").update({"linkedin_post_urn": urn, "linkedin_shared_at": now}).eq("id", post_id).execute()
    _log(admin, "linkedin_share_blog_post", payload={"id": post_id, "slug": post["slug"], "urn": urn})
    return {"post_urn": urn, "post_url": linkedin.post_url(urn), "shared_at": now}
