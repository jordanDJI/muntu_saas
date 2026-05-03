def ensure_lead(sb, tenant_id: str, contact_id: str, source: str) -> None:
    """Crée un lead pour ce contact s'il n'en a pas encore un dans ce tenant."""
    existing = (
        sb.table("lead")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("contact_id", contact_id)
        .execute()
    )
    if not existing.data:
        sb.table("lead").insert({
            "tenant_id": tenant_id,
            "contact_id": contact_id,
            "source": source,
            "status": "new",
            "audience_type": "b2c",
        }).execute()
