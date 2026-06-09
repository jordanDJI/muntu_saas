"""
Agent 2 — Support client WhatsApp / Telegram
Agent 3 — Assistant professionnel Telegram (routage par chat_id)

Webhook 360dialog (format Meta Cloud API) pour WhatsApp.
Webhook Telegram pour les deux canaux.
"""
import asyncio
import logging
import re
from datetime import datetime, timedelta, timezone, time as dtime, date as ddate

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import PlainTextResponse

from app.core.config import settings
from app.core.supabase import get_supabase_admin
from app.services.llm import chat_completion
from app.services.ocr import extract_summary
from app.services.whatsapp import download_media, send_text, verify_signature

router = APIRouter(prefix="/webhook", tags=["webhook"])
logger = logging.getLogger(__name__)


# ── Prompt injection guard ────────────────────────────────────────────────────

_INJECTION_RE = re.compile(
    r"(ignore\s+(les?\s+)?instructions?|oublie\s+(les?\s+)?instructions?|"
    r"ignore\s+previous\s+instructions?|disregard\s+previous|new\s+persona|"
    r"<\s*system\s*>|\[INST\]|###\s*(system|instruction)|"
    r"r[eé]v[eè]le\s+(le\s+)?prompt|affiche\s+(le\s+)?prompt|"
    r"r[eé]p[eè]te\s+(tes?\s+)?instructions?|what\s+are\s+your\s+instructions?)",
    re.IGNORECASE,
)
_MAX_USER_INPUT = 4000


def _sanitize_input(text: str) -> str:
    """Tronque et neutralise les tentatives de prompt injection."""
    text = text[:_MAX_USER_INPUT]
    if _INJECTION_RE.search(text):
        logger.warning("Prompt injection détectée, message neutralisé")
        return "[Message non conforme aux règles d'utilisation]"
    return text

# ── Regex ─────────────────────────────────────────────────────────────────────

_BOOKING_RE = re.compile(
    r"\b(prendre.*rendez|r[eé]server.*rdv|r[eé]server.*rendez|fixer.*rendez|nouveau.*rdv|"
    r"prendre.*rdv|booker|book.*appointment|schedule.*appointment|je veux.*rdv|"
    r"prendre.*rendez.vous|prendre.*cr[eé]neau|"
    r"un\s+rendez.?vous|un\s+rdv|une\s+consultation|"
    r"rendez.?vous.*pour|rdv.*pour|consultation.*pour|"
    r"voudrais.*rdv|voudrais.*rendez|souhaite.*rdv|souhaite.*rendez|"
    r"avoir.*rdv|avoir.*rendez|fixer.*cr[eé]neau|prendre.*consultation|"
    r"cr[eé]neau.*disponible|disponibilit[eé]s?|quand.*disponible|"
    r"rendez.?vous.*demain|rdv.*demain|rdv.*lundi|rdv.*mardi|rdv.*mercredi|"
    r"rdv.*jeudi|rdv.*vendredi|rdv.*samedi|rendez.?vous.*le\s+\d)\b",
    re.IGNORECASE,
)

_BOOKING_CONTEXT_RE = re.compile(
    r"\b(rendez.?vous|rdv|cr[eé]neau|consultation|disponib|r[eé]server|"
    r"planifier|demain|matin|apr[eè]s.?midi|horaire|calendrier)\b",
    re.IGNORECASE,
)

_CONFIRM_RE = re.compile(
    r"\b(confirm[eé]z?|valid[eé]z?|accept[eé]z?|ok\s+pour)\b",
    re.IGNORECASE,
)
_CANCEL_RE = re.compile(
    r"\b(annul[eé]z?|refus[eé]z?|supprim[eé]z?|cancel(?:l[eé]z?)?)\b",
    re.IGNORECASE,
)
_CREATE_RE = re.compile(
    r"\b(cr[eé][ae]r?|planifie[rz]?|ajouter?|fixer?|programmer?|noter?|mettre?)\b"
    r"[^.!?]{1,50}"
    r"\b(rdv|rendez.?vous|s[eé]ance|cr[eé]neau|consultation)\b",
    re.IGNORECASE,
)

_WEEKDAYS_FR = {
    "lundi": 0, "mardi": 1, "mercredi": 2, "jeudi": 3,
    "vendredi": 4, "samedi": 5, "dimanche": 6,
}
_DAYS_FR_LONG = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]


def _fmt_date_fr(d: "ddate") -> str:
    return f"{_DAYS_FR_LONG[d.weekday()].capitalize()} {d.strftime('%d/%m')}"
_MONTHS_FR = {
    "janvier": 1, "février": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6,
    "juillet": 7, "août": 8, "septembre": 9, "octobre": 10, "novembre": 11, "décembre": 12,
}
_CALENDAR_STOPWORDS = {
    "pour", "avec", "rdv", "rendez", "vous", "confirme", "annule", "valide",
    "creer", "créer", "planifier", "ajouter", "fixer", "programmer",
    "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche",
    "demain", "aujourd", "après", "prochain",
}


# ── Webhook Telegram ──────────────────────────────────────────────────────────

@router.post("/telegram/{bot_token}", status_code=200)
async def telegram_inbound(bot_token: str, request: Request):
    # Vérifier la signature Telegram (X-Telegram-Bot-Api-Secret-Token)
    _verify_telegram_secret(request, bot_token)

    payload = await request.json()
    msg = payload.get("message")
    if not msg:
        return {"status": "ignored"}
    try:
        await _process_telegram_message(msg, bot_token)
    except Exception as exc:
        logger.error("Erreur traitement message Telegram : %s", exc, exc_info=True)
    return {"status": "ok"}


def _verify_telegram_secret(request: Request, bot_token: str) -> None:
    """Rejette les appels webhook non signés par Telegram."""
    import hmac as _hmac, hashlib as _hashlib
    received = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    if not received:
        # Webhook non encore re-enregistré avec secret_token → tolérance temporaire
        logger.warning("Webhook Telegram sans secret_token (bot ...%s)", bot_token[-6:])
        return
    _secret = settings.agent_link_secret or settings.secret_key
    expected = _hmac.new(
        _secret.encode(), bot_token.encode(), _hashlib.sha256
    ).hexdigest()[:64]
    if not _hmac.compare_digest(received, expected):
        raise HTTPException(status_code=403, detail="Signature webhook Telegram invalide")


async def _process_telegram_message(msg: dict, bot_token: str) -> None:
    from app.services.telegram import send_message

    chat_id: int = msg["chat"]["id"]
    from_user: dict = msg.get("from", {})
    text: str = msg.get("text", "")

    sb = get_supabase_admin()

    # 1. Identifier le tenant via le token du bot
    cfg_res = (
        sb.table("agent_config")
        .select("tenant_id, model, system_prompt, status")
        .eq("agent_type", "support_client")
        .eq("telegram_bot_token", bot_token)
        .eq("status", "active")
        .execute()
    )
    if not cfg_res.data:
        logger.info("Aucun agent support_client actif pour ce bot Telegram")
        return

    config = cfg_res.data[0]
    tenant_id = config["tenant_id"]

    # 2. Commande /start
    if text.startswith("/start"):
        parts = text.split(" ", 1)
        if len(parts) > 1:
            param = parts[1].strip()
            if param.startswith("notify_"):
                tenant_id_from_link = param[len("notify_"):]
                await _register_tenant_notify_chat(sb, tenant_id_from_link, chat_id, bot_token, send_message)
            else:
                await _register_client_from_link(sb, tenant_id, chat_id, bot_token, param)
            return
        send_message(bot_token, chat_id, "Bonjour ! Comment puis-je vous aider ?")
        return

    # 3. Routage Agent 3 (professionnel) vs Agent 2 (client)
    a3_res = (
        sb.table("agent_config")
        .select("telegram_notify_chat_id, model, system_prompt, status")
        .eq("tenant_id", tenant_id)
        .eq("agent_type", "assistant_tenant")
        .execute()
    )
    a3_config = a3_res.data[0] if a3_res.data else {}
    is_tenant = a3_config.get("telegram_notify_chat_id") == chat_id

    if is_tenant:
        await _process_agent3_telegram(sb, tenant_id, chat_id, bot_token, msg, a3_config)
        return

    # 4. Agent 2 — client
    contact = _upsert_telegram_contact(sb, tenant_id, chat_id, from_user)
    contact_id = contact["id"]
    conv = _active_telegram_conversation(sb, tenant_id, contact_id)
    conv_id = conv["id"]

    user_text, ocr_ctx = await _extract_telegram_content(
        sb, msg, bot_token, tenant_id, contact_id, chat_id
    )
    if user_text is None:
        return

    user_text = _sanitize_input(user_text)
    _save_message(sb, conv_id, "user", user_text + ocr_ctx, {"telegram_chat_id": chat_id})

    # Charger l'historique une seule fois — partagé entre la state machine et le LLM
    history = _load_history(sb, conv_id, limit=20)

    # 5. Flux de réservation interactif (state machine)
    if await _handle_telegram_booking_flow(
        sb, tenant_id, contact_id, conv_id, user_text, bot_token, chat_id, history
    ):
        return

    # 6. Réponse LLM normale (questions hors booking)
    system_prompt = _build_system_prompt(sb, tenant_id, config)
    if ocr_ctx:
        system_prompt += f"\n\nDocument reçu — résumé extrait :\n{ocr_ctx}"
    reply = await asyncio.to_thread(
        chat_completion,
        messages=history,
        model=config.get("model", "gemini-2.5-flash"),
        system_prompt=system_prompt,
    )
    _save_message(sb, conv_id, "assistant", reply)
    send_message(bot_token, chat_id, reply)


# ── Flux de réservation interactif (Agent 2 Telegram) ────────────────────────

def _should_enter_booking_flow(text: str, history: list[dict]) -> bool:
    """
    Retourne True si ce message doit déclencher la state machine de réservation.
    Vérifie d'abord _BOOKING_RE (intent explicite), puis _BOOKING_CONTEXT_RE
    combiné à un contexte booking dans les messages récents.
    """
    if _BOOKING_RE.search(text):
        return True
    if _BOOKING_CONTEXT_RE.search(text) and history:
        recent = " ".join(m.get("content", "") for m in history[-6:])
        return bool(_BOOKING_CONTEXT_RE.search(recent))
    return False


