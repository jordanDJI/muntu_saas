from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant
from app.services import email as email_svc
from app.services.subscription import get_tenant_plan

router = APIRouter(prefix="/design-requests", tags=["Design Requests"])


class DesignRequestIn(BaseModel):
    message: str
    is_additional: bool = False
    site_id: str | None = None


@router.post("/")
async def create_design_request(
    body: DesignRequestIn,
    tenant_id: str = Depends(get_current_tenant),
):
    plan = await get_tenant_plan(tenant_id)
    if plan.get("plan_name") != "Business":
        raise HTTPException(403, "Réservé au plan Business")

    sb = get_supabase_admin()

    tenant = sb.table("tenant").select("name").eq("id", tenant_id).maybe_single().execute()
    tenant_name = tenant.data.get("name", "") if tenant.data else ""

    if body.site_id:
        site_row = sb.table("site").select("id, title").eq("id", body.site_id).eq("tenant_id", tenant_id).maybe_single().execute()
        site_id = site_row.data["id"] if site_row.data else None
        site_name = (site_row.data.get("title") or "") if site_row.data else ""
    else:
        site = sb.table("site").select("id, title").eq("tenant_id", tenant_id).limit(1).execute()
        site_id = site.data[0]["id"] if site.data else None
        site_name = site.data[0].get("title") or "" if site.data else ""

    row = sb.table("design_request").insert({
        "tenant_id":     tenant_id,
        "tenant_name":   tenant_name,
        "site_id":       site_id,
        "site_name":     site_name,
        "is_additional": body.is_additional,
        "message":       body.message,
        "status":        "pending",
    }).execute()

    try:
        email_svc.send_design_request_admin(
            tenant_name=tenant_name,
            site_name=site_name,
            is_additional=body.is_additional,
            message=body.message,
            request_id=row.data[0]["id"],
        )
    except Exception:
        pass  # non bloquant

    return row.data[0]


@router.get("/mine")
async def get_my_requests(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()
    res = sb.table("design_request").select("*").eq("tenant_id", tenant_id).order("created_at", desc=True).execute()
    return res.data or []
