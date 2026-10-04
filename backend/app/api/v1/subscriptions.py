import stripe
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
from datetime import datetime, timezone

from app.core.urls import safe_redirect_url
from app.middleware.roles import require_owner_or_admin
from app.middleware.tenant import get_current_tenant
from app.core.supabase import get_supabase_admin
from app.core.config import settings
from app.services.subscription import get_tenant_plan

logger = logging.getLogger(__name__)


def _get_owner_info(supabase, tenant_id: str) -> dict:
    """Retourne {email, name, tenant_name, country} du propriétaire d'un tenant."""
    try:
        tenant = supabase.table("tenant").select("name, country").eq("id", tenant_id).single().execute().data or {}
        owner_m = supabase.table("membership").select("user_id").eq("tenant_id", tenant_id).eq("role", "owner").limit(1).execute()
        if not owner_m.data:
            return {}
        user_id = owner_m.data[0]["user_id"]
        user_res = supabase.auth.admin.get_user_by_id(user_id)
        user = user_res.user if user_res else None
        email = user.email if user else None
        name = ((user.user_metadata or {}).get("full_name") or (user.user_metadata or {}).get("name") or "") if user else ""
        return {"email": email, "name": name, "tenant_name": tenant.get("name", ""), "country": tenant.get("country", "BE")}
    except Exception as exc:
        logger.warning("_get_owner_info failed for tenant %s: %s", tenant_id, exc)
        return {}

stripe.api_key = settings.stripe_secret_key.strip()

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


class CheckoutIn(BaseModel):
    plan_id: str
    # Validées contre les origines autorisées (app/core/urls.py) : Stripe
    # redirigeait auparavant vers n'importe quelle URL fournie par le client.
    success_url: str | None = None
    cancel_url: str | None = None


@router.get("/plans")
async def list_plans():
    """Retourne les plans disponibles (public)."""
    supabase = get_supabase_admin()
    plans = supabase.table("plan_subscription").select("id, name, price_monthly, stripe_price_id").order("price_monthly").execute()
    return plans.data or []


@router.post("/checkout")
async def create_checkout(body: CheckoutIn, tenant_id: str = Depends(require_owner_or_admin)):
    supabase = get_supabase_admin()

    plan = supabase.table("plan_subscription").select("id, name, stripe_price_id").eq("id", body.plan_id).single().execute().data
    if not plan or not plan.get("stripe_price_id"):
        raise HTTPException(status_code=404, detail="Plan introuvable")

    tenant = supabase.table("tenant").select("id, name, stripe_customer_id").eq("id", tenant_id).single().execute().data
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    # Un tenant déjà abonné doit passer par le portail : sans ce garde-fou,
    # un second Checkout créait un deuxième abonnement Stripe, et l'upsert du
    # webhook (UNIQUE(tenant_id)) écrasait la ligne — l'ancien abonnement
    # continuait d'être facturé sans trace en base.
    existing = (
        supabase.table("subscription")
        .select("stripe_subscription_id, status")
        .eq("tenant_id", tenant_id)
        .in_("status", ["active", "trialing", "past_due"])
        .limit(1)
        .execute()
    )
    if existing.data and existing.data[0].get("stripe_subscription_id"):
        raise HTTPException(
            status_code=409,
            detail="Un abonnement est déjà actif. Changez de plan depuis le portail de facturation.",
        )

    params: dict = {
        "mode": "subscription",
        "payment_method_types": ["card"],
        "line_items": [{"price": plan["stripe_price_id"], "quantity": 1}],
        "success_url": safe_redirect_url(
            body.success_url, "/dashboard/settings?section=abonnement&checkout_success=1"),
        "cancel_url": safe_redirect_url(body.cancel_url, "/dashboard/settings?section=abonnement"),
        "client_reference_id": tenant_id,
        "metadata": {"tenant_id": tenant_id, "plan_id": body.plan_id},
    }
    # Réutiliser le customer existant évite d'en créer un nouveau à chaque
    # souscription (doublons côté Stripe, historique de facturation éclaté).
    if tenant.get("stripe_customer_id"):
        params["customer"] = tenant["stripe_customer_id"]

    try:
        session = stripe.checkout.Session.create(**params)
    except stripe.error.AuthenticationError:
        raise HTTPException(status_code=503, detail="Clé Stripe non configurée — contactez le support.")
    except stripe.error.InvalidRequestError as e:
        raise HTTPException(status_code=400, detail=f"Erreur Stripe : {e.user_message or str(e)}")
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=502, detail=f"Erreur paiement : {e.user_message or str(e)}")

    return {"checkout_url": session.url}


