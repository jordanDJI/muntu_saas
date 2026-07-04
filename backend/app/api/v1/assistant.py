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
from app.services.llm import smart_chat_completion

router = APIRouter(prefix="/assistant", tags=["assistant"])
logger = logging.getLogger(__name__)


@router.get("/history")
async def get_history(tenant_id: str = Depends(get_current_tenant)):
    """Retourne la conversation assistant_tenant la plus récente avec ses messages."""
    sb = get_supabase_admin()
    conv = (
        sb.table("conversation")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("agent_type", "assistant_tenant")
        .eq("channel", "dashboard")
        .order("started_at", desc=True)
        .limit(1)
        .execute()
    ).data
    if not conv:
        return {"conversation_id": None, "messages": []}
    conv_id = conv[0]["id"]
    messages = await asyncio.to_thread(_load_history, sb, conv_id, limit=50)
    return {"conversation_id": conv_id, "messages": messages}


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
            smart_chat_completion,
            messages=history,
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


_PROMPT_I18N: dict[str, dict] = {
    "fr": {
        "days": ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"],
        "at": "à",
        "unknown_pro": "le professionnel",
        "identity": (
            "Tu es l'assistant opérationnel de {name}. "
            "Tu l'aides à gérer son activité : rendez-vous, clients, planning, leads. "
            "Tu peux confirmer ou annuler des rendez-vous à la demande du professionnel. "
            "Réponds en français, sois concis et direct. "
            "Date et heure actuelles : {date_str} (heure de Bruxelles). "
            "Utilise toujours cette date comme référence absolue."
        ),
        "pending_header": "## Rendez-vous EN ATTENTE de confirmation",
        "pending_hint": "  → Pour confirmer : dites 'confirme [prénom]'. Pour annuler : 'annule [prénom]'.",
        "unknown_contact": "Contact inconnu",
        "confirmed_header": "## Prochains rendez-vous confirmés (7 jours)",
        "leads_header": "## Leads récents",
        "unknown": "Inconnu",
        "status_label": "statut",
        "convs_header": "## Conversations récentes Agent 2 (support client)",
        "unknown_client": "Client inconnu",
        "client_label": "Client",
        "agent_label": "Agent",
        "synth_header": "## Dernière synthèse opérationnelle",
        "sub_header": "## Abonnement",
        "plan_label": "Plan",
        "services_header": "## Services proposés",
        "contacts_header": "## Base clients",
        "contacts_total": "Total",
        "contacts_new_30d": "nouveaux ce mois",
        "analytics_header": "## Activité du site (7 derniers jours)",
        "pageviews_label": "Visites",
        "sessions_label": "Sessions uniques",
        "form_submits_label": "Formulaires soumis",
    },
    "en": {
        "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        "at": "at",
        "unknown_pro": "the professional",
        "identity": (
            "You are the operational assistant for {name}. "
            "You help manage their business: appointments, contacts, schedule, and leads. "
            "You can confirm or cancel appointments on the professional's request. "
            "Reply in English, be concise and direct. "
            "Current date and time: {date_str} (Brussels time). "
            "Always use this as your absolute reference."
        ),
        "pending_header": "## Appointments AWAITING confirmation",
        "pending_hint": "  → To confirm: say 'confirm [first name]'. To cancel: 'cancel [first name]'.",
        "unknown_contact": "Unknown contact",
        "confirmed_header": "## Upcoming confirmed appointments (7 days)",
        "leads_header": "## Recent leads",
        "unknown": "Unknown",
        "status_label": "status",
        "convs_header": "## Recent Agent 2 conversations (customer support)",
        "unknown_client": "Unknown client",
        "client_label": "Client",
        "agent_label": "Agent",
        "synth_header": "## Latest operational summary",
        "sub_header": "## Subscription",
        "plan_label": "Plan",
        "services_header": "## Services offered",
        "contacts_header": "## Client base",
        "contacts_total": "Total",
        "contacts_new_30d": "new this month",
        "analytics_header": "## Site activity (last 7 days)",
        "pageviews_label": "Page views",
        "sessions_label": "Unique sessions",
        "form_submits_label": "Form submissions",
    },
    "nl": {
        "days": ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"],
        "at": "om",
        "unknown_pro": "de professional",
        "identity": (
            "U bent de operationele assistent van {name}. "
            "U helpt bij het beheren van hun activiteit: afspraken, klanten, planning en leads. "
            "U kunt afspraken bevestigen of annuleren op verzoek van de professional. "
            "Antwoord in het Nederlands, wees beknopt en direct. "
            "Huidige datum en tijd: {date_str} (Brusselse tijd). "
            "Gebruik dit altijd als absolute referentie."
        ),
        "pending_header": "## Afspraken IN AFWACHTING van bevestiging",
        "pending_hint": "  → Om te bevestigen: zeg 'bevestig [voornaam]'. Om te annuleren: 'annuleer [voornaam]'.",
        "unknown_contact": "Onbekend contact",
        "confirmed_header": "## Komende bevestigde afspraken (7 dagen)",
        "leads_header": "## Recente leads",
        "unknown": "Onbekend",
        "status_label": "status",
        "convs_header": "## Recente Agent 2-gesprekken (klantenondersteuning)",
        "unknown_client": "Onbekende klant",
        "client_label": "Klant",
        "agent_label": "Agent",
        "synth_header": "## Laatste operationeel overzicht",
        "sub_header": "## Abonnement",
        "plan_label": "Plan",
        "services_header": "## Aangeboden diensten",
        "contacts_header": "## Klantenbestand",
        "contacts_total": "Totaal",
        "contacts_new_30d": "nieuw deze maand",
        "analytics_header": "## Siteactiviteit (laatste 7 dagen)",
        "pageviews_label": "Paginaweergaven",
        "sessions_label": "Unieke sessies",
        "form_submits_label": "Ingediende formulieren",
    },
    "de": {
        "days": ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
        "at": "um",
        "unknown_pro": "der Fachmann",
        "identity": (
            "Sie sind der operative Assistent von {name}. "
            "Sie helfen beim Verwalten der Aktivität: Termine, Kunden, Planung und Leads. "
            "Sie können Termine auf Anfrage des Fachmanns bestätigen oder absagen. "
            "Antworten Sie auf Deutsch, knapp und direkt. "
            "Aktuelles Datum und Uhrzeit: {date_str} (Brüsseler Zeit). "
            "Verwenden Sie dies immer als absolute Referenz."
        ),
        "pending_header": "## Termine WARTEN auf Bestätigung",
        "pending_hint": "  → Zum Bestätigen: sagen Sie 'bestätige [Vorname]'. Zum Absagen: 'absage [Vorname]'.",
        "unknown_contact": "Unbekannter Kontakt",
        "confirmed_header": "## Bevorstehende bestätigte Termine (7 Tage)",
        "leads_header": "## Aktuelle Leads",
        "unknown": "Unbekannt",
        "status_label": "Status",
        "convs_header": "## Aktuelle Agent-2-Gespräche (Kundensupport)",
        "unknown_client": "Unbekannter Kunde",
        "client_label": "Kunde",
        "agent_label": "Agent",
        "synth_header": "## Letzte operative Zusammenfassung",
        "sub_header": "## Abonnement",
        "plan_label": "Plan",
        "services_header": "## Angebotene Dienstleistungen",
        "contacts_header": "## Kundenstamm",
        "contacts_total": "Gesamt",
        "contacts_new_30d": "neu diesen Monat",
        "analytics_header": "## Website-Aktivität (letzte 7 Tage)",
        "pageviews_label": "Seitenaufrufe",
        "sessions_label": "Eindeutige Sitzungen",
        "form_submits_label": "Formularabsendungen",
    },
}


