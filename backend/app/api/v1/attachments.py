"""
Pièces jointes par contact — stockage via Supabase Storage.
Limites plan : Pro 5 fichiers/contact · Business 10 fichiers/contact · 45 Mo max/fichier.
Bucket Supabase requis : 'contact-attachments' (privé, pas public).
"""
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant
from app.services.subscription import get_tenant_plan

router = APIRouter(prefix="/contacts", tags=["Attachments"])

BUCKET = "contact-attachments"
MAX_FILE_BYTES = 45 * 1024 * 1024  # 45 Mo


def _safe_filename(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._\-]", "_", name)[:120]


def _signed_url(sb, path: str) -> str:
    try:
        resp = sb.storage.from_(BUCKET).create_signed_url(path, 3600)
        return resp.get("signedURL") or resp.get("signed_url") or ""
    except Exception:
        return ""


def _assert_contact_belongs(sb, contact_id: str, tenant_id: str):
    res = sb.table("contact").select("id").eq("id", contact_id).eq("tenant_id", tenant_id).maybe_single().execute()
    if not res.data:
        raise HTTPException(404, "Contact introuvable")


@router.get("/{contact_id}/attachments")
async def list_attachments(
    contact_id: str,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    _assert_contact_belongs(sb, contact_id, tenant_id)

    rows = (
        sb.table("contact_attachment")
        .select("*")
        .eq("contact_id", contact_id)
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .execute()
    ).data or []

    return [{**r, "signed_url": _signed_url(sb, r["storage_path"])} for r in rows]


@router.post("/{contact_id}/attachments")
async def upload_attachment(
    contact_id: str,
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    _assert_contact_belongs(sb, contact_id, tenant_id)

    # Vérification plan
    plan = await get_tenant_plan(tenant_id)
    attachments_max: int = plan["features"].get("attachments_max", 0)
    if not attachments_max:
        raise HTTPException(403, "Les pièces jointes sont disponibles à partir du plan Pro.")

    # Comptage existant
    count_res = (
        sb.table("contact_attachment")
        .select("id", count="exact")
        .eq("contact_id", contact_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )
    if (count_res.count or 0) >= attachments_max:
        raise HTTPException(
            422,
            f"Limite atteinte : {attachments_max} pièce(s) jointe(s) maximum par contact pour votre plan.",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(400, "Fichier vide")
    if len(file_bytes) > MAX_FILE_BYTES:
        raise HTTPException(413, "Fichier trop volumineux (max 45 Mo)")

    safe_name = _safe_filename(file.filename or "fichier")
    storage_path = f"{tenant_id}/{contact_id}/{uuid.uuid4()}_{safe_name}"

    try:
        sb.storage.from_(BUCKET).upload(
            path=storage_path,
            file=file_bytes,
            file_options={
                "content-type": file.content_type or "application/octet-stream",
                "upsert": "false",
            },
        )
    except Exception as exc:
        raise HTTPException(500, f"Erreur de stockage : {exc}")

    row = (
        sb.table("contact_attachment")
        .insert({
            "tenant_id": tenant_id,
            "contact_id": contact_id,
            "file_name": file.filename or safe_name,
            "file_size": len(file_bytes),
            "mime_type": file.content_type,
            "storage_path": storage_path,
        })
        .execute()
    ).data[0]

    return {**row, "signed_url": _signed_url(sb, storage_path)}


@router.delete("/{contact_id}/attachments/{attachment_id}", status_code=204)
async def delete_attachment(
    contact_id: str,
    attachment_id: str,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    row = (
        sb.table("contact_attachment")
        .select("storage_path")
        .eq("id", attachment_id)
        .eq("contact_id", contact_id)
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    ).data
    if not row:
        raise HTTPException(404, "Pièce jointe introuvable")

    try:
        sb.storage.from_(BUCKET).remove([row["storage_path"]])
    except Exception:
        pass

    sb.table("contact_attachment").delete().eq("id", attachment_id).eq("tenant_id", tenant_id).execute()