async def _handle_telegram_booking_flow(
    sb, tenant_id: str, contact_id: str, conv_id: str,
    text: str, bot_token: str, chat_id: int,
    history: list[dict] | None = None,
) -> bool:
    """
    Gère la réservation de RDV en conversation guidée.
    Retourne True si le message a été traité par ce flux.
    """
    from app.services.telegram import send_message

    conv_res = sb.table("conversation").select("metadata").eq("id", conv_id).single().execute()
    metadata = (conv_res.data or {}).get("metadata") or {}
    flow = metadata.get("booking_flow")

    # ── Entrée dans le flux ──────────────────────────────────────────────────
    if not flow and _should_enter_booking_flow(text, history or []):
        available = _get_next_available_dates(sb, tenant_id)
        if not available:
            send_message(bot_token, chat_id,
                "Je suis désolé, aucun créneau n'est disponible dans les prochains jours. "
                "Contactez directement le professionnel.")
            return True

        available_iso = [d.isoformat() for d in available]

        # Fast-forward : si une date est déjà mentionnée dans le message ou l'historique,
        # on saute pick_date et on va directement aux créneaux
        user_ctx = text + " " + " ".join(
            m.get("content", "") for m in (history or []) if m.get("role") == "user"
        )
        chosen_date = _parse_date_from_flow_text(user_ctx, available_iso)

        if chosen_date:
            slots = _get_slots_for_date(sb, tenant_id, chosen_date)
            if slots:
                slots_text = "\n".join(f"{i+1}. {s['label']}" for i, s in enumerate(slots))
                send_message(bot_token, chat_id,
                    f"Créneaux disponibles le {_fmt_date_fr(chosen_date)} :\n\n"
                    f"{slots_text}\n\n"
                    f"Répondez avec le numéro du créneau.")
                _update_conv_metadata(sb, conv_id, {
                    "booking_flow": {
                        "step": "pick_slot",
                        "chosen_date": chosen_date.isoformat(),
                        "slots": slots,
                    }
                })
                return True

        # Pas de date détectée → étape 1 normale
        days_text = "\n".join(f"• {_fmt_date_fr(d)}" for d in available)
        send_message(bot_token, chat_id,
            f"Je vais vous aider à prendre rendez-vous.\n\n"
            f"Prochains jours disponibles :\n{days_text}\n\n"
            f"Quel jour vous convient ?")
        _update_conv_metadata(sb, conv_id, {
            "booking_flow": {
                "step": "pick_date",
                "available_dates": available_iso,
            }
        })
        return True

    if not flow:
        return False

    step = flow.get("step")

    # ── Étape 1 : choix du jour ──
    if step == "pick_date":
        chosen_date = _parse_date_from_flow_text(text, flow.get("available_dates", []))
        if not chosen_date:
            send_message(bot_token, chat_id,
                "Je n'ai pas compris la date. Précisez le jour (ex : 'lundi', 'le 5', 'demain').")
            return True

        slots = _get_slots_for_date(sb, tenant_id, chosen_date)
        if not slots:
            send_message(bot_token, chat_id,
                f"Pas de créneaux disponibles le {chosen_date.strftime('%d/%m')}. "
                f"Souhaitez-vous un autre jour ?")
            # Reset à pick_date avec les mêmes dates dispo
            _update_conv_metadata(sb, conv_id, {
                "booking_flow": {
                    "step": "pick_date",
                    "available_dates": flow.get("available_dates", []),
                }
            })
            return True

        slots_display = slots
        slots_text = "\n".join(
            f"{i+1}. {s['label']}" for i, s in enumerate(slots_display)
        )
        send_message(bot_token, chat_id,
            f"Créneaux disponibles le {_fmt_date_fr(chosen_date)} :\n\n"
            f"{slots_text}\n\n"
            f"Répondez avec le numéro du créneau.")

        _update_conv_metadata(sb, conv_id, {
            "booking_flow": {
                "step": "pick_slot",
                "chosen_date": chosen_date.isoformat(),
                "slots": slots_display,
            }
        })
        return True

    # ── Étape 2 : choix du créneau ──
    if step == "pick_slot":
        slots = flow.get("slots", [])

        # L'utilisateur veut changer de jour ou les créneaux ne lui conviennent pas
        if re.search(
            r"\b(autre|changer?|plus\s+tard|ne\s+convien|pas\s+(?:dispo|disponible|de\s+cr[eé]neau)|"
            r"diff[eé]rent|autre\s+jour|pas\s+possible|trop\s+t[oô]t)\b",
            text, re.IGNORECASE,
        ):
            available = _get_next_available_dates(sb, tenant_id)
            days_text = "\n".join(f"• {_fmt_date_fr(d)}" for d in available)
            send_message(bot_token, chat_id,
                f"Pas de problème ! Voici les prochains jours disponibles :\n\n{days_text}\n\n"
                f"Quel jour vous convient ?")
            _update_conv_metadata(sb, conv_id, {
                "booking_flow": {
                    "step": "pick_date",
                    "available_dates": [d.isoformat() for d in available],
                }
            })
            return True

        m = re.search(r"\b(\d{1,2})\b", text)
        if not m:
            send_message(bot_token, chat_id, "Répondez avec le numéro du créneau (1, 2, 3…)")
            return True

        idx = int(m.group(1)) - 1
        if idx < 0 or idx >= len(slots):
            slots_text = "\n".join(f"{i+1}. {s['label']}" for i, s in enumerate(slots))
            send_message(bot_token, chat_id,
                f"Ce numéro n'existe pas. Choisissez entre 1 et {len(slots)} :\n\n{slots_text}")
            return True

        chosen_slot = slots[idx]
        dt = datetime.fromisoformat(chosen_slot["start"].replace("Z", "+00:00"))
        send_message(bot_token, chat_id,
            f"Confirmer ce rendez-vous ?\n\n"
            f"📅 {_DAYS_FR_LONG[dt.weekday()].capitalize()} {dt.strftime('%d/%m à %H:%M')}\n\n"
            f"Répondez 'oui' pour confirmer ou 'non' pour choisir un autre créneau.")

        _update_conv_metadata(sb, conv_id, {
            "booking_flow": {"step": "confirm", "chosen_slot": chosen_slot}
        })
        return True

    # ── Étape 3 : confirmation ──
    if step == "confirm":
        if re.search(r"\b(oui|yes|ok|confirme|c'est\s+bon|parfait|d'accord|top)\b", text, re.IGNORECASE):
            chosen_slot = flow.get("chosen_slot", {})
            cal_ids = [c["id"] for c in (sb.table("calendar").select("id").eq("tenant_id", tenant_id).execute().data or [])]
            if not cal_ids:
                send_message(bot_token, chat_id, "Erreur système. Contactez directement le professionnel.")
                _clear_booking_flow(sb, conv_id, metadata)
                return True

            contact_res = sb.table("contact").select("first_name, last_name").eq("id", contact_id).single().execute()
            contact_info = contact_res.data or {}

            try:
                appt = sb.table("appointment").insert({
                    "calendar_id": cal_ids[0],
                    "contact_id": contact_id,
                    "scheduled_at": chosen_slot["start"],
                    "end_at": chosen_slot["end"],
                    "status": "pending",
                    "type": "b2c_appointment",
                    "audience_type": "b2c",
                }).execute().data[0]

                # Résumé de la conversation joint au RDV
                history = _load_history(sb, conv_id, limit=20)
                try:
                    summary = await asyncio.to_thread(
                        _generate_booking_summary_sync, history,
                        "gemini-2.5-flash"
                    )
                    if summary:
                        sb.table("appointment").update({"conversation_summary": summary}).eq("id", appt["id"]).execute()
                except Exception:
                    pass

                dt = datetime.fromisoformat(chosen_slot["start"].replace("Z", "+00:00"))

                # Notifier le tenant via le canal existant (email / WhatsApp / Telegram)
                from app.api.v1.booking import _notify_tenant_pending
                _notify_tenant_pending(
                    sb, tenant_id,
                    contact_info.get("first_name", ""),
                    contact_info.get("last_name", ""),
                    chosen_slot["start"],
                )

                # Passer le relais à Agent 3 — notif Telegram au professionnel
                try:
                    a3_res = (
                        sb.table("agent_config")
                        .select("telegram_notify_chat_id, status")
                        .eq("tenant_id", tenant_id)
                        .eq("agent_type", "assistant_tenant")
                        .eq("status", "active")
                        .execute()
                    )
                    notify_chat_id = (a3_res.data or [{}])[0].get("telegram_notify_chat_id")
                    if notify_chat_id:
                        full_name = (
                            f"{contact_info.get('first_name', '')} {contact_info.get('last_name', '')}".strip()
                            or "Client"
                        )
                        send_message(bot_token, notify_chat_id,
                            f"Nouvelle demande de RDV (Telegram)\n"
                            f"Client : {full_name}\n"
                            f"Date : {_DAYS_FR_LONG[dt.weekday()].capitalize()} {dt.strftime('%d/%m à %H:%M')}\n"
                            f"Statut : en attente de confirmation\n"
                            f"Dites 'confirme {contact_info.get('first_name', full_name)}' pour valider.")
                except Exception as exc:
                    logger.warning("Notification Agent 3 après RDV échouée : %s", exc)

                send_message(bot_token, chat_id,
                    f"Votre demande de rendez-vous est enregistrée pour le "
                    f"{_DAYS_FR_LONG[dt.weekday()].capitalize()} {dt.strftime('%d/%m à %H:%M')}.\n"
                    f"Vous recevrez une confirmation dès validation par le professionnel.")
            except Exception as exc:
                logger.error("Booking via Telegram failed: %s", exc)
                send_message(bot_token, chat_id,
                    "Une erreur est survenue. Veuillez réessayer ou contacter directement le professionnel.")
        else:
            send_message(bot_token, chat_id, "Réservation annulée. Puis-je vous aider autrement ?")

        _clear_booking_flow(sb, conv_id, metadata)
        return True

    return False


def _generate_booking_summary_sync(history: list[dict], model: str) -> str:
    """Génère un résumé de la conversation client avant sa prise de RDV."""
    prompt = (
        "Résume en 4-5 points cette conversation client. "
        "Inclure : motif de la visite, informations personnelles mentionnées, "
        "préférences ou contraintes exprimées. Sois concis et factuel."
    )
    try:
        return chat_completion(
            messages=history + [{"role": "user", "content": prompt}],
            model=model,
            system_prompt="Tu résumes des conversations clients pour aider un professionnel indépendant.",
        )
    except Exception:
        return ""


