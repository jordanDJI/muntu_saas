from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from uuid import UUID
from app.middleware.tenant import get_current_tenant
from app.core.supabase import get_supabase_admin
from app.models.lead import LeadCreateIn, LeadUpdateIn, LeadOut
from app.services.email import send_lead_notification, send_lead_acknowledgement
from app.api.v1.booking import _get_team_emails, _TEAM_EMAIL_ERROR

router = APIRouter(prefix="/leads", tags=["Leads"])


@router.get("/contacts/count")
async def get_contacts_count(tenant_id: str = Depends(get_current_tenant)):
    supabase = get_supabase_admin()
    result = supabase.table("contact").select("id", count="exact").eq("tenant_id", tenant_id).execute()
    return {"count": result.count or 0}


@router.get("/", response_model=list[LeadOut])
async def list_leads(
    status: str | None = None,
    audience_type: str | None = None,
    limit: int = 100,
    offset: int = 0,
    tenant_id: str = Depends(get_current_tenant),
):
    supabase = get_supabase_admin()
    query = (
        supabase.table("lead")
        .select("*, contact(id, first_name, last_name, email, phone)")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
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

    # Bloquer les emails de l'équipe du tenant
    if body.email and str(body.email).strip().lower() in _get_team_emails(supabase, tenant_id):
        raise HTTPException(status_code=403, detail=_TEAM_EMAIL_ERROR)

    # Chercher un contact existant par email pour éviter les doublons
    email_val = str(body.email).strip().lower() if body.email else None
    existing = None
    if email_val:
        res = supabase.table("contact").select("id").eq("tenant_id", tenant_id).eq("email", email_val).execute()
        existing = res.data[0] if res.data else None

    if existing:
        contact = existing
    else:
        contact = supabase.table("contact").insert({
            "tenant_id": tenant_id,
            "first_name": body.first_name,
            "last_name": body.last_name,
            "email": email_val,
            "phone": body.phone,
            "contact_type": body.contact_type,
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
    }
    # `notes` existe dans le schéma cible, mais peut être absent si la migration n'a pas été appliquée.
    # On l'ajoute de manière tolérante (fallback si PostgREST renvoie PGRST204).
    if body.message:
        lead_data["notes"] = body.message
    if stage:
        lead_data["pipeline_stage_id"] = stage["id"]
    if body.service_offer_id:
        lead_data["service_offer_id"] = str(body.service_offer_id)

    try:
        lead = supabase.table("lead").insert(lead_data).execute().data[0]
    except Exception as exc:
        # Compat: si la colonne `notes` n'existe pas dans la DB, on réessaie sans.
        msg = str(exc)
        if "PGRST204" in msg and "notes" in msg and "lead" in msg and "schema cache" in msg:
            lead_data.pop("notes", None)
            lead = supabase.table("lead").insert(lead_data).execute().data[0]
        else:
            raise

    owner = supabase.table("membership").select("app_user(email)").eq("tenant_id", tenant_id).eq("role", "owner").single().execute().data
    if owner:
        background_tasks.add_task(send_lead_notification, owner["app_user"]["email"], lead, contact)

    # Accusé de réception au prospect
    if contact.get("email"):
        contact_name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
        background_tasks.add_task(send_lead_acknowledgement, contact["email"], contact_name, tenant["name"])

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
