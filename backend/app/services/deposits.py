"""
Remboursement des acomptes PayPal attachés à un rendez-vous.

Avant ce module, aucun remboursement n'existait dans le code : annuler ou
refuser un rendez-vous dont l'acompte avait été encaissé laissait l'argent
chez le professionnel, sans trace ni information au client.

Politique retenue :
- refus d'une demande en attente  → remboursement AUTOMATIQUE (le pro n'a
  jamais accepté le rendez-vous, garder l'acompte n'est pas défendable) ;
- annulation d'un rendez-vous déjà confirmé → remboursement MANUEL, via
  POST /appointments/{id}/refund-deposit (le pro peut légitimement retenir
  l'acompte selon ses conditions).
"""
import logging

from app.services.paypal import get_deposit_config, refund_capture, refund_order

logger = logging.getLogger(__name__)

# Statuts d'acompte remboursables
REFUNDABLE_STATUSES: frozenset = frozenset({"paid", "refund_failed"})


def is_refundable(appt: dict) -> bool:
    """True si ce rendez-vous porte un acompte encaissé non encore remboursé."""
    if (appt.get("deposit_status") or "none") not in REFUNDABLE_STATUSES:
        return False
    return bool(appt.get("deposit_capture_id") or appt.get("deposit_paypal_order_id"))


async def refund_appointment_deposit(sb, tenant_id: str, appt: dict,
                                     note: str = "Remboursement d'acompte") -> dict:
    """
    Rembourse l'acompte d'un rendez-vous et met à jour sa ligne.

    Renvoie {"refunded": bool, "reason": str | None, "refund_id": str | None}.
    Ne lève pas : l'appelant décide quoi faire d'un échec, l'annulation du
    rendez-vous ne doit pas être bloquée par une panne PayPal.
    """
    if not is_refundable(appt):
        return {"refunded": False, "reason": "no_deposit", "refund_id": None}

    cfg = get_deposit_config(sb, tenant_id)
    if cfg is None:
        # Le tenant a pu désactiver l'acompte ou changer ses credentials
        # depuis l'encaissement : on ne peut plus appeler PayPal en son nom.
        logger.error("Remboursement impossible (config PayPal absente) tenant=%s appt=%s",
                     tenant_id, appt.get("id"))
        _mark(sb, appt, "refund_failed")
        _record_incident(sb, tenant_id, appt, "refund_config_missing")
        return {"refunded": False, "reason": "config_missing", "refund_id": None}

    amount = appt.get("deposit_amount")
    currency = appt.get("deposit_currency") or cfg["currency"]

    try:
        if appt.get("deposit_capture_id"):
            result = await refund_capture(
                cfg["client_id"], cfg["client_secret"], appt["deposit_capture_id"],
                sandbox=cfg["sandbox"], amount=amount, currency=currency, note=note,
            )
        else:
            # Acomptes encaissés avant la migration 072 : seul l'order est connu.
            result = await refund_order(
                cfg["client_id"], cfg["client_secret"], appt["deposit_paypal_order_id"],
                sandbox=cfg["sandbox"], amount=amount, currency=currency, note=note,
            )
    except Exception as exc:
        logger.error("Remboursement PayPal échoué tenant=%s appt=%s : %s",
                     tenant_id, appt.get("id"), exc)
        _mark(sb, appt, "refund_failed")
        _record_incident(sb, tenant_id, appt, "refund_failed", detail=str(exc)[:500])
        return {"refunded": False, "reason": "paypal_error", "refund_id": None}

    from datetime import datetime, timezone
    try:
        sb.table("appointment").update({
            "deposit_status": "refunded",
            "deposit_refund_id": result.get("refund_id"),
            "deposit_refunded_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", appt["id"]).execute()
    except Exception as exc:
        # L'argent est rendu : on ne renvoie pas d'échec, mais l'écart entre
        # PayPal et la base doit être visible.
        logger.error("Acompte remboursé mais statut non persisté appt=%s : %s", appt.get("id"), exc)
        _record_incident(sb, tenant_id, appt, "refund_status_not_persisted", detail=str(exc)[:500])

    return {"refunded": True, "reason": None, "refund_id": result.get("refund_id")}


def _mark(sb, appt: dict, status: str) -> None:
    try:
        sb.table("appointment").update({"deposit_status": status}).eq("id", appt["id"]).execute()
    except Exception as exc:
        logger.error("Statut d'acompte non mis à jour appt=%s : %s", appt.get("id"), exc)


def _record_incident(sb, tenant_id: str, appt: dict, kind: str, detail: str = "") -> None:
    try:
        sb.table("payment_incident").insert({
            "tenant_id": tenant_id,
            "kind": kind,
            "provider": "paypal",
            "reference": appt.get("deposit_capture_id") or appt.get("deposit_paypal_order_id"),
            "amount": appt.get("deposit_amount"),
            "currency": appt.get("deposit_currency"),
            "refunded": False,
            "detail": detail or f"appointment={appt.get('id')}",
        }).execute()
    except Exception as exc:
        logger.error("payment_incident non enregistré (%s) : %s", kind, exc)
