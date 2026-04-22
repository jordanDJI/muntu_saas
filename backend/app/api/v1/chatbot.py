"""
Agent 1 — Chatbot vitrine (endpoint public, sans auth)
Périmètre : FAQ tenant-specific + consultation/création de RDV.
Aucun accès aux données personnelles d'autres contacts.
"""
import uuid
import logging
from fastapi import APIRouter, HTTPException, status
from app.core.supabase import get_supabase_admin
from app.models.agent import ChatRequest, ChatResponse
from app.services.llm import chat_completion

router = APIRouter(prefix="/chatbot", tags=["chatbot"])
logger = logging.getLogger(__name__)


def _build_system_prompt(tenant_slug: str, site: dict, config: dict | None) -> str:
    """Construit le prompt système à partir des données publiques du tenant."""
    if config and config.get("system_prompt"):
        return config["system_prompt"]

    title = site.get("title", "ce professionnel")
    return (
        f"Tu es l'assistant virtuel de {title}. "
        "Tu réponds uniquement aux questions relatives aux services proposés, "
        "aux horaires, aux zones d'intervention et à la prise de rendez-vous. "
        "Tu ne fournis aucune information médicale, personnelle ou hors de ce domaine. "
        "Sois concis, professionnel et bienveillant. "
        "IMPORTANT : réponds en texte simple, sans markdown, sans astérisques, sans puces avec *. "
        "Utilise des phrases courtes et claires. "
        "Si une question dépasse ton périmètre, invite l'utilisateur à contacter directement le professionnel."
    )


def _get_public_context(tenant_slug: str) -> tuple[dict, dict | None]:
    """Charge les données publiques du tenant (site + config agent vitrine)."""
    sb = get_supabase_admin()

    tenant_res = sb.table("tenant").select("id, name").eq("slug", tenant_slug).neq("is_active", False).single().execute()
    if not tenant_res.data:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    tenant = tenant_res.data

    site_res = (
        sb.table("site")
        .select("id, title, absence_mode, service_offer(name, description)")
        .eq("tenant_id", tenant["id"])
        .eq("status", "published")
        .single()
        .execute()
    )
    if not site_res.data:
        raise HTTPException(status_code=404, detail="Site non publié")

    config_res = (
        sb.table("agent_config")
        .select("system_prompt, model, status")
        .eq("tenant_id", tenant["id"])
        .eq("agent_type", "vitrine")
        .execute()
    )
    config = config_res.data[0] if config_res.data else None

    return site_res.data, config


@router.post("/{tenant_slug}", response_model=ChatResponse)
async def chat(tenant_slug: str, body: ChatRequest) -> ChatResponse:
    site, config = _get_public_context(tenant_slug)

    if config and config.get("status") == "inactive":
        raise HTTPException(status_code=503, detail="Chatbot désactivé par le professionnel")

    if site.get("absence_mode"):
        return ChatResponse(
            reply="Le professionnel est actuellement absent. Merci de rééssayer ultérieurement ou de laisser un message via le formulaire de contact.",
            session_id=body.session_id or str(uuid.uuid4()),
        )

    system_prompt = _build_system_prompt(tenant_slug, site, config)
    model = config.get("model", "gemini-2.5-flash") if config else "gemini-2.5-flash"

    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    try:
        reply = chat_completion(messages=messages, model=model, system_prompt=system_prompt)
    except Exception as exc:
        logger.error("Chatbot LLM error for tenant %s: %s", tenant_slug, exc)
        raise HTTPException(status_code=502, detail="Service IA temporairement indisponible")

    return ChatResponse(
        reply=reply,
        session_id=body.session_id or str(uuid.uuid4()),
    )
