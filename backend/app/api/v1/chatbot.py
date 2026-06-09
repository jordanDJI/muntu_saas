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

_CHAT_I18N: dict[str, dict] = {
    "fr": {
        "scope": (
            "Tu réponds uniquement aux questions relatives aux services proposés, "
            "aux horaires, aux zones d'intervention et à la prise de rendez-vous. "
            "Tu ne fournis aucune information médicale, personnelle ou hors de ce domaine. "
            "Sois concis, professionnel et bienveillant. "
            "IMPORTANT : réponds en texte simple, sans markdown, sans astérisques, sans puces avec *. "
            "Utilise des phrases courtes et claires. "
            "Si une question dépasse ton périmètre, invite l'utilisateur à contacter directement le professionnel."
        ),
        "custom_header":  "--- INFORMATIONS SUR LES PRESTATIONS ET CONTACTS ---",
        "auto_header":    "--- PRESTATIONS ET INFORMATIONS DE CONTACT ---",
        "end":            "--- FIN ---",
        "offers_intro":   "Prestations proposées :",
        "no_offers":      "Aucune prestation listée — inviter à contacter directement pour en savoir plus.",
        "zones_label":    "Zones d'intervention",
        "contact_label":  "Contact",
        "address_label":  "Adresse",
        "rate_limit": (
            "Vous avez atteint la limite de 15 questions pour cette session. "
            "Pour plus d'informations ou prendre rendez-vous, utilisez le formulaire de contact "
            "disponible sur cette page — nous vous répondrons rapidement."
        ),
        "absence": "Le professionnel est actuellement absent. Merci de réessayer ultérieurement ou de laisser un message via le formulaire de contact.",
    },
    "en": {
        "scope": (
            "You only answer questions about the services offered, "
            "opening hours, coverage areas and appointment booking. "
            "You do not provide medical, personal or off-topic information. "
            "Be concise, professional and friendly. "
            "IMPORTANT: reply in plain text only — no markdown, no asterisks, no bullet points with *. "
            "Use short, clear sentences. "
            "If a question is outside your scope, invite the user to contact the professional directly."
        ),
        "custom_header":  "--- SERVICE AND CONTACT INFORMATION ---",
        "auto_header":    "--- SERVICES AND CONTACT INFORMATION ---",
        "end":            "--- END ---",
        "offers_intro":   "Services offered:",
        "no_offers":      "No services listed — invite the visitor to get in touch directly for more information.",
        "zones_label":    "Coverage areas",
        "contact_label":  "Contact",
        "address_label":  "Address",
        "rate_limit": (
            "You have reached the limit of 15 questions for this session. "
            "For more information or to book an appointment, please use the contact form "
            "on this page — we will get back to you shortly."
        ),
        "absence": "The professional is currently unavailable. Please try again later or leave a message via the contact form.",
    },
    "de": {
        "scope": (
            "Sie beantworten ausschließlich Fragen zu den angebotenen Leistungen, "
            "Öffnungszeiten, Einzugsgebieten und Terminvereinbarungen. "
            "Sie stellen keine medizinischen, persönlichen oder themenfremden Informationen bereit. "
            "Seien Sie prägnant, professionell und freundlich. "
            "WICHTIG: Antworten Sie nur in einfachem Text — kein Markdown, keine Sternchen, keine Aufzählungszeichen mit *. "
            "Verwenden Sie kurze, klare Sätze. "
            "Falls eine Frage Ihren Bereich überschreitet, bitten Sie den Nutzer, den Fachmann direkt zu kontaktieren."
        ),
        "custom_header":  "--- LEISTUNGS- UND KONTAKTINFORMATIONEN ---",
        "auto_header":    "--- LEISTUNGEN UND KONTAKTINFORMATIONEN ---",
        "end":            "--- ENDE ---",
        "offers_intro":   "Angebotene Leistungen:",
        "no_offers":      "Keine Leistungen aufgeführt — Besucher direkt zum Kontakt einladen.",
        "zones_label":    "Einzugsgebiete",
        "contact_label":  "Kontakt",
        "address_label":  "Adresse",
        "rate_limit": (
            "Sie haben das Limit von 15 Fragen für diese Sitzung erreicht. "
            "Für weitere Informationen oder einen Termin nutzen Sie bitte das Kontaktformular "
            "auf dieser Seite — wir melden uns schnellstmöglich."
        ),
        "absence": "Der Fachmann ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut oder hinterlassen Sie eine Nachricht über das Kontaktformular.",
    },
    "nl": {
        "scope": (
            "U beantwoordt uitsluitend vragen over de aangeboden diensten, "
            "openingstijden, werkgebieden en het maken van afspraken. "
            "U verstrekt geen medische, persoonlijke of buiten het onderwerp vallende informatie. "
            "Wees beknopt, professioneel en vriendelijk. "
            "BELANGRIJK: antwoord alleen in gewone tekst — geen markdown, geen sterretjes, geen opsommingstekens met *. "
            "Gebruik korte, duidelijke zinnen. "
            "Als een vraag buiten uw bereik valt, nodig de gebruiker dan uit om de professional rechtstreeks te contacteren."
        ),
        "custom_header":  "--- DIENST- EN CONTACTINFORMATIE ---",
        "auto_header":    "--- DIENSTEN EN CONTACTINFORMATIE ---",
        "end":            "--- EINDE ---",
        "offers_intro":   "Aangeboden diensten:",
        "no_offers":      "Geen diensten vermeld — bezoeker uitnodigen om rechtstreeks contact op te nemen.",
        "zones_label":    "Werkgebieden",
        "contact_label":  "Contact",
        "address_label":  "Adres",
        "rate_limit": (
            "U heeft de limiet van 15 vragen voor deze sessie bereikt. "
            "Voor meer informatie of een afspraak kunt u het contactformulier "
            "op deze pagina gebruiken — we reageren zo snel mogelijk."
        ),
        "absence": "De professional is momenteel niet beschikbaar. Probeer het later opnieuw of laat een bericht achter via het contactformulier.",
    },
}


