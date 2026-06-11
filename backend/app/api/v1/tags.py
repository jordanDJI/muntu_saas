"""
CRM — Tags (étiquettes colorées)
CRUD tags du tenant + liaison/déliaison contact ↔ tag.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant

router = APIRouter(tags=["Tags"])

ALLOWED_COLORS = {
    "blue", "green", "red", "orange", "purple",
    "pink", "teal", "amber", "gray", "indigo",
}


class TagCreate(BaseModel):
    name: str
    color: str = "blue"


class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


# ── Tags CRUD ─────────────────────────────────────────────────────────────────

@router.get("/tags")
async def list_tags(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()
    rows = (
        sb.table("contact_tag")
        .select("id, name, color, created_at")
        .eq("tenant_id", tenant_id)
        .order("name")
        .execute()
    ).data or []
    return rows


@router.post("/tags", status_code=201)
async def create_tag(body: TagCreate, tenant_id: str = Depends(get_current_tenant)):
    if body.color not in ALLOWED_COLORS:
        raise HTTPException(400, f"Couleur invalide. Valeurs acceptées : {', '.join(sorted(ALLOWED_COLORS))}")
    sb = get_supabase_admin()
    try:
        res = (
            sb.table("contact_tag")
            .insert({"tenant_id": tenant_id, "name": body.name.strip(), "color": body.color})
            .execute()
        )
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(409, "Un tag avec ce nom existe déjà")
        raise HTTPException(500, str(e))
    return res.data[0]


@router.patch("/tags/{tag_id}")
async def update_tag(
    tag_id: str,
    body: TagUpdate,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    updates: dict = {}
    if body.name is not None:
        updates["name"] = body.name.strip()
    if body.color is not None:
        if body.color not in ALLOWED_COLORS:
            raise HTTPException(400, f"Couleur invalide. Valeurs acceptées : {', '.join(sorted(ALLOWED_COLORS))}")
        updates["color"] = body.color
    if not updates:
        raise HTTPException(400, "Aucun champ à mettre à jour")
    res = (
        sb.table("contact_tag")
        .update(updates)
        .eq("id", tag_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Tag introuvable")
    return res.data[0]


@router.delete("/tags/{tag_id}", status_code=204)
async def delete_tag(tag_id: str, tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()
    res = (
        sb.table("contact_tag")
        .delete()
        .eq("id", tag_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Tag introuvable")


# ── Liaison contact ↔ tag ─────────────────────────────────────────────────────

@router.post("/contacts/{contact_id}/tags/{tag_id}", status_code=201)
async def add_tag_to_contact(
    contact_id: str,
    tag_id: str,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()

    # Vérifier que le contact et le tag appartiennent au tenant
    contact = (
        sb.table("contact")
        .select("id")
        .eq("id", contact_id)
        .eq("tenant_id", tenant_id)
        .single()
        .execute()
    ).data
    if not contact:
        raise HTTPException(404, "Contact introuvable")

    tag = (
        sb.table("contact_tag")
        .select("id")
        .eq("id", tag_id)
        .eq("tenant_id", tenant_id)
        .single()
        .execute()
    ).data
    if not tag:
        raise HTTPException(404, "Tag introuvable")

    try:
        sb.table("contact_tag_link").insert(
            {"contact_id": contact_id, "tag_id": tag_id}
        ).execute()
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            return {"ok": True, "already_linked": True}
        raise HTTPException(500, str(e))

    return {"ok": True}


@router.delete("/contacts/{contact_id}/tags/{tag_id}", status_code=204)
async def remove_tag_from_contact(
    contact_id: str,
    tag_id: str,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    sb.table("contact_tag_link").delete().eq("contact_id", contact_id).eq("tag_id", tag_id).execute()
