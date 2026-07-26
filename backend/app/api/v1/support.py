"""
Support interne — tickets tenant → équipe Klientys.
Endpoints :
  POST   /support/tickets           Créer un ticket
  GET    /support/tickets           Lister les tickets du tenant
  GET    /support/tickets/{id}      Détail + messages
  POST   /support/tickets/{id}/reply   Répondre à un ticket (tenant)
"""
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from app.core.config import settings as cfg
from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant
from app.services import push as push_svc
from app.services.email import send_support_email_to_admin, send_support_reply_to_tenant

router = APIRouter(prefix="/support", tags=["Support"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class TicketCreate(BaseModel):
    subject: str
    body: str
    priority: str = "normal"
    ticket_type: str = "general"  # "general" | "design_request"


class MessageCreate(BaseModel):
    body: str


# ── Endpoints tenant ──────────────────────────────────────────────────────────

@router.post("/tickets", status_code=201)
async def create_ticket(
    data: TicketCreate,
    background_tasks: BackgroundTasks,
    tenant_id: str = Depends(get_current_tenant),
):
    if not data.subject.strip():
        raise HTTPException(400, "Le sujet est requis")
    if not data.body.strip():
        raise HTTPException(400, "Le message est requis")

    sb = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()

    ticket = (
        sb.table("support_ticket")
        .insert({
            "tenant_id":   tenant_id,
            "subject":     data.subject.strip(),
            "status":      "open",
            "priority":    data.priority,
            "ticket_type": data.ticket_type if data.ticket_type in ("general", "design_request") else "general",
            "created_at":  now,
            "updated_at":  now,
        })
        .execute()
    ).data[0]

    (
        sb.table("support_message")
        .insert({
            "ticket_id": ticket["id"],
            "tenant_id": tenant_id,
            "sender":    "tenant",
            "body":      data.body.strip(),
        })
        .execute()
    )

    tenant_rows = sb.table("tenant").select("name, slug").eq("id", tenant_id).limit(1).execute().data or []
    tenant_name = tenant_rows[0].get("name", "Tenant") if tenant_rows else "Tenant"

    background_tasks.add_task(
        send_support_email_to_admin,
        ticket_id=ticket["id"],
        tenant_name=tenant_name,
        tenant_id=tenant_id,
        subject=data.subject.strip(),
        body=data.body.strip(),
    )

    return ticket


@router.get("/tickets")
def list_tickets(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()
    tickets = (
        sb.table("support_ticket")
        .select("id, subject, status, priority, created_at, updated_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    ).data or []
    return tickets


@router.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: str, tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()
    ticket = (
        sb.table("support_ticket")
        .select("id, subject, status, priority, created_at, updated_at, resolved_at")
        .eq("id", ticket_id)
        .eq("tenant_id", tenant_id)
        .single()
        .execute()
    ).data
    if not ticket:
        raise HTTPException(404, "Ticket introuvable")

    messages = (
        sb.table("support_message")
        .select("id, sender, body, created_at")
        .eq("ticket_id", ticket_id)
        .order("created_at", desc=False)
        .execute()
    ).data or []

    return {**ticket, "messages": messages}


@router.post("/tickets/{ticket_id}/reply", status_code=201)
async def reply_ticket(
    ticket_id: str,
    data: MessageCreate,
    background_tasks: BackgroundTasks,
    tenant_id: str = Depends(get_current_tenant),
):
    if not data.body.strip():
        raise HTTPException(400, "Le message est vide")

    sb = get_supabase_admin()
    rows = (
        sb.table("support_ticket")
        .select("id, subject, status, tenant_id")
        .eq("id", ticket_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        raise HTTPException(404, "Ticket introuvable")
    ticket = rows[0]
    if ticket["status"] in ("resolved", "closed"):
        raise HTTPException(400, "Ce ticket est fermé")

    (
        sb.table("support_message")
        .insert({
            "ticket_id": ticket_id,
            "tenant_id": tenant_id,
            "sender":    "tenant",
            "body":      data.body.strip(),
        })
        .execute()
    )
    (
        sb.table("support_ticket")
        .update({"updated_at": datetime.now(timezone.utc).isoformat(), "status": "open"})
        .eq("id", ticket_id)
        .execute()
    )

    tenant_rows = sb.table("tenant").select("name").eq("id", tenant_id).limit(1).execute().data or []
    tenant_name = tenant_rows[0].get("name", "Tenant") if tenant_rows else "Tenant"

    background_tasks.add_task(
        send_support_email_to_admin,
        ticket_id=ticket_id,
        tenant_name=tenant_name,
        tenant_id=tenant_id,
        subject=f"Re: {ticket['subject']}",
        body=data.body.strip(),
    )

    return {"success": True}


# ── Notifications in-app (tenant) ─────────────────────────────────────────────

@router.get("/notifications")
def list_notifications(tenant_id: str = Depends(get_current_tenant)):
    """Retourne les notifications non lues du tenant, les plus récentes en premier."""
    sb = get_supabase_admin()
    rows = (
        sb.table("tenant_notification")
        .select("id, type, title, body, data, created_at")
        .eq("tenant_id", tenant_id)
        .is_("read_at", "null")
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    ).data or []
    return rows


@router.post("/notifications/{notification_id}/read", status_code=200)
def mark_notification_read(notification_id: str, tenant_id: str = Depends(get_current_tenant)):
    """Marque une notification comme lue."""
    from datetime import datetime, timezone
    sb = get_supabase_admin()
    sb.table("tenant_notification").update({
        "read_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", notification_id).eq("tenant_id", tenant_id).execute()
    return {"ok": True}