def _build_context_block(site: dict, tr: dict) -> str:
    """Construit un bloc de contexte factuel à injecter dans tout prompt système."""
    lines: list[str] = []

    offers = site.get("service_offer") or []
    if offers:
        lines.append(tr["offers_intro"])
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
        lines.append(tr["no_offers"])

    zones = site.get("coverage_zones") or []
    if zones:
        lines.append(f"{tr['zones_label']} : {', '.join(zones)}")

    contact_parts = []
    if site.get("phone"):
        contact_parts.append(site["phone"])
    if site.get("email_contact"):
        contact_parts.append(site["email_contact"])
    if contact_parts:
        lines.append(f"{tr['contact_label']} : {' | '.join(contact_parts)}")

    if site.get("address"):
        lines.append(f"{tr['address_label']} : {site['address']}")

    return "\n".join(lines)


def _build_system_prompt(tenant_slug: str, site: dict, config: dict | None) -> str:
    """Construit le prompt système à partir des données publiques du tenant."""
    lang = site.get("default_language") or "fr"
    tr = _CHAT_I18N.get(lang, _CHAT_I18N["fr"])

    title = site.get("title", "…")
    description = site.get("description", "")
    context_block = _build_context_block(site, tr)

    base = config.get("system_prompt") if config and config.get("system_prompt") else None

    if base:
        return (
            f"{base}\n\n"
            f"{tr['custom_header']}\n"
            f"{context_block}\n"
            f"{tr['end']}"
        )

    intro = f"You are the virtual assistant of {title}."
    if description:
        intro += f" {description}"

    return (
        f"{intro}\n\n"
        f"{tr['scope']}\n\n"
        f"{tr['auto_header']}\n"
        f"{context_block}\n"
        f"{tr['end']}"
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
        .select("id, title, tagline, description, phone, email_contact, address, coverage_zones, default_language, absence_mode, service_offer(name, description, duration_min, price_eur)")
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

    site, config = _get_public_context(tenant_slug)
    lang = site.get("default_language") or "fr"
    tr = _CHAT_I18N.get(lang, _CHAT_I18N["fr"])

    # Rate limiting
    _session_counts[session_id] = _session_counts.get(session_id, 0) + 1
    if _session_counts[session_id] > _RATE_LIMIT:
        return ChatResponse(reply=tr["rate_limit"], session_id=session_id)

    if config and config.get("status") == "inactive":
        raise HTTPException(status_code=503, detail="Chatbot désactivé par le professionnel")

    if site.get("absence_mode"):
        return ChatResponse(reply=tr["absence"], session_id=session_id)

    system_prompt = _build_system_prompt(tenant_slug, site, config)
    model = config.get("model", "gemini-2.5-flash") if config else "gemini-2.5-flash"

    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    try:
        reply = await asyncio.to_thread(chat_completion, messages=messages, model=model, system_prompt=system_prompt)
    except Exception as exc:
        logger.error("Chatbot LLM error for tenant %s: %s", tenant_slug, exc)
        raise HTTPException(status_code=502, detail="Service IA temporairement indisponible")

    return ChatResponse(reply=reply, session_id=session_id)