# ── Idempotence des webhooks ─────────────────────────────────────────────────

def _claim_event(sb, event: dict) -> bool:
    """
    True si cet événement n'a pas encore été traité.

    Stripe relivre un événement jusqu'à 3 jours en cas d'erreur : sans
    déduplication, un retry de invoice.payment_succeeded renvoyait un reçu au
    client et un retry de checkout.session.completed rejouait la logique métier.

    En cas de panne de la table (migration non appliquée par exemple), on
    laisse passer l'événement : perdre une souscription est plus grave que
    risquer un doublon.
    """
    event_id = event.get("id")
    if not event_id:
        return True
    try:
        seen = sb.table("stripe_event").select("id").eq("id", event_id).limit(1).execute()
        if seen.data:
            logger.info("Webhook Stripe %s deja traite, ignore", event_id)
            return False
    except Exception as exc:
        logger.warning("stripe_event illisible (%s) — traitement sans idempotence", exc)
        return True

    try:
        sb.table("stripe_event").insert({"id": event_id, "type": event.get("type", "")}).execute()
    except Exception as exc:
        # Insertion concurrente (deux livraisons en parallèle) → déjà traité.
        if "duplicate" in str(exc).lower() or "23505" in str(exc):
            return False
        logger.warning("stripe_event non enregistre (%s) — traitement sans idempotence", exc)
    return True


def _session_is_paid(session: dict) -> bool:
    """
    True si la session Checkout est réellement encaissée.

    `checkout.session.completed` ne garantit pas le paiement : avec un moyen
    asynchrone (SEPA, Bancontact différé), l'événement arrive avant
    l'encaissement. `no_payment_required` couvre les abonnements à essai.
    """
    return session.get("payment_status") in ("paid", "no_payment_required")


def _record_incident(sb, tenant_id: str | None, kind: str, reference: str | None,
                     amount: float | None, currency: str | None,
                     refunded: bool, detail: str) -> None:
    try:
        sb.table("payment_incident").insert({
            "tenant_id": tenant_id,
            "kind": kind,
            "provider": "stripe",
            "reference": reference,
            "amount": amount,
            "currency": currency,
            "refunded": refunded,
            "detail": detail[:500],
        }).execute()
    except Exception as exc:
        logger.error("payment_incident non enregistre (%s): %s", kind, exc)


def _refund_session(session: dict) -> bool:
    """Rembourse intégralement le paiement d'une session Checkout."""
    payment_intent = session.get("payment_intent")
    if not payment_intent:
        return False
    try:
        stripe.Refund.create(payment_intent=payment_intent)
        return True
    except stripe.error.StripeError as exc:
        logger.error("Remboursement Stripe echoue (pi=%s): %s", payment_intent, exc)
        return False


