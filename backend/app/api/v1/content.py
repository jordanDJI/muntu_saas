"""
Endpoints publics — blog et témoignages landing page.
Pas d'authentification requise.
"""
from fastapi import APIRouter, HTTPException, Query
from app.core.supabase import get_supabase_admin

router = APIRouter(prefix="/public", tags=["Content"])

_VALID_LANGS = ("fr", "en", "de", "nl")


def _norm_lang(lang: str) -> str:
    return lang if lang in _VALID_LANGS else "fr"


@router.get("/blog")
async def list_blog_posts(lang: str = Query("fr")):
    lang = _norm_lang(lang)
    sb = get_supabase_admin()
    posts = (
        sb.table("blog_post")
        .select("id, slug, title, description, category, metier, reading_minutes, published_at, status, lang")
        .eq("status", "published")
        .eq("lang", lang)
        .order("published_at", desc=True)
        .execute()
        .data or []
    )
    return posts


@router.get("/blog/{slug}")
async def get_blog_post(slug: str, lang: str = Query("fr")):
    lang = _norm_lang(lang)
    sb = get_supabase_admin()
    row = (
        sb.table("blog_post")
        .select("*")
        .eq("slug", slug)
        .eq("lang", lang)
        .eq("status", "published")
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise HTTPException(404, "Article introuvable")
    return row.data


@router.get("/blog/{slug}/translations")
async def get_blog_translations(slug: str, lang: str = Query("fr")):
    """
    Retourne { lang: slug } pour toutes les versions PUBLIÉES du même groupe de
    traduction que l'article demandé — utilisé pour générer les balises hreflang.
    Renvoie {} si l'article n'existe pas ou n'a pas (encore) de traduction publiée.
    """
    lang = _norm_lang(lang)
    sb = get_supabase_admin()
    source = (
        sb.table("blog_post")
        .select("translation_group_id")
        .eq("slug", slug)
        .eq("lang", lang)
        .maybe_single()
        .execute()
    )
    if not source.data or not source.data.get("translation_group_id"):
        return {}
    rows = (
        sb.table("blog_post")
        .select("lang, slug")
        .eq("translation_group_id", source.data["translation_group_id"])
        .eq("status", "published")
        .execute().data or []
    )
    return {r["lang"]: r["slug"] for r in rows}


@router.get("/blog-all-langs")
async def list_all_blog_posts_all_langs():
    """
    Toutes les langues confondues, publié uniquement — utilisé par le sitemap
    pour générer les bonnes URLs (/blog/{slug} en fr, /blog/{lang}/{slug} sinon).
    """
    sb = get_supabase_admin()
    posts = (
        sb.table("blog_post")
        .select("slug, lang, published_at")
        .eq("status", "published")
        .execute()
        .data or []
    )
    return posts


@router.get("/testimonials")
async def list_testimonials():
    sb = get_supabase_admin()
    rows = (
        sb.table("landing_testimonial")
        .select("*")
        .eq("active", True)
        .order("sort_order")
        .execute()
        .data or []
    )
    return rows
