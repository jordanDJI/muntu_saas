"""
Intégrations des widgets sur des supports externes (voir services/integrations.py).

Tenant : liste, création, renommage, désactivation / réactivation, état du chatbot.
Public : `ping`, appelé par chaque widget à son chargement.
"""
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.supabase import get_supabase_admin
from app.middleware.rate_limit import check_rate
from app.middleware.tenant import get_current_tenant
from app.services import integrations as svc

router = APIRouter(prefix="/integrations", tags=["Integrations"])


class IntegrationIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    kind: Literal["website", "iframe", "link"] = "website"


class IntegrationPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    status: Optional[Literal["active", "disabled"]] = None


class PingIn(BaseModel):
    integration: Optional[str] = Field(default=None, max_length=40)
    host: Optional[str] = Field(default=None, max_length=255)
    widget: Literal["chatbot", "book", "contact"]


def _site_for_chatbot(sb, tenant_id: str) -> dict | None:
    rows = (
        sb.table("site")
        .select("title, description, phone, email_contact, service_offer(name)")
        .eq("tenant_id", tenant_id).limit(1).execute().data
    )
    return rows[0] if rows else None


@router.get("/")
async def list_integrations(tenant_id: str = Depends(get_current_tenant)):
    return svc.list_with_stats(get_supabase_admin(), tenant_id)


@router.post("/", status_code=201)
async def create_integration(body: IntegrationIn, tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()
    row = sb.table("site_integration").insert({
        "tenant_id": tenant_id,
        "key": svc.generate_key(),
        "name": body.name.strip(),
        "kind": body.kind,
    }).execute().data[0]
    return {**row, "domains": [], "leads_count": 0, "appointments_count": 0}


@router.patch("/{integration_id}")
async def update_integration(integration_id: str, body: IntegrationPatch, tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()
    existing = (
        sb.table("site_integration").select("id")
        .eq("id", integration_id).eq("tenant_id", tenant_id).limit(1).execute().data
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Intégration introuvable")

    update: dict = {}
    if body.name is not None:
        update["name"] = body.name.strip()
    if body.status == "disabled":
        update.update({"status": "disabled", "disabled_reason": "manual",
                       "disabled_at": datetime.now(timezone.utc).isoformat()})
    elif body.status == "active":
        update.update({"status": "active", "disabled_reason": None, "disabled_at": None})
    if not update:
        raise HTTPException(status_code=422, detail="Rien à modifier")

    sb.table("site_integration").update(update).eq("id", integration_id).eq("tenant_id", tenant_id).execute()
    return next(i for i in svc.list_with_stats(sb, tenant_id) if i["id"] == integration_id)


@router.get("/chatbot-readiness")
async def chatbot_readiness(tenant_id: str = Depends(get_current_tenant)):
    missing = svc.chatbot_missing(_site_for_chatbot(get_supabase_admin(), tenant_id))
    return {"ready": not missing, "missing": missing}


@router.post("/public/{tenant_slug}/ping")
async def ping(tenant_slug: str, body: PingIn, request: Request):
    """Chargement d'un widget : détection du support et autorisation d'affichage.

    Le widget se masque si `active` est faux. Pour le chatbot, `chatbot_ready`
    faux le masque aussi : une bulle qui répond « erreur » sur le site du
    client est pire que pas de bulle. La cause s'affiche dans le dashboard.
    """
    check_rate(request, "integration_ping", max_calls=120, window_seconds=60)
    sb = get_supabase_admin()
    tenant = (
        sb.table("tenant").select("id").eq("slug", tenant_slug).neq("is_active", False)
        .limit(1).execute().data
    )
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    tenant_id = tenant[0]["id"]

    resolved = svc.resolve_for_widget(sb, tenant_id, body.integration, body.host)
    integ = resolved["integration"]
    out = {
        "active": resolved["active"],
        "integration": integ["key"] if integ else None,
        "kind": integ["kind"] if integ else None,
    }
    if body.widget == "chatbot" and resolved["active"]:
        out["chatbot_ready"] = not svc.chatbot_missing(_site_for_chatbot(sb, tenant_id))
    return out
