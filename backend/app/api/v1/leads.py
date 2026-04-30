from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from uuid import UUID
from app.middleware.tenant import get_current_tenant
from app.core.supabase import get_supabase_admin
from app.models.lead import LeadCreateIn, LeadUpdateIn, LeadOut
from app.services.email import send_lead_notification

router = APIRouter(prefix="/leads", tags=["Leads"])


@router.get("/", response_model=list[LeadOut])
async def list_leads(
    status: str | None = None,
    audience_type: str | None = None,
    tenant_id: str = Depends(get_current_tenant),
):
    supabase = get_supabase_admin()
    query = (
        supabase.table("lead")
        .select("*, contact(first_name, last_name, email, phone)")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
    )
    if status:
        query = query.eq("status", status)
    if audience_type:
        query = query.eq("audience_type", audience_type)
    return query.execute().data


@router.post("/public/{tenant_slug}", status_code=status.HTTP_201_CREATED)
async def create_lead_public(tenant_slug: str, body: LeadCreateIn, background_tasks: BackgroundTasks):
    """Endpoint public — appelé par le formulaire du site vitrine."""
    supabase = get_supabase_admin()

    tenant = supabase.table("tenant").select("id, name").eq("slug", tenant_slug).single().execute().data
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    tenant_id = tenant["id"]

    contact = supabase.table("contact").insert({
        "tenant_id": tenant_id,
        "first_name": body.first_name,
        "last_name": body.last_name,
        "email": str(body.email) if body.email else None,
        "phone": body.phone,
        "contact_type": "individual",
    }).execute().data[0]

    stage = supabase.table("pipeline_stage").select("id").eq("tenant_id", tenant_id).eq("position", 1).single().execute().data
    lead_data = {
        "tenant_id": tenant_id,
        "contact_id": contact["id"],
        "source": body.source,
        "status": "new",
        "priority": "normal",
        "audience_type": body.audience_type,
        "request_type": body.request_type,
        "notes": body.message,
    }
    if stage:
        lead_data["pipeline_stage_id"] = stage["id"]
    if body.service_offer_id:
        lead_data["service_offer_id"] = str(body.service_offer_id)

    lead = supabase.table("lead").insert(lead_data).execute().data[0]

    owner = supabase.table("membership").select("app_user(email)").eq("tenant_id", tenant_id).eq("role", "owner").single().execute().data
    if owner:
        background_tasks.add_task(send_lead_notification, owner["app_user"]["email"], lead, contact)

    return {"id": lead["id"], "status": "created"}


@router.patch("/{lead_id}")
async def update_lead(lead_id: UUID, body: LeadUpdateIn, tenant_id: str = Depends(get_current_tenant)):
    supabase = get_supabase_admin()
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")
    result = supabase.table("lead").update(updates).eq("id", str(lead_id)).eq("tenant_id", tenant_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Lead introuvable")
    return result.data[0]
