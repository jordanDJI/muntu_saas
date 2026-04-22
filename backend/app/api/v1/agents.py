"""
Agents IA — endpoints authentifiés (tenant)
Couvre : agent_config, agent_link, ocr_summary, agent_synthesis
"""
import uuid
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from jose import jwt as jose_jwt

from app.core.config import settings
from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant
from app.models.agent import (
    AgentConfigOut,
    AgentConfigUpdate,
    AgentLinkCreate,
    AgentLinkOut,
    OCRSummaryOut,
    AgentSynthesisOut,
)
from app.services.ocr import extract_summary

router = APIRouter(prefix="/agents", tags=["agents"])
logger = logging.getLogger(__name__)

_AGENT_TYPES = {"vitrine", "support_client", "assistant_tenant"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _set_tenant(sb, tenant_id: str):
    sb.postgrest.auth(token=None)
    sb.postgrest.headers.update({"x-tenant-id": tenant_id})


def _require_config(sb, tenant_id: str, agent_type: str) -> dict:
    res = (
        sb.table("agent_config")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("agent_type", agent_type)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail=f"Config agent '{agent_type}' introuvable")
    return res.data


# ── agent_config ──────────────────────────────────────────────────────────────

@router.get("/config", response_model=list[AgentConfigOut])
async def list_agent_configs(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()
    res = sb.table("agent_config").select("*").eq("tenant_id", tenant_id).execute()
    return res.data or []


@router.get("/config/{agent_type}", response_model=AgentConfigOut)
async def get_agent_config(agent_type: str, tenant_id: str = Depends(get_current_tenant)):
    if agent_type not in _AGENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Type d'agent invalide : {agent_type}")
    sb = get_supabase_admin()
    return _require_config(sb, tenant_id, agent_type)


@router.patch("/config/{agent_type}", response_model=AgentConfigOut)
async def update_agent_config(
    agent_type: str,
    body: AgentConfigUpdate,
    tenant_id: str = Depends(get_current_tenant),
):
    if agent_type not in _AGENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Type d'agent invalide : {agent_type}")
    sb = get_supabase_admin()
    _require_config(sb, tenant_id, agent_type)

    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()

    res = (
        sb.table("agent_config")
        .update(patch)
        .eq("tenant_id", tenant_id)
        .eq("agent_type", agent_type)
        .execute()
    )
    return res.data[0]


# ── agent_link ────────────────────────────────────────────────────────────────

@router.post("/links", response_model=AgentLinkOut, status_code=status.HTTP_201_CREATED)
async def create_agent_link(
    body: AgentLinkCreate,
    tenant_id: str = Depends(get_current_tenant),
):
    if not settings.agent_link_secret:
        raise HTTPException(status_code=503, detail="AGENT_LINK_SECRET non configuré")

    sb = get_supabase_admin()

    contact_res = (
        sb.table("contact")
        .select("id")
        .eq("id", body.contact_id)
        .eq("tenant_id", tenant_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    if not contact_res.data:
        raise HTTPException(status_code=404, detail="Contact introuvable")

    expiry_days = body.expiry_days or settings.agent_link_expiry_days
    expires_at = datetime.now(timezone.utc) + timedelta(days=expiry_days)

    payload = {
        "contact_id": body.contact_id,
        "tenant_id": tenant_id,
        "channel": body.channel,
        "exp": int(expires_at.timestamp()),
        "jti": str(uuid.uuid4()),
    }
    token = jose_jwt.encode(payload, settings.agent_link_secret, algorithm="HS256")

    res = sb.table("agent_link").insert({
        "tenant_id": tenant_id,
        "contact_id": body.contact_id,
        "token": token,
        "channel": body.channel,
        "expires_at": expires_at.isoformat(),
    }).execute()

    return res.data[0]


@router.get("/links", response_model=list[AgentLinkOut])
async def list_agent_links(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()
    res = (
        sb.table("agent_link")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


# ── ocr_summary ───────────────────────────────────────────────────────────────

@router.post("/ocr", response_model=OCRSummaryOut, status_code=status.HTTP_201_CREATED)
async def upload_document_for_ocr(
    contact_id: str,
    file: UploadFile = File(...),
    appointment_id: str | None = None,
    tenant_id: str = Depends(get_current_tenant),
):
    """
    Reçoit un document, l'envoie à Mistral Vision pour OCR,
    stocke uniquement le résumé chiffré. Le fichier n'est jamais persisté.
    """
    if not settings.mistral_api_key:
        raise HTTPException(status_code=503, detail="Service OCR non configuré")

    sb = get_supabase_admin()

    contact_res = (
        sb.table("contact")
        .select("id")
        .eq("id", contact_id)
        .eq("tenant_id", tenant_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    if not contact_res.data:
        raise HTTPException(status_code=404, detail="Contact introuvable")

    content_type = file.content_type or "application/octet-stream"
    file_bytes = await file.read()

    try:
        summary_text = extract_summary(file_bytes, content_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("OCR failed for tenant %s: %s", tenant_id, exc)
        raise HTTPException(status_code=502, detail="Erreur OCR — réessayez")

    # Chiffrement du résumé via pgcrypto (encrypt côté SQL)
    # On passe le texte en clair ; RLS + pgcrypto chiffre at-rest.
    # Pour un chiffrement applicatif renforcé, utiliser Fernet ici.
    row = {
        "tenant_id": tenant_id,
        "contact_id": contact_id,
        "summary_encrypted": summary_text,
        "document_type": _guess_document_type(file.filename or ""),
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }
    if appointment_id:
        row["appointment_id"] = appointment_id

    res = sb.table("ocr_summary").insert(row).execute()
    return res.data[0]


def _guess_document_type(filename: str) -> str:
    name = filename.lower()
    if "ordonnance" in name or "prescription" in name:
        return "ordonnance"
    if "analyse" in name or "bilan" in name or "blood" in name:
        return "analyse_sang"
    if "radio" in name or "irm" in name or "scan" in name or "echo" in name:
        return "imagerie"
    return "autre"


@router.get("/ocr/{contact_id}", response_model=list[OCRSummaryOut])
async def list_ocr_summaries(contact_id: str, tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()
    res = (
        sb.table("ocr_summary")
        .select("id, contact_id, appointment_id, document_type, processed_at")
        .eq("tenant_id", tenant_id)
        .eq("contact_id", contact_id)
        .order("processed_at", desc=True)
        .execute()
    )
    return res.data or []


# ── agent_synthesis ───────────────────────────────────────────────────────────

@router.get("/synthesis", response_model=list[AgentSynthesisOut])
async def list_syntheses(limit: int = 10, tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()
    res = (
        sb.table("agent_synthesis")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []
