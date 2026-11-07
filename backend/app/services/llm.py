import logging
import traceback
import time
from contextvars import ContextVar
from google import genai
from app.core.config import settings

logger = logging.getLogger(__name__)


# ── Consommation par tenant (migration 085) ───────────────────────────────────
# Posée par les points d'entrée (chatbot, agents, assistant, synthèse) plutôt que
# passée à chaque appel ; asyncio.to_thread propage le contexte au thread.
_ai_tenant: ContextVar[str | None] = ContextVar("ai_tenant", default=None)
_ai_feature: ContextVar[str] = ContextVar("ai_feature", default="other")


def set_ai_context(tenant_id: str | None, feature: str) -> None:
    """Rattache les appels Gemini qui suivent à ce tenant et à cette fonctionnalité."""
    _ai_tenant.set(tenant_id)
    _ai_feature.set(feature)


def _record_usage(resp) -> None:
    tenant_id = _ai_tenant.get()
    if not tenant_id:
        return
    meta = getattr(resp, "usage_metadata", None)
    try:
        from app.core.supabase import get_supabase_admin
        get_supabase_admin().rpc("record_ai_usage", {
            "p_tenant": tenant_id,
            "p_feature": _ai_feature.get(),
            "p_input": int(getattr(meta, "prompt_token_count", 0) or 0),
            "p_output": int(getattr(meta, "candidates_token_count", 0) or 0),
        }).execute()
    except Exception as exc:
        # Le comptage ne doit jamais faire échouer une réponse au client.
        logger.warning("Consommation IA non enregistrée (tenant %s) : %s", tenant_id, exc)

# Modèles retirés → remplacés automatiquement
_DEPRECATED_MODELS = {
    "gemini-2.0-flash":      "gemini-2.5-flash",
    "gemini-2.0-flash-lite": "gemini-2.5-flash",
    "gemini-1.5-flash":      "gemini-2.5-flash",
    "gemini-1.5-pro":        "gemini-2.5-pro",
}

_FALLBACK_SYSTEM = (
    "Tu es un assistant administratif. Réponds uniquement aux questions "
    "liées aux services, horaires et rendez-vous du professionnel. "
    "Tu ne fournis aucune information médicale ou hors de ton domaine. "
    "Sois concis, professionnel et bienveillant."
)


def _client() -> genai.Client:
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY non configurée")
    return genai.Client(api_key=settings.gemini_api_key)


def chat_completion(
    messages: list[dict],
    model: str = "gemini-2.5-flash",
    system_prompt: str | None = None,
) -> str:
    """Appel LLM synchrone — renvoie le texte de la réponse avec gestion de retry."""
    model = _DEPRECATED_MODELS.get(model, model)
    system = system_prompt or _FALLBACK_SYSTEM

    # Format dict simple — compatible avec toutes les versions du SDK google-genai
    contents = []
    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg["content"]}]})

    max_retries = 4
    for attempt in range(max_retries):
        try:
            resp = _client().models.generate_content(
                model=model,
                contents=contents,
                config={"system_instruction": system},
            )
            _record_usage(resp)
            return resp.text.strip()
        except Exception as exc:
            exc_str = str(exc)
            is_retryable = any(code in exc_str for code in ("429", "503", "RESOURCE_EXHAUSTED", "UNAVAILABLE"))

            if is_retryable and attempt < max_retries - 1:
                wait_time = (attempt + 1) * 5  # 5s, 10s, 15s
                logger.warning("Gemini indisponible (%s). Retry dans %ds...", exc_str[:60], wait_time)
                time.sleep(wait_time)
                continue

            logger.error("Gemini chat error [model=%s]: %s\n%s", model, exc, traceback.format_exc())
            raise


# Modèles en ordre de préférence : le fallback n'intervient qu'en cas d'erreur réelle
_SMART_FALLBACK_MODELS = [
    "gemini-2.0-flash-lite",  # rapide et léger
    "gemini-2.5-flash",       # équilibré
    "gemini-2.5-pro",         # puissant, dernier recours
]


def smart_chat_completion(
    messages: list[dict],
    system_prompt: str | None = None,
) -> str:
    """Essaie les modèles dans l'ordre (rapide → puissant).
    Passe au suivant uniquement sur erreur réelle (404, 429, 503…), pas sur lenteur."""
    system = system_prompt or _FALLBACK_SYSTEM
    contents = []
    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg["content"]}]})

    last_exc: Exception | None = None
    for model in _SMART_FALLBACK_MODELS:
        try:
            resp = _client().models.generate_content(
                model=model,
                contents=contents,
                config={"system_instruction": system},
            )
            _record_usage(resp)
            return resp.text.strip()
        except Exception as exc:
            last_exc = exc
            logger.warning("smart_chat: %s a échoué (%s) — essai modèle suivant", model, str(exc)[:100])
            continue

    if last_exc:
        raise last_exc
    raise RuntimeError("Tous les modèles LLM ont échoué.")


def summarize_conversations(raw_text: str, model: str = "gemini-2.5-flash") -> str:
    """Produit un résumé structuré d'un bloc de conversations pour le Worker 4."""
    system = "Tu es l'assistant de synthèse opérationnelle d'un professionnel de santé."
    prompt = (
        "Voici les conversations récentes entre des clients et l'assistant du professionnel. "
        "Produis un résumé concis en points clés : nouvelles demandes, RDV modifiés, "
        "questions récurrentes, actions requises par le professionnel.\n\n"
        f"{raw_text}"
    )
    return chat_completion(
        messages=[{"role": "user", "content": prompt}],
        model=model,
        system_prompt=system,
    )
