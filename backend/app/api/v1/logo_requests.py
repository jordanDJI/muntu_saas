import json
import re
import stripe
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant
from app.services import email as email_svc
from app.services.llm import chat_completion

router = APIRouter(prefix="/logo-requests", tags=["Logo Requests"])

stripe.api_key = settings.stripe_secret_key.strip() if settings.stripe_secret_key else ""

# ── Tarifs (moyennes marché européen) ────────────────────────────────────────

LOGO_TIERS: dict[str, dict] = {
    "essentiel": {
        "label": "Essentiel",
        "price_eur": 149.00,
        "price_cents": 14900,
        "deliverables": "1 concept · 2 variantes couleur · PNG + SVG · livré en 5 jours ouvrés",
    },
    "standard": {
        "label": "Standard",
        "price_eur": 299.00,
        "price_cents": 29900,
        "deliverables": "2 concepts · 3 variantes couleur · PNG + SVG + PDF · livré en 7 jours ouvrés",
    },
    "premium": {
        "label": "Premium",
        "price_eur": 499.00,
        "price_cents": 49900,
        "deliverables": "3 concepts + identité visuelle (palette + typo + guide) · tous formats · livré en 10 jours ouvrés",
    },
}

# ── Prompt système ───────────────────────────────────────────────────────────

_LANG_NAMES = {
    "fr": "French",
    "en": "English",
    "de": "German",
    "nl": "Dutch",
}

def _brief_system(lang: str) -> str:
    lang_name = _LANG_NAMES.get(lang, "French")
    return f"""
You are an assistant specialized in collecting briefs for professional logo creation.
Your goal: gather all necessary information in 5 to 8 natural, friendly questions.

Information to collect (in any order, following the conversation flow):
1. The business name or text to include in the logo
2. The industry and nature of the business
3. The desired style: modern/clean, classic/elegant, dynamic/colourful, minimalist, corporate, playful
4. Desired colours or moods (e.g. professional, warm, natural, premium, energetic)
5. Brand keywords or values (e.g. trust, expertise, innovation, proximity)
6. Target audience (individuals, professionals, young people, seniors, etc.)
7. Examples of logos they like — optional, only ask if it fits naturally in the conversation

Rules:
- Ask ONE question at a time, in a conversational way
- Be warm, professional and encourage detailed answers
- After collecting the essentials (5 to 8 exchanges), generate the brief summary
- Recommend a tier based on complexity: simple→essentiel, professional need→standard, full identity→premium
- When the brief is complete, end your message with exactly this block (no space before [BRIEF_COMPLET]):
[BRIEF_COMPLET]{{"sector":"...","business_name":"...","style":"...","colors":["..."],"keywords":["..."],"target":"...","notes":"...","recommended_tier":"standard"}}
- The JSON must be on a single line, no line breaks
- ALWAYS reply in {lang_name}
"""

# ── Schémas Pydantic ─────────────────────────────────────────────────────────

class ChatIn(BaseModel):
    messages: list[dict]  # [{role: "user"|"assistant", content: str}]
    lang: str = "fr"      # langue de l'UI ("fr", "en", "de", "nl")


class LogoRequestIn(BaseModel):
    brief: dict
    chat_history: list[dict]
    price_tier: str


class CheckoutIn(BaseModel):
    success_url: str
    cancel_url: str


class AdminUpdateIn(BaseModel):
    status: str | None = None
    admin_notes: str | None = None


# ── Endpoints tenant ─────────────────────────────────────────────────────────

@router.post("/chat")
async def logo_chat(body: ChatIn, tenant_id: str = Depends(get_current_tenant)):
    """Étape suivante de la conversation IA de brief logo."""
    # Convert to LLM format
    messages = [
        {"role": "user" if m["role"] == "user" else "assistant", "content": m["content"]}
        for m in body.messages
        if m.get("content", "").strip()
    ]

    try:
        reply = chat_completion(messages=messages, system_prompt=_brief_system(body.lang))
    except Exception:
        raise HTTPException(503, "Service IA temporairement indisponible — réessayez dans quelques secondes.")

    # Détecter fin de brief
    if "[BRIEF_COMPLET]" in reply:
        text_part = reply.split("[BRIEF_COMPLET]")[0].strip()
        json_part = reply.split("[BRIEF_COMPLET]")[1].strip()
        # Nettoyer les blocs markdown éventuels
        json_part = re.sub(r"```[a-z]*\n?|\n?```", "", json_part).strip()
        try:
            brief = json.loads(json_part)
            recommended_tier = brief.get("recommended_tier", "standard")
            if recommended_tier not in LOGO_TIERS:
                recommended_tier = "standard"
            return {
                "message": text_part or "Votre brief est maintenant complet ! Voici un résumé de ce que j'ai collecté.",
                "complete": True,
                "brief": brief,
                "recommended_tier": recommended_tier,
                "tiers": LOGO_TIERS,
            }
        except (json.JSONDecodeError, ValueError):
            pass  # fall through to normal response

    return {"message": reply, "complete": False}