@router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, settings.stripe_webhook_secret)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Signature invalide")
    except ValueError:
        raise HTTPException(status_code=400, detail="Payload invalide")

    supabase = get_supabase_admin()
    if not _claim_event(supabase, event):
        return {"received": True, "duplicate": True}

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        meta = session.get("metadata", {}) or {}
        tenant_id = meta.get("tenant_id") or session.get("client_reference_id")
        event_type = meta.get("type")
        addon_type = meta.get("addon_type")
        plan_id = meta.get("plan_id")
        stripe_subscription_id = session.get("subscription")

        # Rien n'est provisionné tant que l'argent n'est pas encaissé.
        if not _session_is_paid(session):
            logger.warning("checkout.session.completed non paye (%s, payment_status=%s) — ignore",
                           session.get("id"), session.get("payment_status"))
            return {"received": True, "unpaid": True}

        if tenant_id and event_type == "domain_purchase":
            # ── Achat domaine via OVH déclenché après paiement Stripe confirmé ──
            domain = meta.get("domain")
            auto_renew = meta.get("auto_renew") == "true"
            if domain:
                sb = supabase
                # Idempotence métier — ne pas racheter si déjà traité
                already = sb.table("custom_domain").select("id").eq("domain", domain).limit(1).execute()
                if not already.data:
                    from app.services import ovh_domains, vercel_domains as vd
                    # 1. Achat OVH — si l'enregistrement échoue, le client a payé
                    #    pour rien : on rembourse et on alerte au lieu de se
                    #    contenter d'une ligne de log.
                    try:
                        await ovh_domains.purchase_domain(domain)
                    except Exception as exc:
                        logger.error("OVH purchase failed for %s: %s", domain, exc)
                        refunded = _refund_session(session)
                        _record_incident(
                            sb, tenant_id, "domain_purchase_failed", session.get("id"),
                            (session.get("amount_total") or 0) / 100,
                            (session.get("currency") or "eur").upper(),
                            refunded, f"domaine={domain} erreur={exc}",
                        )
                        try:
                            from app.services.email import send_payment_incident_admin
                            send_payment_incident_admin(
                                kind="Achat de domaine échoué",
                                reference=domain,
                                amount=(session.get("amount_total") or 0) / 100,
                                currency=(session.get("currency") or "eur").upper(),
                                refunded=refunded,
                                detail=str(exc),
                            )
                        except Exception as mail_exc:
                            logger.warning("Alerte incident paiement non envoyee: %s", mail_exc)
                        return {"received": True, "refunded": refunded}
                    # 2. DNS automatique dans la zone OVH
                    try:
                        await ovh_domains.configure_dns(domain)
                    except Exception:
                        pass
                    # 3. Ajouter dans Vercel
                    try:
                        await vd.add_domain(domain)
                    except Exception:
                        pass
                    # 4. Enregistrer en base
                    sb.table("custom_domain").upsert({
                        "tenant_id": tenant_id,
                        "domain": domain,
                        "status": "pending",
                        "source": "ovh_purchased",
                        "auto_renew": auto_renew,
                        "dns_record_type": "CNAME",
                        "dns_record_name": "www",
                        "dns_record_value": "cname.vercel-dns.com",
                    }, on_conflict="tenant_id").execute()

        elif tenant_id and addon_type == "custom_domain":
            # L'id d'abonnement de l'addon est désormais persisté : sans lui,
            # customer.subscription.deleted ne pouvait pas le désactiver et
            # l'addon restait actif à vie après résiliation.
            supabase.table("tenant").update({
                "custom_domain_addon": True,
                "custom_domain_addon_sub_id": stripe_subscription_id,
            }).eq("id", tenant_id).execute()
            # Si un domaine était déjà en DB, l'activer sur Vercel maintenant
            domain_row = supabase.table("custom_domain").select("domain").eq("tenant_id", tenant_id).limit(1).execute()
            if domain_row.data:
                from app.services import vercel_domains as vd
                try:
                    await vd.add_domain(domain_row.data[0]["domain"])
                except Exception:
                    pass

        elif event_type == "logo_request":
            # ── Paiement logo confirmé ──
            logo_request_id = meta.get("logo_request_id")
            payment_intent  = session.get("payment_intent")
            if logo_request_id:
                supabase.table("logo_request").update({
                    "status":                   "paid",
                    "stripe_payment_intent_id": payment_intent,
                }).eq("id", logo_request_id).execute()

        elif tenant_id and plan_id:
            # Le statut réel vient de Stripe : écrire "active" en dur masquait
            # les abonnements en essai (trialing) ou incomplets.
            real_status = "active"
            if stripe_subscription_id:
                try:
                    real_status = stripe.Subscription.retrieve(stripe_subscription_id).status
                except stripe.error.StripeError as exc:
                    logger.warning("Statut Stripe illisible pour %s: %s", stripe_subscription_id, exc)

            supabase.table("subscription").upsert({
                "tenant_id": tenant_id,
                "plan_id": plan_id,
                "stripe_subscription_id": stripe_subscription_id,
                "status": real_status,
                "past_due_since": None,
            }, on_conflict="tenant_id").execute()
            # Persiste le stripe_customer_id sur le tenant pour le portail
            customer_id = session.get("customer")
            if customer_id:
                supabase.table("tenant").update({"stripe_customer_id": customer_id}).eq("id", tenant_id).execute()
            # Email de confirmation d'abonnement
            try:
                plan_row = supabase.table("plan_subscription").select("name").eq("id", plan_id).maybe_single().execute()
                plan_name = (plan_row.data or {}).get("name", "Pro")
                owner = _get_owner_info(supabase, tenant_id)
                if owner.get("email"):
                    from app.services.email import send_subscription_confirmed
                    send_subscription_confirmed(
                        owner_email=owner["email"],
                        owner_name=owner["name"],
                        tenant_name=owner["tenant_name"],
                        country=owner["country"],
                        plan_name=plan_name,
                        dashboard_url=f"{settings.frontend_url}/dashboard",
                        subscription_settings_url=f"{settings.frontend_url}/dashboard/settings?section=abonnement",
                    )
            except Exception as exc:
                logger.warning("send_subscription_confirmed failed: %s", exc)

    elif event["type"] == "checkout.session.async_payment_failed":
        session = event["data"]["object"]
        logger.warning("Paiement asynchrone echoue pour la session %s", session.get("id"))
        _record_incident(
            supabase, (session.get("metadata") or {}).get("tenant_id"),
            "async_payment_failed", session.get("id"),
            (session.get("amount_total") or 0) / 100,
            (session.get("currency") or "eur").upper(),
            False, "checkout.session.async_payment_failed",
        )

    elif event["type"] == "customer.subscription.updated":
        sub = event["data"]["object"]
        stripe_sub_id = sub["id"]
        new_status = sub["status"]  # active, trialing, past_due, canceled…
        updates: dict = {"status": new_status}
        # Le début de l'impayé sert à calculer la période de grâce côté
        # get_tenant_plan() ; il est remis à zéro dès le retour en règle.
        if new_status == "past_due":
            updates["past_due_since"] = datetime.now(timezone.utc).isoformat()
        elif new_status in ("active", "trialing"):
            updates["past_due_since"] = None
        supabase.table("subscription").update(updates).eq("stripe_subscription_id", stripe_sub_id).execute()

    elif event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        stripe_sub_id = sub["id"]
        supabase.table("subscription").update({"status": "canceled"}).eq("stripe_subscription_id", stripe_sub_id).execute()
        # Résiliation de l'addon domaine : le flag doit retomber.
        addon_tenants = supabase.table("tenant").select("id") \
            .eq("custom_domain_addon_sub_id", stripe_sub_id).execute()
        for row in (addon_tenants.data or []):
            supabase.table("tenant").update({
                "custom_domain_addon": False,
                "custom_domain_addon_sub_id": None,
            }).eq("id", row["id"]).execute()
            logger.info("Addon domaine desactive pour le tenant %s", row["id"])

    elif event["type"] == "invoice.payment_succeeded":
        invoice = event["data"]["object"]
        # Ignorer les factures à zéro (setup, essais gratuits)
        if (invoice.get("amount_paid") or 0) == 0:
            return {"received": True}
        stripe_sub_id = invoice.get("subscription")
        if stripe_sub_id:
            sub_row = supabase.table("subscription").select("tenant_id, plan_id") \
                .eq("stripe_subscription_id", stripe_sub_id).maybe_single().execute()
            sub_data = sub_row.data or {}
            paid_tenant_id = sub_data.get("tenant_id")
            plan_id = sub_data.get("plan_id")
            if paid_tenant_id:
                try:
                    from datetime import datetime as _dt
                    plan_row = supabase.table("plan_subscription").select("name").eq("id", plan_id).maybe_single().execute()
                    plan_name = (plan_row.data or {}).get("name", "Pro")
                    owner = _get_owner_info(supabase, paid_tenant_id)
                    if owner.get("email"):
                        from app.services.email import send_stripe_receipt
                        amount = (invoice.get("amount_paid") or 0) / 100
                        currency = (invoice.get("currency") or "eur").upper()
                        p_start = invoice.get("period_start") or 0
                        p_end   = invoice.get("period_end") or 0
                        period_start = _dt.fromtimestamp(p_start).strftime("%d/%m/%Y") if p_start else ""
                        period_end   = _dt.fromtimestamp(p_end).strftime("%d/%m/%Y") if p_end else ""
                        send_stripe_receipt(
                            owner_email=owner["email"],
                            owner_name=owner["name"],
                            tenant_name=owner["tenant_name"],
                            country=owner["country"],
                            plan_name=plan_name,
                            amount=amount,
                            currency=currency,
                            period_start=period_start,
                            period_end=period_end,
                            invoice_number=invoice.get("number", ""),
                            pdf_url=invoice.get("invoice_pdf", ""),
                        )
                except Exception as exc:
                    logger.warning("send_stripe_receipt failed: %s", exc)

    elif event["type"] == "invoice.payment_failed":
        invoice = event["data"]["object"]
        stripe_sub_id = invoice.get("subscription")
        if stripe_sub_id:
            supabase.table("subscription").update({
                "status": "past_due",
                "past_due_since": datetime.now(timezone.utc).isoformat(),
            }).eq("stripe_subscription_id", stripe_sub_id).execute()
            # Email d'alerte de paiement échoué
            try:
                sub_row = supabase.table("subscription").select("tenant_id").eq("stripe_subscription_id", stripe_sub_id).maybe_single().execute()
                failed_tenant_id = (sub_row.data or {}).get("tenant_id")
                if failed_tenant_id:
                    owner = _get_owner_info(supabase, failed_tenant_id)
                    if owner.get("email"):
                        from app.services.email import send_subscription_payment_failed
                        send_subscription_payment_failed(
                            owner_email=owner["email"],
                            owner_name=owner["name"],
                            tenant_name=owner["tenant_name"],
                            country=owner["country"],
                            billing_portal_url=f"{settings.frontend_url}/dashboard/settings?section=abonnement",
                        )
            except Exception as exc:
                logger.warning("send_subscription_payment_failed failed: %s", exc)

    elif event["type"] == "charge.refunded":
        charge = event["data"]["object"]
        _record_incident(
            supabase, None, "charge_refunded", charge.get("payment_intent"),
            (charge.get("amount_refunded") or 0) / 100,
            (charge.get("currency") or "eur").upper(),
            True, f"charge={charge.get('id')}",
        )

    elif event["type"] == "charge.dispute.created":
        dispute = event["data"]["object"]
        # Un litige doit être visible immédiatement côté opérateur : il peut
        # aboutir à un retrait de fonds et justifier une suspension.
        _record_incident(
            supabase, None, "charge_disputed", dispute.get("payment_intent"),
            (dispute.get("amount") or 0) / 100,
            (dispute.get("currency") or "eur").upper(),
            False, f"dispute={dispute.get('id')} reason={dispute.get('reason')}",
        )
        try:
            from app.services.email import send_payment_incident_admin
            send_payment_incident_admin(
                kind="Litige bancaire ouvert",
                reference=str(dispute.get("payment_intent") or dispute.get("id")),
                amount=(dispute.get("amount") or 0) / 100,
                currency=(dispute.get("currency") or "eur").upper(),
                refunded=False,
                detail=f"Motif : {dispute.get('reason')}",
            )
        except Exception as exc:
            logger.warning("Alerte litige non envoyee: %s", exc)

    return {"received": True}


@router.post("/billing-portal")
async def billing_portal(tenant_id: str = Depends(require_owner_or_admin)):
    """
    Ouvre le portail de facturation Stripe pour le tenant courant.

    Réservé owner/admin : le portail expose les factures, le moyen de paiement
    et permet de résilier. Le masquage côté frontend (OWNER_ONLY_SECTIONS) ne
    protégeait pas l'endpoint.
    """
    supabase = get_supabase_admin()

    return_url = f"{settings.frontend_url}/dashboard/settings?section=abonnement"

    # 1. Essai via stripe_customer_id sur le tenant (chemin rapide)
    tenant_row = supabase.table("tenant").select("stripe_customer_id").eq("id", tenant_id).maybe_single().execute()
    customer_id = (tenant_row.data or {}).get("stripe_customer_id")

    # 2. Fallback : récupère le customer depuis l'abonnement Stripe
    if not customer_id:
        sub = supabase.table("subscription").select("stripe_subscription_id").eq("tenant_id", tenant_id).in_("status", ["active", "trialing"]).limit(1).execute()
        stripe_sub_id = (sub.data[0].get("stripe_subscription_id") if sub.data else None)
        if not stripe_sub_id:
            raise HTTPException(status_code=404, detail="Aucun abonnement Stripe trouvé. Souscrivez d'abord à un plan.")
        try:
            stripe_sub = stripe.Subscription.retrieve(stripe_sub_id)
            customer_id = stripe_sub["customer"]
            # Sauvegarde pour les prochaines fois
            supabase.table("tenant").update({"stripe_customer_id": customer_id}).eq("id", tenant_id).execute()
        except stripe.error.StripeError as e:
            raise HTTPException(status_code=502, detail=f"Service de paiement indisponible : {e.user_message or str(e)}")

    try:
        session = stripe.billing_portal.Session.create(customer=customer_id, return_url=return_url)
        return {"url": session.url}
    except stripe.error.InvalidRequestError as e:
        raise HTTPException(status_code=400, detail=f"Erreur Stripe : {e.user_message or str(e)}")
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=502, detail=f"Service de paiement indisponible : {e.user_message or str(e)}")


@router.get("/plan")
async def get_my_plan(tenant_id: str = Depends(get_current_tenant)):
    """
    Retourne le plan, les features et les infos de facturation du tenant courant.

    price_monthly et stripe_subscription_id sont inclus pour que le dashboard
    n'ait plus à lire la table `subscription` directement avec la clé anon :
    cette lecture passait par un `.single()` sur membership, qui échouait dès
    qu'un compte possédait plusieurs espaces (plan Business) et affichait
    « Aucun abonnement » à des clients payants.
    """
    plan = await get_tenant_plan(tenant_id)

    sb = get_supabase_admin()
    row = (
        sb.table("subscription")
        .select("stripe_subscription_id, status, plan:plan_id(name, price_monthly)")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    )
    sub = (row.data or [None])[0]
    if sub:
        plan["stripe_subscription_id"] = sub.get("stripe_subscription_id")
        plan["price_monthly"] = (sub.get("plan") or {}).get("price_monthly")
        plan["subscription_status"] = sub.get("status")
    else:
        plan["stripe_subscription_id"] = None
        plan["price_monthly"] = None
        plan["subscription_status"] = None

    return plan
