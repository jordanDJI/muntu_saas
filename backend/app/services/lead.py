def ensure_lead(
    sb,
    tenant_id: str,
    contact_id: str,
    source: str,
    status: str = "new",
    request_type: str = "b2c_appointment",
    notes: str | None = None,
) -> None:
    """Crée un lead pour chaque nouvelle demande/réservation de ce contact."""
    row = {
        "tenant_id": tenant_id,
        "contact_id": contact_id,
        "source": source,
        "status": status,
        "audience_type": "b2c",
        "request_type": request_type,
    }
    if notes:
        row["notes"] = notes
    sb.table("lead").insert(row).execute()