@router.post("/")
async def create_logo_request(body: LogoRequestIn, tenant_id: str = Depends(get_current_tenant)):
    """Crée la demande de logo (avant paiement)."""
    if body.price_tier not in LOGO_TIERS:
        raise HTTPException(400, "Tier invalide")

    tier = LOGO_TIERS[body.price_tier]
    sb = get_supabase_admin()

    tenant = sb.table("tenant").select("name").eq("id", tenant_id).maybe_single().execute()
    tenant_name = (tenant.data or {}).get("name", "")

    row = sb.table("logo_request").insert({
        "tenant_id":    tenant_id,
        "tenant_name":  tenant_name,
        "brief":        body.brief,
        "chat_history": body.chat_history,
        "price_tier":   body.price_tier,
        "price_eur":    tier["price_eur"],
        "status":       "pending_payment",
    }).execute()

    req = row.data[0]

    try:
        email_svc.send_logo_request_admin(
            tenant_name=tenant_name,
            brief=body.brief,
            price_tier=body.price_tier,
            price_eur=tier["price_eur"],
            request_id=req["id"],
        )
    except Exception:
        pass  # non bloquant

    return req


@router.post("/{request_id}/checkout")
async def logo_checkout(request_id: str, body: CheckoutIn, tenant_id: str = Depends(get_current_tenant)):
    """Crée une session Stripe de paiement unique pour la demande de logo."""
    sb = get_supabase_admin()
    req = sb.table("logo_request").select("*").eq("id", request_id).eq("tenant_id", tenant_id).maybe_single().execute()
    if not req.data:
        raise HTTPException(404, "Demande introuvable")

    row = req.data
    if row["status"] not in ("pending_payment",):
        raise HTTPException(400, "Cette demande a déjà été payée ou annulée.")

    tier = LOGO_TIERS.get(row["price_tier"])
    if not tier:
        raise HTTPException(400, "Tier invalide")

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "unit_amount": tier["price_cents"],
                    "product_data": {
                        "name": f"Création de logo — {tier['label']}",
                        "description": tier["deliverables"],
                    },
                },
                "quantity": 1,
            }],
            success_url=body.success_url,
            cancel_url=body.cancel_url,
            metadata={
                "type":            "logo_request",
                "logo_request_id": request_id,
                "tenant_id":       tenant_id,
            },
        )
        # Enregistre l'ID de session
        sb.table("logo_request").update({"stripe_checkout_session_id": session.id}).eq("id", request_id).execute()
        return {"checkout_url": session.url}
    except stripe.error.AuthenticationError:
        raise HTTPException(503, "Paiement non configuré — contactez le support.")
    except stripe.error.StripeError as e:
        raise HTTPException(502, f"Erreur Stripe : {getattr(e, 'user_message', None) or str(e)}")


@router.get("/mine")
async def get_my_requests(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()
    res = sb.table("logo_request").select("*").eq("tenant_id", tenant_id).order("created_at", desc=True).execute()
    return res.data or []


# ── Endpoints admin ──────────────────────────────────────────────────────────

@router.get("/admin/all")
async def admin_list(status: str | None = None):
    from app.middleware.admin import get_current_admin
    sb = get_supabase_admin()
    q = sb.table("logo_request").select("*").order("created_at", desc=True)
    if status:
        q = q.eq("status", status)
    res = q.execute()
    return res.data or []


@router.patch("/admin/{request_id}")
async def admin_update(request_id: str, body: AdminUpdateIn):
    sb = get_supabase_admin()
    updates: dict = {}
    if body.status is not None:
        updates["status"] = body.status
        if body.status == "done":
            from datetime import datetime, timezone
            updates["delivered_at"] = datetime.now(timezone.utc).isoformat()
    if body.admin_notes is not None:
        updates["admin_notes"] = body.admin_notes
    if not updates:
        raise HTTPException(400, "Aucune mise à jour fournie")
    updates["updated_at"] = "now()"
    sb.table("logo_request").update(updates).eq("id", request_id).execute()
    return {"ok": True}
