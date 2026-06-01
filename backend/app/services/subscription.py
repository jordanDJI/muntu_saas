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


TRIAL_DAYS = 14


def _apply_overrides(features: dict, overrides: list) -> dict:
    """Applique les tenant_feature_override sur le dict de features."""
    if not overrides:
        return features
    result = dict(features)
    for o in overrides:
        key = o.get("feature_key")
        if key in result and isinstance(result[key], bool):
            result[key] = o["enabled"]
    return result


async def get_tenant_plan(tenant_id: str) -> dict:
    from app.core.supabase import get_supabase_admin
    from datetime import datetime, timezone, timedelta

    sb = get_supabase_admin()

    # Overrides admin pour ce tenant (appliqués quelle que soit la source du plan)
    ov_res = sb.table("tenant_feature_override").select("feature_key, enabled").eq("tenant_id", tenant_id).execute()
    overrides = ov_res.data or []

    # 1. Abonnement actif ou en période de grâce Stripe
    res = (
        sb.table("subscription")
        .select("status, plan:plan_id(name, features)")
        .eq("tenant_id", tenant_id)
        .in_("status", ["active", "trialing"])
        .limit(1)
        .execute()
    )
    if res.data:
        row = res.data[0]
        plan = row["plan"]
        features = plan.get("features") or PLAN_FEATURES.get(plan["name"], ESSENTIEL_FEATURES)
        return {"plan_name": plan["name"], "status": row["status"], "features": _apply_overrides(features, overrides), "trial_days_left": None}

    # 2. Pas d'abonnement → vérifier la fenêtre d'essai
    tenant = sb.table("tenant").select("created_at, trial_extended_until").eq("id", tenant_id).maybe_single().execute()
    if tenant and tenant.data and tenant.data.get("created_at"):
        now = datetime.now(timezone.utc)

        # Utilise trial_extended_until si l'admin a étendu le trial
        ext = tenant.data.get("trial_extended_until")
        if ext:
            trial_end = datetime.fromisoformat(ext.replace("Z", "+00:00"))
            if trial_end.tzinfo is None:
                trial_end = trial_end.replace(tzinfo=timezone.utc)
        else:
            raw = tenant.data["created_at"]
            created_at = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            trial_end = created_at + timedelta(days=TRIAL_DAYS)

        if now < trial_end:
            days_left = max(1, (trial_end - now).days)
            return {
                "plan_name": "Essentiel",
                "status": "trial",
                "features": _apply_overrides(ESSENTIEL_FEATURES, overrides),
                "trial_days_left": days_left,
            }

        # Essai expiré — tout verrouillé (les overrides s'appliquent quand même)
        expired_features = {k: (False if isinstance(v, bool) else 0) for k, v in ESSENTIEL_FEATURES.items()}
        return {
            "plan_name": None,
            "status": "trial_expired",
            "features": _apply_overrides(expired_features, overrides),
            "trial_days_left": 0,
        }

    # Fallback
    return {"plan_name": "Essentiel", "status": "trial", "features": _apply_overrides(ESSENTIEL_FEATURES, overrides), "trial_days_left": TRIAL_DAYS}
