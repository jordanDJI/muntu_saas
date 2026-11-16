"""
Parrainage : un mois offert au filleul et un mois offert au parrain.

Déroulé :
1. Le code de parrainage est le slug du parrain. Il arrive par le badge des sites
   clients (`?ref={slug}&via=badge`), par le lien partagé depuis Paramètres →
   Parrainage, ou saisi à la main à l'inscription.
2. `record_signup()` résout le code en tenant et crée la ligne `referral` à la
   création de l'espace du filleul (onboarding).
3. `checkout_discounts()` : au premier Checkout du filleul, coupon Stripe 100 %
   sur une facture → premier mois offert.
4. `on_first_payment()` : à la première facture **réellement payée** du filleul
   (montant > 0, donc le mois suivant le mois offert), le parrain est récompensé :
   - avec un client Stripe : crédit du prix mensuel de son plan sur son solde,
     imputé automatiquement sur sa prochaine facture ;
   - sans client Stripe (encore en essai) : 30 jours d'essai supplémentaires.

Garde-fous : un tenant ne peut pas se parrainer lui-même ni être parrainé par un
espace dont son propriétaire est membre ; un filleul n'a qu'un parrain
(UNIQUE(referred_tenant_id)) ; la récompense n'est versée qu'une fois (mise à
jour conditionnelle sur `status = 'signed_up'`).
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone

import stripe

from app.core.urls import default_frontend

logger = logging.getLogger(__name__)

COUPON_ID = "klientys_referral_first_month"
REWARD_TRIAL_DAYS = 30
TRIAL_DAYS = 14
VIA_VALUES = ("link", "badge", "code")

_CODE_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,79}$")


# ── Règles pures (tests/test_referral.py) ──────────────────────────────────────

def normalize_code(code: str | None) -> str | None:
    """Code de parrainage = slug : minuscules, chiffres, tirets. None si invalide."""
    if not code:
        return None
    value = code.strip().lower()
    if value.startswith("http"):
        # Lien collé en entier : on garde le paramètre ref s'il existe.
        match = re.search(r"[?&]ref=([^&#]+)", value)
        value = match.group(1) if match else ""
    return value if _CODE_RE.match(value) else None


def normalize_via(via: str | None) -> str:
    return via if via in VIA_VALUES else "link"


def credit_cents(price_monthly: float | None) -> int:
    """Montant du crédit parrain en centimes (négatif côté Stripe au moment de l'appel)."""
    if not price_monthly or price_monthly <= 0:
        return 0
    return int(round(float(price_monthly) * 100))


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def extended_trial_end(created_at: str, trial_extended_until: str | None, now: datetime,
                       days: int = REWARD_TRIAL_DAYS) -> datetime:
    """Nouvelle fin d'essai : on ajoute `days` à la fin actuelle, ou à aujourd'hui si elle est passée."""
    current_end = _parse_dt(trial_extended_until) or (_parse_dt(created_at) + timedelta(days=TRIAL_DAYS))
    return max(current_end, now) + timedelta(days=days)


# ── Accès base et Stripe ───────────────────────────────────────────────────────

def resolve_referrer(sb, code: str | None) -> dict | None:
    slug = normalize_code(code)
    if not slug:
        return None
    rows = (
        sb.table("tenant").select("id, name, slug, suspended_at")
        .eq("slug", slug).limit(1).execute().data or []
    )
    if not rows or rows[0].get("suspended_at"):
        return None
    return rows[0]


def record_signup(sb, referred_tenant_id: str, user_id: str, code: str | None, via: str | None) -> bool:
    """Rattache un nouvel espace à son parrain. Ne lève jamais : l'inscription prime."""
    try:
        referrer = resolve_referrer(sb, code)
        if not referrer or referrer["id"] == referred_tenant_id:
            return False
        # Auto-parrainage : le nouvel inscrit est déjà membre de l'espace parrain
        # (second espace d'un même propriétaire, collaborateur).
        own = (
            sb.table("membership").select("tenant_id")
            .eq("user_id", user_id).eq("tenant_id", referrer["id"]).limit(1).execute().data
        )
        if own:
            logger.info("Parrainage ignoré : %s est membre de l'espace parrain %s", user_id, referrer["id"])
            return False
        sb.table("referral").insert({
            "referrer_tenant_id": referrer["id"],
            "referred_tenant_id": referred_tenant_id,
            "code_used": normalize_code(code),
            "via": normalize_via(via),
        }).execute()
        return True
    except Exception as exc:
        logger.warning("Parrainage non enregistré pour %s : %s", referred_tenant_id, exc, exc_info=True)
        return False


def _ensure_coupon() -> str:
    try:
        stripe.Coupon.retrieve(COUPON_ID)
    except stripe.error.InvalidRequestError:
        stripe.Coupon.create(
            id=COUPON_ID,
            percent_off=100,
            duration="once",
            name="Parrainage — 1er mois offert",
        )
    return COUPON_ID


def checkout_discounts(sb, tenant_id: str) -> list[dict] | None:
    """Coupon « 1er mois offert » si ce tenant a été parrainé et ne l'a pas encore utilisé."""
    try:
        rows = (
            sb.table("referral").select("id, referred_discount_at")
            .eq("referred_tenant_id", tenant_id).limit(1).execute().data or []
        )
        if not rows or rows[0].get("referred_discount_at"):
            return None
        return [{"coupon": _ensure_coupon()}]
    except Exception as exc:
        # Un incident Stripe sur le coupon ne doit pas empêcher de s'abonner.
        logger.warning("Coupon de parrainage indisponible (%s) : %s", tenant_id, exc, exc_info=True)
        return None


def mark_discount_used(sb, tenant_id: str) -> None:
    try:
        sb.table("referral").update({"referred_discount_at": datetime.now(timezone.utc).isoformat()}) \
            .eq("referred_tenant_id", tenant_id).is_("referred_discount_at", "null").execute()
    except Exception as exc:
        logger.warning("referral.referred_discount_at non posé (%s) : %s", tenant_id, exc, exc_info=True)


def _referrer_monthly_price(sb, referrer_id: str) -> float | None:
    sub = (
        sb.table("subscription").select("plan_id, status")
        .eq("tenant_id", referrer_id).limit(1).execute().data or []
    )
    plan_id = sub[0]["plan_id"] if sub and sub[0].get("status") in ("active", "trialing", "past_due") else None
    query = sb.table("plan_subscription").select("price_monthly")
    rows = (
        query.eq("id", plan_id).limit(1).execute().data if plan_id
        else query.order("price_monthly").limit(1).execute().data  # aucun plan : le moins cher
    ) or []
    return float(rows[0]["price_monthly"]) if rows and rows[0].get("price_monthly") else None


def on_first_payment(sb, referred_tenant_id: str) -> None:
    """Appelé à chaque facture payée (> 0 €) : récompense le parrain à la première seulement."""
    now = datetime.now(timezone.utc)
    try:
        claimed = (
            sb.table("referral")
            .update({"status": "converted", "converted_at": now.isoformat()})
            .eq("referred_tenant_id", referred_tenant_id)
            .eq("status", "signed_up")
            .execute().data or []
        )
    except Exception as exc:
        logger.warning("Parrainage : conversion non enregistrée (%s) : %s", referred_tenant_id, exc, exc_info=True)
        return
    if not claimed:
        return  # pas parrainé, ou déjà récompensé

    referral = claimed[0]
    referrer_id = referral["referrer_tenant_id"]
    status, detail = "failed", ""
    try:
        referrer = (
            sb.table("tenant").select("name, stripe_customer_id, created_at, trial_extended_until")
            .eq("id", referrer_id).single().execute().data
        )
        referred_name = (
            sb.table("tenant").select("name").eq("id", referred_tenant_id).single().execute().data or {}
        ).get("name", "")
        if referrer.get("stripe_customer_id"):
            amount = credit_cents(_referrer_monthly_price(sb, referrer_id))
            if amount <= 0:
                raise RuntimeError("prix du plan introuvable")
            stripe.Customer.create_balance_transaction(
                referrer["stripe_customer_id"],
                amount=-amount,
                currency="eur",
                description=f"Parrainage — 1 mois offert ({referred_name})"[:350],
                metadata={"referral_id": referral["id"]},
            )
            status, detail = "credited", f"{amount / 100:.2f} EUR crédités sur le solde Stripe"
        else:
            new_end = extended_trial_end(referrer["created_at"], referrer.get("trial_extended_until"), now)
            sb.table("tenant").update({"trial_extended_until": new_end.isoformat()}).eq("id", referrer_id).execute()
            status, detail = "trial_extended", f"essai prolongé jusqu'au {new_end.date().isoformat()}"
        _notify_referrer(sb, referrer_id, referred_name, status)
    except Exception as exc:
        detail = str(exc)[:300]
        logger.error("Récompense de parrainage échouée (referral %s) : %s", referral["id"], exc, exc_info=True)
    try:
        sb.table("referral").update({
            "reward_status": status,
            "reward_detail": detail,
            "rewarded_at": now.isoformat() if status != "failed" else None,
        }).eq("id", referral["id"]).execute()
    except Exception as exc:
        # Le webhook Stripe ne doit pas échouer pour une écriture de suivi.
        logger.error("Statut de récompense non enregistré (referral %s, %s) : %s",
                     referral["id"], status, exc, exc_info=True)


def _notify_referrer(sb, referrer_id: str, referred_name: str, status: str) -> None:
    try:
        from app.api.v1.subscriptions import _get_owner_info
        from app.services.email import send_referral_reward

        owner = _get_owner_info(sb, referrer_id)
        if owner.get("email"):
            send_referral_reward(
                owner_email=owner["email"],
                owner_name=owner.get("name", ""),
                referred_name=referred_name,
                trial_extended=(status == "trial_extended"),
                settings_url=f"{default_frontend()}/dashboard/settings?section=parrainage",
            )
    except Exception as exc:
        logger.warning("Email de récompense parrainage non envoyé (%s) : %s", referrer_id, exc, exc_info=True)


def referral_overview(sb, tenant_id: str) -> dict:
    """Ce que voit le tenant dans Paramètres → Parrainage."""
    tenant = sb.table("tenant").select("slug").eq("id", tenant_id).single().execute().data or {}
    slug = tenant.get("slug") or ""
    rows = (
        sb.table("referral")
        .select("id, via, status, reward_status, created_at, converted_at, referred:referred_tenant_id(name)")
        .eq("referrer_tenant_id", tenant_id)
        .order("created_at", desc=True)
        .limit(200)
        .execute().data or []
    )
    referrals = [{
        "name": (r.get("referred") or {}).get("name") or "—",
        "via": r.get("via"),
        "status": r.get("status"),
        "reward_status": r.get("reward_status"),
        "created_at": r.get("created_at"),
        "converted_at": r.get("converted_at"),
    } for r in rows]
    base = default_frontend()  # lien partagé par le tenant : domaine de production
    return {
        "code": slug,
        "link": f"{base}/?ref={slug}" if slug else "",
        "signed_up": len(referrals),
        "converted": sum(1 for r in referrals if r["status"] == "converted"),
        "rewarded": sum(1 for r in referrals if r["reward_status"] in ("credited", "trial_extended")),
        "referrals": referrals,
    }
