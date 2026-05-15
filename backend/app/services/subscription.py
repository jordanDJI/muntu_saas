ESSENTIEL_FEATURES: dict = {
    "max_contacts": 100,
    "max_team_members": 1,
    "analytics": False,
    "analytics_roi": False,
    "agent_vitrine": False,
    "agent_support": False,
    "agent_assistant": False,
    "multi_page_site": False,
    "multi_tenant": False,
    "booking": True,
    "crm": True,
    "custom_domain": False,
}

BUSINESS_FEATURES: dict = {
    "max_contacts": -1,
    "max_team_members": -1,
    "analytics": True,
    "analytics_roi": True,
    "agent_vitrine": True,
    "agent_support": True,
    "agent_assistant": True,
    "multi_page_site": True,
    "multi_tenant": True,
    "booking": True,
    "crm": True,
    "custom_domain": True,
}


PRO_FEATURES: dict = {
    "max_contacts": -1,
    "max_team_members": 1,
    "analytics": True,
    "analytics_roi": False,
    "agent_vitrine": True,
    "agent_support": True,
    "agent_assistant": False,
    "multi_page_site": True,
    "multi_tenant": False,
    "booking": True,
    "crm": True,
    "custom_domain": True,
}

PLAN_FEATURES: dict = {
    "Essentiel": ESSENTIEL_FEATURES,
    "Pro":       PRO_FEATURES,
    "Business":  BUSINESS_FEATURES,
}


async def get_tenant_plan(tenant_id: str) -> dict:
    from app.core.supabase import get_supabase_admin
    sb = get_supabase_admin()
    res = (
        sb.table("subscription")
        .select("status, plan:plan_id(name, features)")
        .eq("tenant_id", tenant_id)
        .in_("status", ["active", "trialing"])
        .limit(1)
        .execute()
    )
    if not res.data:
        return {"plan_name": "Essentiel", "status": "trial", "features": ESSENTIEL_FEATURES}
    row = res.data[0]
    plan = row["plan"]
    features = plan.get("features") or PLAN_FEATURES.get(plan["name"], ESSENTIEL_FEATURES)
    return {
        "plan_name": plan["name"],
        "status": row["status"],
        "features": features,
    }
