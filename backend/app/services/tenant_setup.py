from uuid import uuid4
from app.core.supabase import get_supabase_admin


async def provision_tenant(tenant_id: str, user_id: str, tenant_name: str) -> None:
    """Create the default records that every new tenant needs.
    Called both from onboarding (first tenant) and from the multi-tenant creation endpoint."""
    sb = get_supabase_admin()

    sb.table("calendar").insert({
        "tenant_id": tenant_id,
        "name": "Principal",
    }).execute()

    sb.table("pipeline_stage").insert([
        {"tenant_id": tenant_id, "name": "Nouveau",  "position": 1},
        {"tenant_id": tenant_id, "name": "Contacté", "position": 2},
        {"tenant_id": tenant_id, "name": "Qualifié", "position": 3},
        {"tenant_id": tenant_id, "name": "Planifié", "position": 4},
        {"tenant_id": tenant_id, "name": "Conclu",   "position": 5},
    ]).execute()

    sb.table("site").insert({
        "tenant_id": tenant_id,
        "title": tenant_name,
        "status": "draft",
        "audience_mode": "b2c",
        "default_language": "fr",
    }).execute()

    sb.table("agent_config").insert([
        {"tenant_id": tenant_id, "agent_type": "vitrine",          "status": "active", "model": "gemini-2.5-flash"},
        {"tenant_id": tenant_id, "agent_type": "support_client",   "status": "active", "model": "gemini-2.5-flash"},
        {"tenant_id": tenant_id, "agent_type": "assistant_tenant", "status": "active", "model": "gemini-2.5-flash"},
    ]).execute()

    try:
        api_key = f"sk_{uuid4().hex}"
        sb.table("tenant").update({"api_key": api_key}).eq("id", tenant_id).execute()
    except Exception:
        pass  # migration 020 may not be applied yet