def _get_next_available_dates(sb, tenant_id: str, count: int = 5) -> list[ddate]:
    cals = sb.table("calendar").select("id").eq("tenant_id", tenant_id).execute().data or []
    if not cals:
        return []
    cal_id = cals[0]["id"]

    avail = (
        sb.table("availability_slot")
        .select("day_of_week")
        .eq("calendar_id", cal_id)
        .eq("is_active", True)
        .execute()
    ).data or []
    available_weekdays = {r["day_of_week"] for r in avail}
    if not available_weekdays:
        return []

    today = datetime.now(timezone.utc).date()
    result: list[ddate] = []
    check = today + timedelta(days=1)
    while len(result) < count and (check - today).days < 31:
        if check.weekday() in available_weekdays:
            result.append(check)
        check += timedelta(days=1)
    return result


def _get_slots_for_date(sb, tenant_id: str, target_date: ddate) -> list[dict]:
    cals = sb.table("calendar").select("id").eq("tenant_id", tenant_id).execute().data or []
    if not cals:
        return []
    cal_id = cals[0]["id"]

    day_of_week = target_date.weekday()
    avail_res = (
        sb.table("availability_slot")
        .select("*")
        .eq("calendar_id", cal_id)
        .eq("day_of_week", day_of_week)
        .eq("is_active", True)
        .execute()
    ).data or []
    if not avail_res:
        return []

    day_start = datetime.combine(target_date, dtime.min).replace(tzinfo=timezone.utc)
    day_end = datetime.combine(target_date, dtime.max).replace(tzinfo=timezone.utc)
    appts = (
        sb.table("appointment")
        .select("scheduled_at, end_at")
        .eq("calendar_id", cal_id)
        .neq("status", "cancelled")
        .gte("scheduled_at", day_start.isoformat())
        .lte("scheduled_at", day_end.isoformat())
        .execute()
    ).data or []
    busy = [
        (
            datetime.fromisoformat(a["scheduled_at"].replace("Z", "+00:00")),
            datetime.fromisoformat(a["end_at"].replace("Z", "+00:00")),
        )
        for a in appts
    ]

    slots = []
    now = datetime.now(timezone.utc)
    for avail in avail_res:
        h_s, m_s = map(int, avail["start_time"][:5].split(":"))
        h_e, m_e = map(int, avail["end_time"][:5].split(":"))
        duration = avail["slot_duration_min"]
        slot_start = datetime.combine(target_date, dtime(h_s, m_s)).replace(tzinfo=timezone.utc)
        period_end = datetime.combine(target_date, dtime(h_e, m_e)).replace(tzinfo=timezone.utc)
        while slot_start + timedelta(minutes=duration) <= period_end:
            slot_end = slot_start + timedelta(minutes=duration)
            if not any(s < slot_end and slot_start < e for s, e in busy) and slot_start > now:
                slots.append({
                    "start": slot_start.isoformat(),
                    "end": slot_end.isoformat(),
                    "label": slot_start.strftime("%H:%M"),
                })
            slot_start = slot_end
    return slots


def _parse_date_from_flow_text(text: str, available_dates_iso: list[str]) -> ddate | None:
    """Parse une date depuis la réponse du client en la comparant aux dates disponibles."""
    now = datetime.now(timezone.utc)

    # Dates relatives
    if re.search(r"\bdemain\b", text, re.IGNORECASE):
        candidate = (now + timedelta(days=1)).date()
    elif re.search(r"\baprès.?demain\b", text, re.IGNORECASE):
        candidate = (now + timedelta(days=2)).date()
    elif re.search(r"\baujourd'?hui\b", text, re.IGNORECASE):
        candidate = now.date()
    else:
        candidate = None

    # Jour de la semaine
    if not candidate:
        for name, num in _WEEKDAYS_FR.items():
            if re.search(rf"\b{name}\b", text, re.IGNORECASE):
                days_ahead = (num - now.weekday()) % 7 or 7
                candidate = (now + timedelta(days=days_ahead)).date()
                break

    # Jour du mois "le 5", "le 15 mai"
    if not candidate:
        m = re.search(
            r"\ble\s+(\d{1,2})(?:\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre))?\b",
            text, re.IGNORECASE,
        )
        if m:
            day = int(m.group(1))
            month_name = m.group(2)
            month = _MONTHS_FR.get(month_name.lower()) if month_name else now.month
            year = now.year
            try:
                candidate = ddate(year, month, day)
                if candidate < now.date():
                    candidate = ddate(year + 1, month, day)
            except ValueError:
                pass

    # Chiffre seul sans "le" : "07", "7", "07/05", "7/05"
    if not candidate:
        m = re.search(r"(?<!\d)(\d{1,2})(?:/(\d{1,2}))?(?!\d)", text)
        if m:
            day = int(m.group(1))
            month_str = m.group(2)
            if 1 <= day <= 31:
                month = int(month_str) if month_str and 1 <= int(month_str) <= 12 else now.month
                year = now.year
                try:
                    candidate = ddate(year, month, day)
                    if candidate < now.date():
                        next_month = month % 12 + 1
                        next_year = year + (1 if month == 12 else 0)
                        try:
                            candidate = ddate(next_year, next_month, day)
                        except ValueError:
                            candidate = None
                except ValueError:
                    pass

    if not candidate:
        return None

    # Vérifier que c'est une date disponible
    available = [ddate.fromisoformat(d) for d in available_dates_iso]
    return candidate if candidate in available else None


def _update_conv_metadata(sb, conv_id: str, extra: dict) -> None:
    existing = sb.table("conversation").select("metadata").eq("id", conv_id).single().execute()
    metadata = (existing.data or {}).get("metadata") or {}
    metadata.update(extra)
    sb.table("conversation").update({"metadata": metadata}).eq("id", conv_id).execute()


def _clear_booking_flow(sb, conv_id: str, metadata: dict) -> None:
    new_meta = {k: v for k, v in metadata.items() if k != "booking_flow"}
    sb.table("conversation").update({"metadata": new_meta}).eq("id", conv_id).execute()


# ── Gestion /start ─────────────────────────────────────────────────────────────

async def _register_tenant_notify_chat(sb, tenant_id: str, chat_id: int, bot_token: str, send_fn) -> None:
    res = sb.table("tenant").select("id").eq("id", tenant_id).execute()
    if not res.data:
        send_fn(bot_token, chat_id, "Lien invalide ou expiré.")
        return
    sb.table("agent_config").update({"telegram_notify_chat_id": chat_id}).eq(
        "tenant_id", tenant_id
    ).eq("agent_type", "assistant_tenant").execute()
    send_fn(bot_token, chat_id,
        "Notifications activées ✓\n"
        "Vous recevrez désormais les alertes de nouveaux rendez-vous ici.\n"
        "Dites-moi 'quels sont mes RDV du jour ?' pour commencer.")


