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


# ── Setup Telegram webhook ────────────────────────────────────────────────────

@router.get("/telegram/info")
async def get_telegram_bot_info(tenant_id: str = Depends(get_current_tenant)):
    """
    Retourne le username du bot Telegram configuré pour ce tenant.
    Utilisé par le dashboard pour construire les liens d'invitation et d'activation.
    """
    from app.services.telegram import get_bot_info

    sb = get_supabase_admin()
    cfg = _require_config(sb, tenant_id, "support_client")
    bot_token = cfg.get("telegram_bot_token", "")
    if not bot_token:
        raise HTTPException(status_code=404, detail="Aucun bot token Telegram configuré")

    info = get_bot_info(bot_token)
    username = info.get("username", "")
    activate_url = (
        f"https://t.me/{username}?start=notify_{tenant_id}" if username else ""
    )
    return {"username": username, "activate_url": activate_url}


@router.post("/telegram/setup")
async def setup_telegram_webhook(tenant_id: str = Depends(get_current_tenant)):
    """
    Enregistre le webhook Telegram pour le bot configuré sur ce tenant.
    En local : APP_URL doit pointer vers le tunnel ngrok (https://…ngrok-free.app).
    En prod   : APP_URL est l'URL publique du backend, posée via les env vars de la plateforme.
    """
    from app.services.telegram import register_webhook, get_bot_info

    sb = get_supabase_admin()
    cfg = _require_config(sb, tenant_id, "support_client")
    bot_token = cfg.get("telegram_bot_token", "")
    if not bot_token:
        raise HTTPException(status_code=400, detail="Aucun bot token Telegram configuré")

    if not settings.app_url.startswith("https://"):
        raise HTTPException(
            status_code=400,
            detail=(
                f"APP_URL doit être une URL HTTPS publique (valeur actuelle : '{settings.app_url}'). "
                "En local, lancez ngrok (`ngrok http 8000`) et mettez l'URL ngrok dans APP_URL du .env, "
                "puis redémarrez le backend."
            ),
        )

    webhook_url = f"{settings.app_url}/api/v1/webhook/telegram/{bot_token}"
    logger.info("Telegram webhook setup — URL : %s (token masqué)", webhook_url.rsplit("/", 1)[0] + "/***")

    # Dériver un secret_token depuis le bot_token pour que Telegram signe ses updates
    import hmac as _hmac, hashlib as _hashlib
    _secret = settings.agent_link_secret or settings.secret_key
    webhook_secret = _hmac.new(
        _secret.encode(), bot_token.encode(), _hashlib.sha256
    ).hexdigest()[:64]

    ok, err = register_webhook(bot_token, webhook_url, secret_token=webhook_secret)
    if not ok:
        detail = f"Échec Telegram : {err}" if err else "Échec de l'enregistrement du webhook Telegram"
        raise HTTPException(status_code=502, detail=detail)

    info = get_bot_info(bot_token)
    return {"status": "ok", "webhook_url": webhook_url, "bot_username": info.get("username", "")}

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

_DEFAULT_AGENT_TYPES = ["vitrine", "support_client", "assistant_tenant"]


@router.get("/config", response_model=list[AgentConfigOut])
async def list_agent_configs(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()
    res = sb.table("agent_config").select("*").eq("tenant_id", tenant_id).execute()
    configs = res.data or []

    # Auto-création pour les tenants qui ont été créés avant cette fonctionnalité
    existing_types = {c["agent_type"] for c in configs}
    missing = [t for t in _DEFAULT_AGENT_TYPES if t not in existing_types]
    if missing:
        new_rows = [
            {"tenant_id": tenant_id, "agent_type": t, "status": "active", "model": "gemini-2.5-flash"}
            for t in missing
        ]
        created = sb.table("agent_config").insert(new_rows).execute()
        configs = configs + (created.data or [])

    # Migration : si le token Telegram est dans support_client mais pas dans assistant_tenant,
    # le copier automatiquement (avant le déplacement du champ vers Agent 3 dans l'UI)
    sc = next((c for c in configs if c["agent_type"] == "support_client"), None)
    at = next((c for c in configs if c["agent_type"] == "assistant_tenant"), None)
    if sc and at and sc.get("telegram_bot_token") and not at.get("telegram_bot_token"):
        sb.table("agent_config").update({"telegram_bot_token": sc["telegram_bot_token"]}).eq(
            "tenant_id", tenant_id
        ).eq("agent_type", "assistant_tenant").execute()
        at["telegram_bot_token"] = sc["telegram_bot_token"]

    return configs


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

    # Le bot Telegram est configuré dans l'Agent 3 (assistant_tenant) mais utilisé
    # aussi par l'Agent 2 (support_client). On synchronise le token dans les deux sens.
    if agent_type == "assistant_tenant" and "telegram_bot_token" in patch:
        sb.table("agent_config").update({
            "telegram_bot_token": patch["telegram_bot_token"],
            "updated_at": patch["updated_at"],
        }).eq("tenant_id", tenant_id).eq("agent_type", "support_client").execute()

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
    Reçoit un document, l'envoie à Gemini Vision pour OCR,
    stocke uniquement le résumé chiffré. Le fichier n'est jamais persisté.
    """
    if not settings.gemini_api_key:
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


# ── RAG — base documentaire Agent 2 ──────────────────────────────────────────

@router.post("/rag/upload")
async def upload_rag_document(
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_current_tenant),
):
    """Upload, découpe et indexe un document dans la base RAG de l'Agent 2."""
    from app.services.embeddings import generate_embedding, chunk_text

    sb = get_supabase_admin()

    file_bytes = await file.read()
    content_type = file.content_type or "application/octet-stream"
    filename = (file.filename or "document").strip()

    try:
        full_text = extract_summary(file_bytes, content_type)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Impossible d'extraire le texte : {exc}")

    if not full_text.strip():
        raise HTTPException(status_code=400, detail="Le document ne contient pas de texte extractible.")

    # Supprimer les chunks existants pour ce fichier (ré-indexation)
    sb.table("agent_document").delete().eq("tenant_id", tenant_id).eq("filename", filename).execute()

    chunks = chunk_text(full_text)
    if not chunks:
        raise HTTPException(status_code=400, detail="Aucun contenu exploitable dans le document.")

    rows = []
    for chunk in chunks:
        try:
            embedding = generate_embedding(chunk)
        except Exception as exc:
            logger.warning("Embedding échoué pour un chunk de '%s': %s", filename, exc)
            embedding = None
        rows.append({
            "tenant_id": tenant_id,
            "agent_type": "support_client",
            "filename": filename,
            "content": chunk,
            "embedding": embedding,
            "metadata": {"total_chunks": len(chunks)},
        })

    sb.table("agent_document").insert(rows).execute()

    return {"filename": filename, "chunks": len(rows), "status": "indexed"}


@router.get("/rag/documents")
async def list_rag_documents(tenant_id: str = Depends(get_current_tenant)):
    """Liste les documents indexés (dédupliqués par nom de fichier)."""
    sb = get_supabase_admin()
    res = (
        sb.table("agent_document")
        .select("filename, created_at")
        .eq("tenant_id", tenant_id)
        .eq("agent_type", "support_client")
        .order("created_at", desc=True)
        .execute()
    )
    seen: dict[str, dict] = {}
    for row in (res.data or []):
        fn = row["filename"]
        if fn not in seen:
            seen[fn] = {"filename": fn, "chunks": 0, "created_at": row["created_at"]}
        seen[fn]["chunks"] += 1
    return list(seen.values())


@router.delete("/rag/documents")
async def delete_rag_document(filename: str, tenant_id: str = Depends(get_current_tenant)):
    """Supprime tous les chunks d'un document par nom de fichier."""
    sb = get_supabase_admin()
    sb.table("agent_document").delete().eq("tenant_id", tenant_id).eq("filename", filename).execute()
    return {"deleted": True}


# ── Follow-up post-intervention ───────────────────────────────────────────────

@router.post("/followup/{appt_id}")
async def send_appointment_followup(appt_id: str, tenant_id: str = Depends(get_current_tenant)):
    """Envoie le message de suivi post-RDV au client via son canal de messagerie."""
    sb = get_supabase_admin()

    # Config follow-up
    cfg_res = (
        sb.table("agent_config")
        .select("followup_enabled, followup_message, telegram_bot_token, status")
        .eq("tenant_id", tenant_id)
        .eq("agent_type", "support_client")
        .execute()
    )
    cfg = (cfg_res.data or [{}])[0]
    if not cfg.get("followup_enabled"):
        raise HTTPException(status_code=400, detail="Le suivi automatique n'est pas activé.")

    message_tpl = (
        cfg.get("followup_message")
        or "Bonjour {prenom}, comment s'est passée votre intervention ? N'hésitez pas si vous avez des questions."
    )

    # RDV — vérification appartenance tenant
    cal_res = sb.table("calendar").select("id").eq("tenant_id", tenant_id).execute()
    cal_ids = [c["id"] for c in (cal_res.data or [])]
    if not cal_ids:
        raise HTTPException(status_code=404, detail="Calendrier introuvable")

    appt_res = (
        sb.table("appointment")
        .select("contact_id, status")
        .eq("id", appt_id)
        .in_("calendar_id", cal_ids)
        .single()
        .execute()
    )
    if not appt_res.data:
        raise HTTPException(status_code=404, detail="RDV introuvable")

    contact_id = appt_res.data.get("contact_id")
    if not contact_id:
        raise HTTPException(status_code=400, detail="Ce RDV n'a pas de contact associé.")

    contact_res = (
        sb.table("contact")
        .select("first_name, telegram_chat_id, phone")
        .eq("id", contact_id)
        .single()
        .execute()
    )
    contact = contact_res.data or {}
    first_name = contact.get("first_name") or ""
    personalized = message_tpl.replace("{prenom}", first_name).replace("{nom}", first_name)

    sent_via = None

    tg_chat_id = contact.get("telegram_chat_id")
    bot_token = cfg.get("telegram_bot_token", "")
    if tg_chat_id and bot_token and cfg.get("status") == "active":
        try:
            from app.services.telegram import send_message
            send_message(bot_token, tg_chat_id, personalized)
            sent_via = "telegram"
        except Exception as exc:
            logger.warning("Suivi Telegram échoué pour appt %s: %s", appt_id, exc)

    if not sent_via and contact.get("phone"):
        try:
            from app.services.whatsapp import send_text
            send_text(contact["phone"], personalized)
            sent_via = "whatsapp"
        except Exception as exc:
            logger.warning("Suivi WhatsApp échoué pour appt %s: %s", appt_id, exc)

    if not sent_via:
        raise HTTPException(
            status_code=400,
            detail="Le client n'a pas de canal de messagerie configuré (Telegram ou WhatsApp requis)."
        )

    return {"sent": True, "channel": sent_via}


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
