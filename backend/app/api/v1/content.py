"""
Endpoints publics — blog et témoignages landing page.
Pas d'authentification requise.
"""
from fastapi import APIRouter, HTTPException
from app.core.supabase import get_supabase_admin

router = APIRouter(prefix="/public", tags=["Content"])


@router.get("/blog")
async def list_blog_posts():
    sb = get_supabase_admin()
    posts = (
        sb.table("blog_post")
        .select("id, slug, title, description, category, metier, reading_minutes, published_at, status")
        .eq("status", "published")
        .order("published_at", desc=True)
        .execute()
        .data or []
    )
    return posts


@router.get("/blog/{slug}")
async def get_blog_post(slug: str):
    sb = get_supabase_admin()
    row = (
        sb.table("blog_post")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise HTTPException(404, "Article introuvable")
    return row.data


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