async def _register_client_from_link(
    sb, tenant_id: str, chat_id: int, bot_token: str, token: str
) -> None:
    from jose import jwt as jose_jwt, JWTError
    from app.services.telegram import send_message

    if not settings.agent_link_secret:
        logger.error("AGENT_LINK_SECRET non configuré")
        return
    try:
        payload = jose_jwt.decode(token, settings.agent_link_secret, algorithms=["HS256"])
    except JWTError:
        send_message(bot_token, chat_id,
            "Ce lien est invalide ou a expiré. Demandez un nouveau lien à votre professionnel.")
        return

    contact_id = payload.get("contact_id")
    link_tenant_id = payload.get("tenant_id")
    if not contact_id or link_tenant_id != tenant_id:
        send_message(bot_token, chat_id, "Ce lien n'est pas valide pour ce service.")
        return

    sb.table("contact").update({"telegram_chat_id": chat_id}).eq("id", contact_id).eq("tenant_id", tenant_id).execute()
    sb.table("agent_link").update({
        "used_at": datetime.now(timezone.utc).isoformat()
    }).eq("token", token).eq("tenant_id", tenant_id).execute()
    _ensure_lead(sb, tenant_id, contact_id, "telegram")

    contact_res = sb.table("contact").select("first_name").eq("id", contact_id).single().execute()
    first_name = (contact_res.data or {}).get("first_name", "")
    greeting = f"Bonjour {first_name} !" if first_name else "Bonjour !"
    send_message(bot_token, chat_id,
        f"{greeting} Je suis votre assistant personnel. "
        "Posez-moi vos questions ou envoyez-moi vos documents.")


# ── Agent 3 — traitement professionnel ───────────────────────────────────────

async def _process_agent3_telegram(
    sb, tenant_id: str, chat_id: int, bot_token: str, msg: dict, a3_config: dict
) -> None:
    from app.services.telegram import send_message
    from app.api.v1.assistant import _build_system_prompt

    user_text: str | None = None
    ocr_ctx = ""

    if "text" in msg:
        user_text = msg["text"]  # Agent 3 = tenant de confiance, pas de filtre injection
    elif "photo" in msg or "document" in msg:
        from app.services.telegram import download_file
        caption = msg.get("caption", "")
        file_id = msg["photo"][-1]["file_id"] if "photo" in msg else msg["document"]["file_id"]
        try:
            file_bytes, mime_type = await asyncio.to_thread(download_file, bot_token, file_id)
            ocr_text = await asyncio.to_thread(extract_summary, file_bytes, mime_type)
            user_text = caption or "Document"
            ocr_ctx = f"\n[Résumé du document : {ocr_text[:800]}]"
        except Exception as exc:
            logger.error("OCR Agent3 Telegram: %s", exc)
            send_message(bot_token, chat_id, "Je n'ai pas pu traiter ce document.")
            return
    elif "voice" in msg or "audio" in msg:
        send_message(bot_token, chat_id, "Je ne traite pas encore les messages vocaux.")
        return
    else:
        return

    # Détecter et exécuter une action calendrier avant l'appel LLM
    action_ctx = await asyncio.to_thread(_handle_calendar_action, sb, tenant_id, user_text)

    # Conversation Agent 3 Telegram
    conv_res = (
        sb.table("conversation")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("agent_type", "assistant_tenant")
        .eq("channel", "telegram")
        .is_("contact_id", "null")
        .is_("ended_at", "null")
        .is_("deleted_at", "null")
        .order("started_at", desc=True)
        .limit(1)
        .execute()
    )
    if conv_res.data:
        conv_id = conv_res.data[0]["id"]
    else:
        new_conv = sb.table("conversation").insert({
            "tenant_id": tenant_id,
            "contact_id": None,
            "agent_type": "assistant_tenant",
            "channel": "telegram",
            "metadata": {"chat_id": chat_id},
        }).execute()
        conv_id = new_conv.data[0]["id"]

    history = _load_history(sb, conv_id, limit=20)
    full_user_text = user_text + ocr_ctx
    user_content = full_user_text
    if action_ctx:
        user_content = f"{full_user_text}\n\n[Action exécutée : {action_ctx}]"
    history.append({"role": "user", "content": user_content})

    system_prompt = await asyncio.to_thread(_build_system_prompt, sb, tenant_id, a3_config)

    try:
        reply = await asyncio.to_thread(
            chat_completion,
            messages=history,
            model=a3_config.get("model", "gemini-2.5-flash"),
            system_prompt=system_prompt,
        )
    except Exception as exc:
        logger.error("Agent 3 Telegram LLM error tenant %s : %s", tenant_id, exc)
        send_message(bot_token, chat_id, "Service IA temporairement indisponible.")
        return

    now_iso = datetime.now(timezone.utc).isoformat()
    sb.table("message").insert([
        {"conversation_id": conv_id, "sender_type": "user", "content": full_user_text, "sent_at": now_iso},
        {"conversation_id": conv_id, "sender_type": "assistant", "content": reply, "sent_at": now_iso},
    ]).execute()

    send_message(bot_token, chat_id, reply)


# ── Actions calendrier (Agent 3) ──────────────────────────────────────────────

