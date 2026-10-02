"""
Quota de contacts par tenant — tolérance de 150% du plan (le risque de dépassement brutal
vient surtout d'un import en masse, pas de la création organique au compte-goutte).
"""
import math

from app.core.supabase import get_supabase_admin
from app.services.subscription import get_tenant_plan

OVERAGE_TOLERANCE = 1.5


def _count_contacts(sb, tenant_id: str) -> int:
    return (
        sb.table("contact")
        .select("id", count="exact")
        .eq("tenant_id", tenant_id)
        .is_("deleted_at", "null")
        .execute()
    ).count or 0


async def get_contact_quota(tenant_id: str) -> dict:
    """
    Retourne { unlimited, current, max_contacts, ceiling, room }.
    - unlimited=True (plan illimité, max_contacts < 0) → ceiling/room = None.
    - sinon ceiling = floor(max_contacts * 1.5) ; room = max(0, ceiling - current)
      (max_contacts=0, ex. override admin "kill switch" → ceiling=0 → room=0).
    """
    sb = get_supabase_admin()
    plan = await get_tenant_plan(tenant_id)
    max_contacts = plan["features"].get("max_contacts", 0)
    current = _count_contacts(sb, tenant_id)

    if max_contacts is not None and max_contacts < 0:
        return {"unlimited": True, "current": current, "max_contacts": max_contacts, "ceiling": None, "room": None}

    ceiling = math.floor(max_contacts * OVERAGE_TOLERANCE)
    room = max(0, ceiling - current)
    return {"unlimited": False, "current": current, "max_contacts": max_contacts, "ceiling": ceiling, "room": room}
