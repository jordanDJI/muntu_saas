from fastapi import APIRouter, Depends
from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("/completion")
async def get_profile_completion(tenant_id: str = Depends(get_current_tenant)):
    """Retourne le score de complétion du profil (0-100) et les étapes manquantes."""
    sb = get_supabase_admin()

    # Site
    site_res = sb.table("site").select("id, title, status, site_style").eq("tenant_id", tenant_id).maybe_single().execute()
    site = site_res.data or {}
    site_style = site.get("site_style") or {}
    site_id = site.get("id")

    has_title = bool((site.get("title") or "").strip())

    photo_urls = site_style.get("photo_urls") or {}
    logo_url   = site_style.get("logo_url") or ""
    has_photos = bool(logo_url) or any(v for v in photo_urls.values() if v)

    is_published = site.get("status") == "published"

    # Disponibilités
    has_slots = False
    cal_res = sb.table("calendar").select("id").eq("tenant_id", tenant_id).maybe_single().execute()
    if cal_res.data:
        slots = sb.table("availability_slot").select("id", count="exact").eq("calendar_id", cal_res.data["id"]).execute()
        has_slots = (slots.count or 0) > 0

    # Prestations
    has_offers = False
    if site_id:
        offers = sb.table("service_offer").select("id", count="exact").eq("site_id", site_id).execute()
        has_offers = (offers.count or 0) > 0

    steps = [
        {"key": "title",     "done": has_title,    "link": "/dashboard/site-builder"},
        {"key": "photos",    "done": has_photos,   "link": "/dashboard/site-builder"},
        {"key": "slots",     "done": has_slots,    "link": "/dashboard/appointments"},
        {"key": "offers",    "done": has_offers,   "link": "/dashboard/site-builder"},
        {"key": "published", "done": is_published, "link": "/dashboard/site-builder"},
    ]
    score = int(sum(1 for s in steps if s["done"]) / len(steps) * 100)
    return {"score": score, "steps": steps}