def _handle_calendar_action(sb, tenant_id: str, text: str) -> str | None:
    """
    Détecte confirm / annule / crée un RDV et l'exécute.
    Retourne une description de l'action ou None.
    Priorité : CONFIRM > CANCEL > CREATE
    """
    is_confirm = bool(_CONFIRM_RE.search(text))
    is_cancel = bool(_CANCEL_RE.search(text))
    is_create = bool(_CREATE_RE.search(text)) and not is_confirm and not is_cancel

    if not is_confirm and not is_cancel and not is_create:
        return None

    cals = sb.table("calendar").select("id").eq("tenant_id", tenant_id).execute().data or []
    if not cals:
        return None
    cal_ids = [c["id"] for c in cals]
    cal_id = cal_ids[0]

    # ── CONFIRM ou CANCEL ──
    if is_confirm or is_cancel:
        pending = (
            sb.table("appointment")
            .select("id, scheduled_at, contact_id, contact(first_name, last_name, email)")
            .in_("calendar_id", cal_ids)
            .eq("status", "pending")
            .order("scheduled_at")
            .limit(20)
            .execute()
        ).data or []

        if not pending:
            return None

        words = [w.lower() for w in re.findall(r"[a-zàâäéèêëîïôùûüç]{3,}", text, re.IGNORECASE)]
        matched = None
        for appt in pending:
            contact = appt.get("contact") or {}
            first = (contact.get("first_name") or "").lower()
            last = (contact.get("last_name") or "").lower()
            if any(w in first or w in last for w in words if w not in _CALENDAR_STOPWORDS):
                matched = appt
                break
        if not matched and len(pending) == 1:
            matched = pending[0]
        if not matched:
            return None

        contact = matched.get("contact") or {}
        contact_name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip() or "Client"
        appt_id = matched["id"]
        try:
            dt = datetime.fromisoformat(matched["scheduled_at"].replace("Z", "+00:00"))
            date_str = f"{_DAYS_FR_LONG[dt.weekday()].capitalize()} {dt.strftime('%d/%m à %H:%M')}"
        except Exception:
            date_str = matched["scheduled_at"]

        if is_confirm:
            sb.table("appointment").update({"status": "confirmed"}).eq("id", appt_id).execute()
            email = contact.get("email")
            if email:
                try:
                    from app.services.email import send_appointment_confirmation
                    tenant_res = sb.table("tenant").select("name").eq("id", tenant_id).single().execute()
                    tenant_name = (tenant_res.data or {}).get("name", "")
                    send_appointment_confirmation(
                        contact_email=email,
                        contact_name=contact_name,
                        appointment=matched,
                        tenant_name=tenant_name,
                    )
                except Exception as exc:
                    logger.warning("Email confirmation Telegram échoué : %s", exc)
            return f"RDV de {contact_name} ({date_str}) CONFIRMÉ ✓ — email de confirmation envoyé."
        else:
            sb.table("appointment").update({"status": "cancelled"}).eq("id", appt_id).execute()
            return f"RDV de {contact_name} ({date_str}) ANNULÉ."

    # ── CREATE ──
    if is_create:
        target_dt = _parse_french_datetime(text)
        if not target_dt:
            return None  # Pas assez d'info — laisser le LLM demander la date

        # Extraire un nom de contact du texte
        name_words = [
            w for w in re.findall(r"[A-ZÀÂÄÉÈÊËÎÏÔÙÛÜ][a-zàâäéèêëîïôùûüç]+", text)
            if w.lower() not in _CALENDAR_STOPWORDS
        ]
        if not name_words:
            return None  # Pas de nom — laisser le LLM demander

        first_name = name_words[0]
        last_name = name_words[1] if len(name_words) > 1 else ""

        # Chercher le contact existant
        contact_res = (
            sb.table("contact")
            .select("id, first_name, last_name")
            .eq("tenant_id", tenant_id)
            .ilike("first_name", f"%{first_name}%")
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if contact_res:
            contact_id = contact_res[0]["id"]
            contact_name = f"{contact_res[0].get('first_name', '')} {contact_res[0].get('last_name', '')}".strip()
        else:
            # Créer le contact à la volée
            new_contact = sb.table("contact").insert({
                "tenant_id": tenant_id,
                "first_name": first_name,
                "last_name": last_name,
                "source": "agent3_telegram",
            }).execute().data[0]
            contact_id = new_contact["id"]
            contact_name = f"{first_name} {last_name}".strip()

        end_dt = target_dt + timedelta(hours=1)
        try:
            sb.table("appointment").insert({
                "calendar_id": cal_id,
                "contact_id": contact_id,
                "scheduled_at": target_dt.isoformat(),
                "end_at": end_dt.isoformat(),
                "status": "confirmed",
                "type": "b2c_appointment",
                "audience_type": "b2c",
            }).execute()
        except Exception as exc:
            logger.error("Agent3 create RDV failed: %s", exc)
            return None

        date_str = f"{_DAYS_FR_LONG[target_dt.weekday()].capitalize()} {target_dt.strftime('%d/%m à %H:%M')}"
        return f"RDV créé pour {contact_name} le {date_str} (1h, confirmé)."

    return None


def _parse_french_datetime(text: str) -> datetime | None:
    """Parse une date/heure en français. Retourne None si insuffisant."""
    now = datetime.now(timezone.utc)
    target_date: ddate | None = None
    target_hour: int | None = None
    target_min: int = 0

    # Relatifs
    if re.search(r"\bdemain\b", text, re.IGNORECASE):
        target_date = (now + timedelta(days=1)).date()
    elif re.search(r"\baprès.?demain\b", text, re.IGNORECASE):
        target_date = (now + timedelta(days=2)).date()
    elif re.search(r"\baujourd'?hui\b", text, re.IGNORECASE):
        target_date = now.date()

    # Jour de semaine
    if not target_date:
        for name, num in _WEEKDAYS_FR.items():
            if re.search(rf"\b{name}\b", text, re.IGNORECASE):
                days_ahead = (num - now.weekday()) % 7 or 7
                target_date = (now + timedelta(days=days_ahead)).date()
                break

    # "le 5", "le 15 mai"
    if not target_date:
        m = re.search(
            r"\ble\s+(\d{1,2})(?:\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre))?\b",
            text, re.IGNORECASE,
        )
        if m:
            day = int(m.group(1))
            month_name = m.group(2)
            month = _MONTHS_FR.get(month_name.lower()) if month_name else now.month
            try:
                candidate = ddate(now.year, month, day)
                if candidate < now.date():
                    candidate = ddate(now.year + 1, month, day)
                target_date = candidate
            except ValueError:
                pass

    # Heure "à 14h30", "à 14:30", "à 14h"
    m = re.search(r"\bà\s*(\d{1,2})[h:]\s*(\d{0,2})\b", text, re.IGNORECASE)
    if m:
        target_hour = int(m.group(1))
        target_min = int(m.group(2)) if m.group(2) else 0

    if target_date and target_hour is not None:
        return datetime.combine(target_date, dtime(target_hour, target_min), tzinfo=timezone.utc)
    return None


from app.services.lead import ensure_lead as _ensure_lead


# ── Helpers Telegram ──────────────────────────────────────────────────────────

def _upsert_telegram_contact(sb, tenant_id: str, chat_id: int, from_user: dict) -> dict:
    res = (
        sb.table("contact")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("telegram_chat_id", chat_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if res.data:
        return res.data[0]
    first_name = from_user.get("first_name", f"TG-{str(chat_id)[-4:]}")
    last_name = from_user.get("last_name", "")
    new = sb.table("contact").insert({
        "tenant_id": tenant_id,
        "telegram_chat_id": chat_id,
        "first_name": first_name,
        "last_name": last_name,
        "source": "telegram",
    }).execute()
    contact = new.data[0]
    _ensure_lead(sb, tenant_id, contact["id"], "telegram")
    return contact


def _active_telegram_conversation(sb, tenant_id: str, contact_id: str) -> dict:
    res = (
        sb.table("conversation")
        .select("id, metadata")
        .eq("tenant_id", tenant_id)
        .eq("contact_id", contact_id)
        .eq("channel", "telegram")
        .is_("ended_at", "null")
        .is_("deleted_at", "null")
        .order("started_at", desc=True)
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]
    new = sb.table("conversation").insert({
        "tenant_id": tenant_id,
        "contact_id": contact_id,
        "agent_type": "support_client",
        "channel": "telegram",
        "metadata": {},
    }).execute()
    return new.data[0]


async def _extract_telegram_content(
    sb, msg: dict, bot_token: str, tenant_id: str, contact_id: str, chat_id: int
) -> tuple[str | None, str]:
    from app.services.telegram import send_message, download_file

    if "text" in msg:
        return msg["text"], ""

    if "photo" in msg or "document" in msg:
        caption = msg.get("caption", "")
        file_id = msg["photo"][-1]["file_id"] if "photo" in msg else msg["document"]["file_id"]
        try:
            file_bytes, mime_type = await asyncio.to_thread(download_file, bot_token, file_id)
            ocr_text = await asyncio.to_thread(extract_summary, file_bytes, mime_type)
            sb.table("ocr_summary").insert({
                "tenant_id": tenant_id,
                "contact_id": contact_id,
                "summary_encrypted": ocr_text,
                "document_type": "autre",
                "processed_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
            return caption or "Document envoyé", f"\n[Résumé OCR : {ocr_text[:800]}]"
        except Exception as exc:
            logger.error("OCR Telegram échoué chat_id %s : %s", chat_id, exc)
            send_message(bot_token, chat_id, "J'ai reçu votre document mais n'ai pas pu le traiter.")
            return caption or "Document envoyé (traitement échoué)", ""

    if "voice" in msg or "audio" in msg:
        send_message(bot_token, chat_id, "Je ne traite pas encore les messages vocaux.")
        return None, ""

    send_message(bot_token, chat_id, "Je ne peux traiter que les messages texte et les documents.")
    return None, ""


# ── Vérification / réception WhatsApp ─────────────────────────────────────────

@router.get("/whatsapp")
async def whatsapp_verify(
    hub_mode: str = "",
    hub_challenge: str = "",
    hub_verify_token: str = "",
):
    if hub_mode == "subscribe" and hub_verify_token == settings.dialog360_verify_token:
        return PlainTextResponse(hub_challenge)
    raise HTTPException(status_code=403, detail="Token de vérification invalide")


@router.post("/whatsapp", status_code=200)
async def whatsapp_inbound(
    request: Request,
    x_hub_signature_256: str = Header(default=""),
):
    body_bytes = await request.body()
    if not verify_signature(body_bytes, x_hub_signature_256):
        raise HTTPException(status_code=403, detail="Signature webhook invalide")

    payload = await request.json()
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            waba_number = value.get("metadata", {}).get("display_phone_number", "")
            contacts_meta = value.get("contacts", [])
            for msg in value.get("messages", []):
                try:
                    await _process_message(msg, waba_number, contacts_meta)
                except Exception as exc:
                    logger.error("Erreur traitement message WhatsApp : %s", exc, exc_info=True)
    return {"status": "ok"}


async def _process_message(msg: dict, waba_number: str, contacts_meta: list) -> None:
    wa_id = msg.get("from", "")
    msg_type = msg.get("type", "text")
    wa_msg_id = msg.get("id", "")

    sb = get_supabase_admin()

    cfg_res = (
        sb.table("agent_config")
        .select("tenant_id, model, system_prompt, status")
        .eq("agent_type", "support_client")
        .eq("whatsapp_number", waba_number)
        .eq("status", "active")
        .execute()
    )
    if not cfg_res.data:
        return

    config = cfg_res.data[0]
    tenant_id = config["tenant_id"]

    contact = _upsert_contact(sb, tenant_id, wa_id, contacts_meta)
    contact_id = contact["id"]
    conv = _active_conversation(sb, tenant_id, contact_id)
    conv_id = conv["id"]

    user_text, ocr_ctx = await _extract_content(sb, msg_type, msg, tenant_id, contact_id, wa_id)
    if user_text is None:
        return

    user_text = _sanitize_input(user_text)
    _save_message(sb, conv_id, "user", user_text + ocr_ctx, {"wa_message_id": wa_msg_id})

    if _BOOKING_RE.search(user_text):
        # Générer et sauvegarder un résumé de la conversation avant la redirection
        history = _load_history(sb, conv_id, limit=20)
        try:
            summary = await asyncio.to_thread(
                _generate_booking_summary_sync, history, config.get("model", "gemini-2.5-flash")
            )
            if summary:
                _update_conv_metadata(sb, conv_id, {"booking_summary": summary})
        except Exception:
            pass
        reply = await _booking_redirect_reply(sb, tenant_id)
    else:
        history = _load_history(sb, conv_id, limit=20)
        system_prompt = _build_system_prompt(sb, tenant_id, config)
        if ocr_ctx:
            system_prompt += f"\n\nDocument reçu du client — résumé extrait :\n{ocr_ctx}"
        reply = await asyncio.to_thread(
            chat_completion,
            messages=history,
            model=config.get("model", "gemini-2.5-flash"),
            system_prompt=system_prompt,
        )

    _save_message(sb, conv_id, "assistant", reply)
    send_text(wa_id, reply)


# ── Helpers base de données ───────────────────────────────────────────────────

def _upsert_contact(sb, tenant_id: str, wa_id: str, contacts_meta: list) -> dict:
    res = (
        sb.table("contact")
        .select("id, first_name, last_name")
        .eq("tenant_id", tenant_id)
        .eq("phone", wa_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if res.data:
        return res.data[0]
    wa_name = next(
        (c.get("profile", {}).get("name", "") for c in contacts_meta if c.get("wa_id") == wa_id), ""
    )
    parts = wa_name.split(" ", 1) if wa_name else []
    new = sb.table("contact").insert({
        "tenant_id": tenant_id,
        "phone": wa_id,
        "first_name": parts[0] if parts else f"WA-{wa_id[-4:]}",
        "last_name": parts[1] if len(parts) > 1 else "",
        "source": "whatsapp",
    }).execute()
    contact = new.data[0]
    _ensure_lead(sb, tenant_id, contact["id"], "whatsapp")
    return contact


def _active_conversation(sb, tenant_id: str, contact_id: str) -> dict:
    res = (
        sb.table("conversation")
        .select("id, metadata")
        .eq("tenant_id", tenant_id)
        .eq("contact_id", contact_id)
        .eq("channel", "whatsapp")
        .is_("ended_at", "null")
        .is_("deleted_at", "null")
        .order("started_at", desc=True)
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]
    new = sb.table("conversation").insert({
        "tenant_id": tenant_id,
        "contact_id": contact_id,
        "agent_type": "support_client",
        "channel": "whatsapp",
        "metadata": {},
    }).execute()
    return new.data[0]


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


def _save_message(
    sb, conv_id: str, sender_type: str, content: str, metadata: dict | None = None
) -> None:
    sb.table("message").insert({
        "conversation_id": conv_id,
        "sender_type": sender_type,
        "content": content,
        "metadata": metadata or {},
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }).execute()


def _build_system_prompt(sb, tenant_id: str, config: dict) -> str:
    now = datetime.now(timezone.utc) + timedelta(hours=2)  # Europe/Brussels (CEST UTC+2)
    date_ctx = (
        f"\n\nDate et heure actuelles : {_DAYS_FR_LONG[now.weekday()].capitalize()} "
        f"{now.strftime('%d/%m/%Y')} à {now.strftime('%H:%M')} (heure de Bruxelles). "
        "Utilise toujours cette date comme référence absolue."
    )

    # Prompt personnalisé saisi manuellement → priorité absolue
    if config.get("system_prompt"):
        return config["system_prompt"] + date_ctx

    # ── Récupération des données ──────────────────────────────────────────────

    tenant_res = sb.table("tenant").select("name").eq("id", tenant_id).single().execute()
    tenant_name = (tenant_res.data or {}).get("name", "ce professionnel")

    site_res = sb.table("site").select(
        "id, title, tagline, description, phone, email_contact, address, "
        "coverage_zones, values_list, social_links, audience_mode, "
        "default_language, absence_mode, absence_message"
    ).eq("tenant_id", tenant_id).limit(1).execute()
    site = (site_res.data or [{}])[0]

    # ── Langue du tenant ─────────────────────────────────────────────────────
    display_name = site.get("title") or tenant_name
    lang = site.get("default_language") or "fr"
    # English names for the LLM instruction (universally understood)
    _LANG_NAMES = {"fr": "French", "en": "English", "nl": "Dutch", "de": "German"}
    lang_name = _LANG_NAMES.get(lang, "French")

    # ── Mode absence ──────────────────────────────────────────────────────────
    if site.get("absence_mode"):
        msg = site.get("absence_message") or {
            "fr": "Le professionnel est actuellement indisponible.",
            "en": "The professional is currently unavailable.",
            "de": "Der Fachmann ist derzeit nicht verfügbar.",
            "nl": "De professional is momenteel niet beschikbaar.",
        }.get(lang, "Le professionnel est actuellement indisponible.")
        return (
            f"You are the assistant of {display_name}. "
            f"The professional is absent. Relay this message to the client: « {msg} » "
            f"Be courteous, make no commitments, invite to contact later. "
            f"Plain text only, no formatting. ALWAYS reply in {lang_name}."
            + date_ctx
        )

    # ── Construction du prompt dynamique ─────────────────────────────────────

    lines: list[str] = []

    # Identité
    intro = f"Tu es l'assistant de {display_name}"
    if site.get("tagline"):
        intro += f" — {site['tagline']}"
    intro += f". Tu réponds aux clients par messagerie (WhatsApp ou Telegram) au nom de ce professionnel."
    if site.get("description"):
        intro += f"\n\nDescription de l'activité :\n{site['description']}"
    lines.append(intro)

    # Prestations / services
    site_id = site.get("id")
    if site_id:
        offers = (
            sb.table("service_offer")
            .select("name, description, duration_min, price_eur")
            .eq("site_id", site_id)
            .execute()
        ).data or []
        if offers:
            lines.append("\nSERVICES ET PRESTATIONS :")
            for o in offers:
                parts = [o["name"]]
                if o.get("duration_min"):
                    parts.append(f"{o['duration_min']} min")
                if o.get("price_eur") is not None:
                    parts.append(f"{float(o['price_eur']):.2f} €".rstrip("0").rstrip(".") + " €"
                                 if "." in f"{float(o['price_eur']):.2f}" else f"{float(o['price_eur']):.0f} €")
                line = "- " + " · ".join(parts)
                if o.get("description"):
                    line += f"\n  {o['description'][:200]}"
                lines.append(line)

    # Atouts / valeurs différenciantes
    values = site.get("values_list") or []
    if values:
        lines.append("\nPOINTS FORTS ET VALEURS :")
        for v in values:
            if not v.get("title"):
                continue
            val_line = f"- {v['title']}"
            if v.get("description"):
                val_line += f" : {v['description']}"
            lines.append(val_line)

    # Zones d'intervention
    zones = site.get("coverage_zones") or []
    if zones:
        lines.append(f"\nZONES D'INTERVENTION : {', '.join(zones)}")

    # Coordonnées
    social = site.get("social_links") or {}
    contact_lines: list[str] = []
    if site.get("phone"):
        contact_lines.append(f"Téléphone : {site['phone']}")
    if social.get("phone2"):
        contact_lines.append(f"Téléphone secondaire : {social['phone2']}")
    if site.get("email_contact"):
        contact_lines.append(f"Email : {site['email_contact']}")
    if site.get("address"):
        contact_lines.append(f"Adresse : {site['address']}")
    for net in ("facebook", "instagram", "linkedin"):
        if social.get(net):
            contact_lines.append(f"{net.capitalize()} : {social[net]}")
    if contact_lines:
        lines.append("\nCOORDONNÉES :\n" + "\n".join(f"- {c}" for c in contact_lines))

    # Règles de comportement — 100 % génériques, aucune référence sectorielle
    lines.append(
        f"\nRÈGLES DE COMPORTEMENT :\n"
        f"- ALWAYS reply in {lang_name}, with a warm and professional tone\n"
        "- Utilise uniquement du texte brut — aucun markdown, aucun astérisque, aucun #\n"
        "- Base-toi uniquement sur les informations fournies ci-dessus ; "
        "ne suppose rien qui ne soit pas écrit ici\n"
        "- Si une information est absente, oriente le client vers le professionnel directement\n"
        "- Pour toute demande de rendez-vous, guide le client étape par étape\n"
        "- Ne prends jamais d'engagement au nom du professionnel sans validation explicite"
    )

    return "\n".join(lines) + date_ctx


async def _booking_redirect_reply(sb, tenant_id: str) -> str:
    tenant_res = sb.table("tenant").select("slug").eq("id", tenant_id).single().execute()
    slug = tenant_res.data.get("slug", "") if tenant_res.data else ""
    booking_url = (
        f"{settings.frontend_url_prod or settings.frontend_url}/{slug}/booking" if slug else (settings.frontend_url_prod or settings.frontend_url)
    )
    return (
        f"Pour prendre rendez-vous, utilisez notre page de réservation en ligne :\n"
        f"{booking_url}\n\n"
        "Vous pouvez y choisir la date et le créneau qui vous conviennent. "
        "Si vous avez d'autres questions, je suis là !"
    )


async def _extract_content(
    sb, msg_type: str, msg: dict, tenant_id: str, contact_id: str, wa_id: str
) -> tuple[str | None, str]:
    if msg_type == "text":
        return msg.get("text", {}).get("body", ""), ""

    if msg_type in ("image", "document"):
        block = msg.get(msg_type, {})
        media_id = block.get("id", "")
        caption = block.get("caption", "")
        try:
            file_bytes, mime_type = await asyncio.to_thread(download_media, media_id)
            ocr_text = await asyncio.to_thread(extract_summary, file_bytes, mime_type)
            sb.table("ocr_summary").insert({
                "tenant_id": tenant_id,
                "contact_id": contact_id,
                "summary_encrypted": ocr_text,
                "document_type": "autre",
                "processed_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
            return caption or "Document envoyé", f"\n[Résumé OCR : {ocr_text[:800]}]"
        except Exception as exc:
            logger.error("OCR échoué pour wa_id %s : %s", wa_id, exc)
            send_text(wa_id, "J'ai reçu votre document mais n'ai pas pu le traiter.")
            return caption or "Document envoyé (traitement échoué)", ""

    if msg_type == "audio":
        send_text(wa_id, "Je ne traite pas encore les messages vocaux.")
        return None, ""

    send_text(wa_id, "Je ne peux traiter que les messages texte et les documents.")
    return None, ""
