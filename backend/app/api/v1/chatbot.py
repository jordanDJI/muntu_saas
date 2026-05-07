"""
Agent 1 — Chatbot vitrine (endpoint public, sans auth)
Périmètre : FAQ tenant-specific + consultation/création de RDV.
Aucun accès aux données personnelles d'autres contacts.
"""
import asyncio
import uuid
import logging
from fastapi import APIRouter, HTTPException, status
from app.core.supabase import get_supabase_admin
from app.models.agent import ChatRequest, ChatResponse
from app.services.llm import chat_completion

router = APIRouter(prefix="/chatbot", tags=["chatbot"])
logger = logging.getLogger(__name__)

# Rate limiting : 15 messages max par session (en mémoire, reset au redémarrage)
_RATE_LIMIT = 15
_session_counts: dict[str, int] = {}

_RATE_LIMIT_REPLY = (
    "Vous avez atteint la limite de 15 questions pour cette session. "
    "Pour plus d'informations ou prendre rendez-vous, utilisez le formulaire de contact "
    "disponible sur cette page — nous vous répondrons rapidement."
)


def _build_context_block(site: dict) -> str:
    """Construit un bloc de contexte factuel à injecter dans tout prompt système."""
    lines: list[str] = []

    # Prestations
    offers = site.get("service_offer") or []
    if offers:
        lines.append("Prestations proposées :")
        for o in offers:
            name = o.get("name", "")
            parts = []
            if o.get("duration_min"):
                parts.append(f"{o['duration_min']} min")
            if o.get("price_eur"):
                parts.append(f"{o['price_eur']}€")
            desc = o.get("description", "")
            line = f"- {name}"
            if parts:
                line += f" ({', '.join(parts)})"
            if desc:
                line += f" : {desc}"
            lines.append(line)
    else:
        lines.append("Aucune prestation listée — inviter à contacter directement pour en savoir plus.")

    # Zones d'intervention
    zones = site.get("coverage_zones") or []
    if zones:
        lines.append(f"Zones d'intervention : {', '.join(zones)}")

    # Contact
    contact_parts = []
    if site.get("phone"):
        contact_parts.append(site["phone"])
    if site.get("email_contact"):
        contact_parts.append(site["email_contact"])
    if contact_parts:
        lines.append(f"Contact : {' | '.join(contact_parts)}")

    if site.get("address"):
        lines.append(f"Adresse : {site['address']}")

    return "\n".join(lines)


def _build_system_prompt(tenant_slug: str, site: dict, config: dict | None) -> str:
    """Construit le prompt système à partir des données publiques du tenant."""
    title = site.get("title", "ce professionnel")
    description = site.get("description", "")
    context_block = _build_context_block(site)

    base = config.get("system_prompt") if config and config.get("system_prompt") else None

    if base:
        # Prompt personnalisé : on y ajoute le contexte factuel pour ancrer le bot
        return (
            f"{base}\n\n"
            "--- INFORMATIONS SUR LES PRESTATIONS ET CONTACTS (utilise ces données pour répondre) ---\n"
            f"{context_block}\n"
            "--- FIN ---"
        )

    # Prompt auto-généré
    intro = f"Tu es l'assistant virtuel de {title}."
    if description:
        intro += f" {description}"

    return (
        f"{intro}\n\n"
        "Tu réponds uniquement aux questions relatives aux services proposés, "
        "aux horaires, aux zones d'intervention et à la prise de rendez-vous. "
        "Tu ne fournis aucune information médicale, personnelle ou hors de ce domaine. "
        "Sois concis, professionnel et bienveillant. "
        "IMPORTANT : réponds en texte simple, sans markdown, sans astérisques, sans puces avec *. "
        "Utilise des phrases courtes et claires. "
        "Si une question dépasse ton périmètre, invite l'utilisateur à contacter directement le professionnel.\n\n"
        "--- PRESTATIONS ET INFORMATIONS DE CONTACT ---\n"
        f"{context_block}\n"
        "--- FIN ---"
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
        .select("id, title, tagline, description, phone, email_contact, address, coverage_zones, absence_mode, service_offer(name, description, duration_min, price_eur)")
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
    session_id = body.session_id or str(uuid.uuid4())

    # Rate limiting
    _session_counts[session_id] = _session_counts.get(session_id, 0) + 1
    if _session_counts[session_id] > _RATE_LIMIT:
        return ChatResponse(reply=_RATE_LIMIT_REPLY, session_id=session_id)

    site, config = _get_public_context(tenant_slug)

    if config and config.get("status") == "inactive":
        raise HTTPException(status_code=503, detail="Chatbot désactivé par le professionnel")

    if site.get("absence_mode"):
        return ChatResponse(
            reply="Le professionnel est actuellement absent. Merci de rééssayer ultérieurement ou de laisser un message via le formulaire de contact.",
            session_id=session_id,
        )

    system_prompt = _build_system_prompt(tenant_slug, site, config)
    model = config.get("model", "gemini-2.5-flash") if config else "gemini-2.5-flash"

    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    try:
        reply = await asyncio.to_thread(chat_completion, messages=messages, model=model, system_prompt=system_prompt)
    except Exception as exc:
        logger.error("Chatbot LLM error for tenant %s: %s", tenant_slug, exc)
        raise HTTPException(status_code=502, detail="Service IA temporairement indisponible")

    return ChatResponse(reply=reply, session_id=session_id)