def _build_system_prompt(sb, tenant_id: str, config: dict) -> str:
    """Construit le prompt système enrichi avec le contexte métier du tenant."""
    if config.get("system_prompt"):
        return config["system_prompt"]

    # Langue configurée sur le site du tenant
    site_res = (
        sb.table("site")
        .select("id, default_language")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    )
    site_data = (site_res.data or [{}])[0]
    lang = site_data.get("default_language") or "fr"
    site_id = site_data.get("id")
    tr = _PROMPT_I18N.get(lang, _PROMPT_I18N["fr"])

    now = datetime.now(timezone.utc) + timedelta(hours=2)  # Europe/Brussels (CEST UTC+2)
    day_name = tr["days"][now.weekday()].capitalize()
    date_str = f"{day_name} {now.strftime('%d/%m/%Y')} {tr['at']} {now.strftime('%H:%M')}"
    lines: list[str] = []

    # Identité du tenant
    tenant_res = sb.table("tenant").select("name, slug").eq("id", tenant_id).single().execute()
    tenant_name = tenant_res.data.get("name", tr["unknown_pro"]) if tenant_res.data else tr["unknown_pro"]

    lines.append(tr["identity"].format(name=tenant_name, date_str=date_str))

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
            lines.append(f"\n{tr['pending_header']}")
            for a in pending:
                dt = datetime.fromisoformat(a["scheduled_at"].replace("Z", "+00:00"))
                contact = a.get("contact") or {}
                name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip() or tr["unknown_contact"]
                lines.append(f"- [ID:{a['id'][:8]}] {dt.strftime('%a %d/%m %H:%M')} — {name}")
            lines.append(tr["pending_hint"])

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
            lines.append(f"\n{tr['confirmed_header']}")
            for a in appts:
                dt = datetime.fromisoformat(a["scheduled_at"].replace("Z", "+00:00"))
                contact = a.get("contact") or {}
                name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip() or tr["unknown_contact"]
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
        lines.append(f"\n{tr['leads_header']}")
        for ld in leads:
            contact = ld.get("contact") or {}
            name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip() or tr["unknown"]
            lines.append(f"- {name} ({tr['status_label']} : {ld.get('status', '?')})")

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
        lines.append(f"\n{tr['convs_header']}")
        for conv in convs:
            contact = conv.get("contact") or {}
            name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip() or tr["unknown_client"]
            msgs = (
                sb.table("message")
                .select("sender_type, content")
                .eq("conversation_id", conv["id"])
                .order("sent_at", desc=True)
                .limit(4)
                .execute()
            ).data or []
            if msgs:
                lines.append(f"\n  {tr['client_label']} : {name}")
                for m in reversed(msgs):
                    role = tr["client_label"] if m["sender_type"] == "user" else tr["agent_label"]
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
        lines.append(f"\n{tr['synth_header']}\n{synth[0]['content'][:600]}")

    # Abonnement / plan
    sub_res = (
        sb.table("subscription")
        .select("status, plan_id")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    )
    if sub_res.data:
        sub = sub_res.data[0]
        lines.append(f"\n{tr['sub_header']}")
        lines.append(f"- {tr['plan_label']} : {sub.get('plan_id', '?')} | {tr['status_label']} : {sub.get('status', '?')}")

    # Services proposés (depuis le site)
    if site_id:
        offers = (
            sb.table("service_offer")
            .select("name, duration_min, price")
            .eq("site_id", site_id)
            .limit(10)
            .execute()
        ).data or []
        if offers:
            lines.append(f"\n{tr['services_header']}")
            for o in offers:
                price_str = f" — {o['price']} €" if o.get("price") else ""
                dur_str = f" ({o['duration_min']} min)" if o.get("duration_min") else ""
                lines.append(f"- {o['name']}{dur_str}{price_str}")

    # Stats contacts
    thirty_days_ago = (now - timedelta(days=30)).isoformat()
    total_c_res = (
        sb.table("contact")
        .select("id", count="exact")
        .eq("tenant_id", tenant_id)
        .execute()
    )
    new_c_res = (
        sb.table("contact")
        .select("id", count="exact")
        .eq("tenant_id", tenant_id)
        .gte("created_at", thirty_days_ago)
        .execute()
    )
    total_c = total_c_res.count or 0
    new_c = new_c_res.count or 0
    lines.append(f"\n{tr['contacts_header']}")
    lines.append(f"- {tr['contacts_total']} : {total_c} ({tr['contacts_new_30d']} : +{new_c})")

    # Analytics site (7 derniers jours) — dégrade si la table n'existe pas
    seven_days_ago = (now - timedelta(days=7)).isoformat()
    try:
        pv_res = (
            sb.table("site_event")
            .select("id", count="exact")
            .eq("tenant_id", tenant_id)
            .eq("event_type", "pageview")
            .gte("created_at", seven_days_ago)
            .execute()
        )
        sess_res = (
            sb.table("site_event")
            .select("session_id")
            .eq("tenant_id", tenant_id)
            .gte("created_at", seven_days_ago)
            .execute()
        )
        fs_res = (
            sb.table("site_event")
            .select("id", count="exact")
            .eq("tenant_id", tenant_id)
            .eq("event_type", "form_submit")
            .gte("created_at", seven_days_ago)
            .execute()
        )
        pageviews = pv_res.count or 0
        unique_sessions = len({s["session_id"] for s in (sess_res.data or []) if s.get("session_id")})
        form_submits = fs_res.count or 0
        lines.append(f"\n{tr['analytics_header']}")
        lines.append(f"- {tr['pageviews_label']} : {pageviews}")
        lines.append(f"- {tr['sessions_label']} : {unique_sessions}")
        lines.append(f"- {tr['form_submits_label']} : {form_submits}")
    except Exception:
        pass

    return "\n".join(lines)
