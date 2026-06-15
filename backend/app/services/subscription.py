ESSENTIEL_FEATURES: dict = {
    "max_contacts": 100,
    "max_team_members": 1,
    "analytics": False,
    "analytics_roi": False,
    "agent_vitrine": True,
    "agent_support": False,
    "agent_assistant": False,
    "embed_widget": False,
    "custom_css": False,
    "multi_page_site": True,
    "multi_tenant": False,
    "booking": True,
    "crm": True,
    "custom_domain": False,
    "campaigns": False,
    "attachments_max": 0,
    "attachment_file_max_mb": 0,
    "gallery_photos_limit": 8,
}

BUSINESS_FEATURES: dict = {
    "max_contacts": -1,
    "max_team_members": -1,
    "max_tenants": 3,
    "analytics": True,
    "analytics_roi": True,
    "agent_vitrine": True,
    "agent_support": True,
    "agent_assistant": True,
    "embed_widget": True,
    "custom_css": True,
    "multi_page_site": True,
    "multi_tenant": True,
    "booking": True,
    "crm": True,
    "custom_domain": True,
    "campaigns": True,
    "attachments_max": 10,
    "attachment_file_max_mb": 45,
    "gallery_photos_limit": 24,
}


PRO_FEATURES: dict = {
    "max_contacts": 1000,
    "max_team_members": 1,
    "analytics": True,
    "analytics_roi": True,
    "agent_vitrine": True,
    "agent_support": True,
    "agent_assistant": True,
    "embed_widget": True,
    "custom_css": False,
    "multi_page_site": True,
    "multi_tenant": False,
    "booking": True,
    "crm": True,
    "custom_domain": True,
    "campaigns": True,
    "attachments_max": 5,
    "attachment_file_max_mb": 45,
    "gallery_photos_limit": 16,
}

PLAN_FEATURES: dict = {
    "Essentiel": ESSENTIEL_FEATURES,
    "Pro":       PRO_FEATURES,
    "Business":  BUSINESS_FEATURES,
}


TRIAL_DAYS = 14


def _apply_global_flags(features: dict, flags: list) -> dict:
    """Applique les feature_flag globaux sur le dict de features.
    Booléens : valeur du flag. Numériques (attachments_max, max_contacts…) : flag désactivé → 0 (kill switch)."""
    if not flags:
        return features
    result = dict(features)
    for f in flags:
        key = f.get("key")
        if key not in result:
            continue
        val = result[key]
        if isinstance(val, bool):
            result[key] = bool(f["enabled"])
        elif isinstance(val, (int, float)):
            if not f["enabled"]:
                result[key] = 0
    return result


def _apply_overrides(features: dict, overrides: list) -> dict:
    """Applique les tenant_feature_override. Priorité maximale — écrase flags globaux.
    Booléens : valeur de l'override.
    Numériques : value_int si défini, sinon enabled=False → 0 (kill switch)."""
    if not overrides:
        return features
    result = dict(features)
    for o in overrides:
        key = o.get("feature_key")
        if key not in result:
            continue
        val = result[key]
        if isinstance(val, bool):
            result[key] = bool(o["enabled"])
        elif isinstance(val, (int, float)):
            v = o.get("value_int")
            if v is not None:
                result[key] = int(v)
            elif not o["enabled"]:
                result[key] = 0
    return result


def _build_features(base: dict, global_flags: list, overrides: list) -> dict:
    """Pipeline complet : plan → flags globaux → overrides par tenant."""
    return _apply_overrides(_apply_global_flags(base, global_flags), overrides)


async def get_tenant_plan(tenant_id: str) -> dict:
    from app.core.supabase import get_supabase_admin
    from datetime import datetime, timezone, timedelta

    sb = get_supabase_admin()

    # Feature flags globaux (désactivent une feature pour tous les tenants)
    flags_res = sb.table("feature_flag").select("key, enabled").execute()
    global_flags = flags_res.data or []

    # Overrides par tenant (priorité maximale, écrase les flags globaux)
    ov_res = sb.table("tenant_feature_override").select("feature_key, enabled, value_int").eq("tenant_id", tenant_id).execute()
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
        hardcoded = PLAN_FEATURES.get(plan["name"], ESSENTIEL_FEATURES)
        base = {**hardcoded, **(plan.get("features") or {})}
        return {
            "plan_name": plan["name"],
            "status": row["status"],
            "features": _build_features(base, global_flags, overrides),
            "trial_days_left": None,
        }

    # 2. Pas d'abonnement → vérifier la fenêtre d'essai
    tenant = sb.table("tenant").select("created_at, trial_extended_until").eq("id", tenant_id).maybe_single().execute()
    if tenant and tenant.data and tenant.data.get("created_at"):
        now = datetime.now(timezone.utc)

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
                "features": _build_features(ESSENTIEL_FEATURES, global_flags, overrides),
                "trial_days_left": days_left,
            }

        # Essai expiré — tout verrouillé. Les flags globaux n'ont pas d'effet ici
        # (tout est déjà False), mais les overrides par tenant s'appliquent toujours.
        expired_features = {k: (False if isinstance(v, bool) else 0) for k, v in ESSENTIEL_FEATURES.items()}
        return {
            "plan_name": None,
            "status": "trial_expired",
            "features": _apply_overrides(expired_features, overrides),
            "trial_days_left": 0,
        }

    # Fallback
    return {
        "plan_name": "Essentiel",
        "status": "trial",
        "features": _build_features(ESSENTIEL_FEATURES, global_flags, overrides),
        "trial_days_left": TRIAL_DAYS,
    }
