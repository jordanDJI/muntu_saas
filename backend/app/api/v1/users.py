"""
Endpoints utilisateur : journal d'activité, export RGPD, suppression de compte, statut intégrations.
"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import BaseModel

from app.core.config import settings
from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant, get_current_user
from app.services.activity import log_activity

router = APIRouter(prefix="/users", tags=["Users"])


class ActivityIn(BaseModel):
    action: str
    detail: str | None = None


# ── GET /users/activity-log ───────────────────────────────────────────────────

@router.get("/activity-log")
async def get_activity_log(
    tenant_id: str = Depends(get_current_tenant),
    limit: int = 50,
):
    try:
        sb = get_supabase_admin()
        res = (
            sb.table("activity_log")
            .select("id, action, detail, created_at")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []
    except Exception:
        return []


# ── POST /users/log-activity ──────────────────────────────────────────────────

@router.post("/log-activity")
async def record_activity(
    body: ActivityIn,
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(get_current_user),
):
    log_activity(tenant_id, user["sub"], body.action, body.detail)
    return {"ok": True}


# ── GET /users/export ─────────────────────────────────────────────────────────

@router.get("/export")
async def export_data(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()

    tenant_res = sb.table("tenant").select("id, name, slug, sector, country").eq("id", tenant_id).limit(1).execute()
    contacts = sb.table("contact").select("*").eq("tenant_id", tenant_id).execute().data or []
    leads = sb.table("lead").select("*").eq("tenant_id", tenant_id).execute().data or []
    sites = sb.table("site").select("id, title, status, address, description, tagline").eq("tenant_id", tenant_id).execute().data or []

    calendars = sb.table("calendar").select("id").eq("tenant_id", tenant_id).execute().data or []
    appointments = []
    for cal in calendars:
        appts = sb.table("appointment").select("*").eq("calendar_id", cal["id"]).execute().data or []
        appointments.extend(appts)

    export = {
        "tenant": tenant_res.data[0] if tenant_res.data else {},
        "contacts": contacts,
        "leads": leads,
        "appointments": appointments,
        "sites": sites,
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }

    content = json.dumps(export, ensure_ascii=False, indent=2, default=str)
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="klientys-export.json"'},
    )


# ── POST /users/delete-account ────────────────────────────────────────────────

@router.post("/delete-account")
async def delete_account(
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(get_current_user),
):
    sb = get_supabase_admin()
    log_activity(tenant_id, user["sub"], "Compte désactivé", "Demande de suppression du compte")
    sb.table("tenant").update({"is_active": False}).eq("id", tenant_id).execute()
    return {"status": "deactivated"}


# ── GET /users/integrations/status ───────────────────────────────────────────

@router.get("/integrations/status")
async def integrations_status(_tenant_id: str = Depends(get_current_tenant)):
    return {
        "stripe": bool(getattr(settings, "stripe_secret_key", "")),
        "resend": bool(getattr(settings, "resend_api_key", "")),
        "gemini": bool(getattr(settings, "gemini_api_key", "")),
        "whatsapp": bool(getattr(settings, "dialog360_api_key", "")),
    }
