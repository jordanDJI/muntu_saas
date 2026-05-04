"""
Agent 3 — Assistant opérationnel du professionnel (Dashboard)

Workflow :
  Le professionnel envoie un message depuis son dashboard
  → construction du contexte (RDV à venir, leads récents, dernière synthèse)
  → appel LLM avec historique de la conversation
  → persistance des messages en base
  → retour de la réponse

La conversation est canal-agnostique : elle s'identifie par un conversation_id
que le frontend stocke en mémoire de session. Une même session persiste son
historique même si l'onglet est rechargé.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant
from app.models.agent import AssistantChatRequest, AssistantChatResponse
from app.services.llm import chat_completion

router = APIRouter(prefix="/assistant", tags=["assistant"])
logger = logging.getLogger(__name__)


@router.post("/chat", response_model=AssistantChatResponse)
async def assistant_chat(
    body: AssistantChatRequest,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()

    # Vérifier que l'agent 3 est actif
    cfg_res = (
        sb.table("agent_config")
        .select("status, model, system_prompt")
        .eq("tenant_id", tenant_id)
        .eq("agent_type", "assistant_tenant")
        .execute()
    )
    config = cfg_res.data[0] if cfg_res.data else {}
    if config.get("status") == "inactive":
        raise HTTPException(status_code=503, detail="Assistant désactivé")

    # Résoudre ou créer la conversation
    conv_id = await asyncio.to_thread(_resolve_conversation, sb, tenant_id, body.conversation_id)

    # Charger l'historique + ajouter le nouveau message
    history = await asyncio.to_thread(_load_history, sb, conv_id)
    history.append({"role": "user", "content": body.message})

    # Construire le prompt système avec le contexte opérationnel du tenant
    system_prompt = await asyncio.to_thread(_build_system_prompt, sb, tenant_id, config)

    # Appel LLM
    try:
        reply = await asyncio.to_thread(
            chat_completion,
            messages=history,
            model=config.get("model", "gemini-2.5-flash"),
            system_prompt=system_prompt,
        )
    except Exception as exc:
        logger.error("Agent 3 LLM error pour tenant %s : %s", tenant_id, exc)
        raise HTTPException(status_code=502, detail="Service IA temporairement indisponible")

    # Persister les deux messages en une seule insertion
    now_iso = datetime.now(timezone.utc).isoformat()
    sb.table("message").insert([
        {"conversation_id": conv_id, "sender_type": "user", "content": body.message, "sent_at": now_iso},
        {"conversation_id": conv_id, "sender_type": "assistant", "content": reply, "sent_at": now_iso},
    ]).execute()

    return AssistantChatResponse(reply=reply, conversation_id=conv_id)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resolve_conversation(sb, tenant_id: str, conv_id: str | None) -> str:
    """Valide le conv_id fourni ou crée une nouvelle conversation Agent 3."""
    if conv_id:
        check = (
            sb.table("conversation")
            .select("id")
            .eq("id", conv_id)
            .eq("tenant_id", tenant_id)
            .eq("agent_type", "assistant_tenant")
            .execute()
        )
        if check.data:
            return conv_id

    new = sb.table("conversation").insert({
        "tenant_id": tenant_id,
        "contact_id": None,
        "agent_type": "assistant_tenant",
        "channel": "dashboard",
        "metadata": {},
    }).execute()
    return new.data[0]["id"]


def _load_history(sb, conv_id: str, limit: int = 20) -> list[dict]:
    res = (
        sb.table("message")
        .select("sender_type, content")
        .eq("conversation_id", conv_id)
        .order("sent_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [
        {"role": "user" if m["sender_type"] == "user" else "assistant", "content": m["content"]}
        for m in reversed(res.data or [])
    ]


def _build_system_prompt(sb, tenant_id: str, config: dict) -> str:
    """Construit le prompt système enrichi avec le contexte métier du tenant."""
    if config.get("system_prompt"):
        return config["system_prompt"]

    _days_fr = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
    now = datetime.now(timezone.utc) + timedelta(hours=2)  # Europe/Brussels (CEST UTC+2)
    date_str = f"{_days_fr[now.weekday()].capitalize()} {now.strftime('%d/%m/%Y')} à {now.strftime('%H:%M')}"
    lines: list[str] = []

    # Identité du tenant
    tenant_res = sb.table("tenant").select("name, slug").eq("id", tenant_id).single().execute()
    tenant_name = tenant_res.data.get("name", "le professionnel") if tenant_res.data else "le professionnel"

    lines.append(
        f"Tu es l'assistant opérationnel de {tenant_name}. "
        "Tu l'aides à gérer son activité : rendez-vous, clients, planning, leads. "
        "Tu peux confirmer ou annuler des rendez-vous à la demande du professionnel. "
        "Réponds en français, sois concis et direct. "
        f"Date et heure actuelles : {date_str} (heure de Bruxelles). "
        "Utilise toujours cette date comme référence absolue."
    )

    cals = sb.table("calendar").select("id").eq("tenant_id", tenant_id).execute().data or []
    cal_ids = [c["id"] for c in cals]

    # RDVs en attente de confirmation (priorité haute)
    if cal_ids:
        pending = (
            sb.table("appointment")
            .select("id, scheduled_at, contact(first_name, last_name)")
            .in_("calendar_id", cal_ids)
            .eq("status", "pending")
            .order("scheduled_at")
            .limit(10)
            .execute()
        ).data or []

        if pending:
            lines.append("\n## Rendez-vous EN ATTENTE de confirmation")
            for a in pending:
                dt = datetime.fromisoformat(a["scheduled_at"].replace("Z", "+00:00"))
                contact = a.get("contact") or {}
                name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip() or "Contact inconnu"
                lines.append(f"- [ID:{a['id'][:8]}] {dt.strftime('%a %d/%m %H:%M')} — {name}")
            lines.append("  → Pour confirmer : dites 'confirme [prénom]'. Pour annuler : 'annule [prénom]'.")

    # Prochains RDVs confirmés (7 jours)
    if cal_ids:
        end_window = (now + timedelta(days=7)).isoformat()
        appts = (
            sb.table("appointment")
            .select("scheduled_at, contact(first_name, last_name)")
            .in_("calendar_id", cal_ids)
            .gte("scheduled_at", now.isoformat())
            .lte("scheduled_at", end_window)
            .eq("status", "confirmed")
            .order("scheduled_at")
            .limit(10)
            .execute()
        ).data or []

        if appts:
            lines.append("\n## Prochains rendez-vous confirmés (7 jours)")
            for a in appts:
                dt = datetime.fromisoformat(a["scheduled_at"].replace("Z", "+00:00"))
                contact = a.get("contact") or {}
                name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip() or "Contact inconnu"
                lines.append(f"- {dt.strftime('%a %d/%m %H:%M')} — {name}")

    # Leads récents (5 derniers)
    leads = (
        sb.table("lead")
        .select("status, contact(first_name, last_name), created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    ).data or []

    if leads:
        lines.append("\n## Leads récents")
        for ld in leads:
            contact = ld.get("contact") or {}
            name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip() or "Inconnu"
            lines.append(f"- {name} (statut : {ld.get('status', '?')})")

    # Conversations récentes Agent 2 avec les clients (5 dernières)
    convs = (
        sb.table("conversation")
        .select("id, contact(first_name, last_name), started_at")
        .eq("tenant_id", tenant_id)
        .eq("agent_type", "support_client")
        .is_("deleted_at", "null")
        .order("started_at", desc=True)
        .limit(5)
        .execute()
    ).data or []

    if convs:
        lines.append("\n## Conversations récentes Agent 2 (support client)")
        for conv in convs:
            contact = conv.get("contact") or {}
            name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip() or "Client inconnu"
            msgs = (
                sb.table("message")
                .select("sender_type, content")
                .eq("conversation_id", conv["id"])
                .order("sent_at", desc=True)
                .limit(4)
                .execute()
            ).data or []
            if msgs:
                lines.append(f"\n  Client : {name}")
                for m in reversed(msgs):
                    role = "Client" if m["sender_type"] == "user" else "Agent"
                    lines.append(f"    {role}: {m['content'][:200]}")

    # Dernière synthèse Worker 4
    synth = (
        sb.table("agent_synthesis")
        .select("content, period_end")
        .eq("tenant_id", tenant_id)
        .order("period_end", desc=True)
        .limit(1)
        .execute()
    ).data

    if synth:
        lines.append(f"\n## Dernière synthèse opérationnelle\n{synth[0]['content'][:600]}")

    return "\n".join(lines)
