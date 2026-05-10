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
}


async def get_tenant_plan(_tenant_id: str) -> dict:
    """Return plan name, status and features for a tenant.
    TODO: query subscription table once Stripe + migration 019 are applied.
    Until then every tenant gets Business (trial) access."""
    return {
        "plan_name": "Business",
        "status": "trial",
        "features": BUSINESS_FEATURES,
    }
