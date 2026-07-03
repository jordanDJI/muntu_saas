import stripe
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
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
    success_url: str
    cancel_url: str


@router.get("/plans")
async def list_plans():
    """Retourne les plans disponibles (public)."""
    supabase = get_supabase_admin()
    plans = supabase.table("plan_subscription").select("id, name, price_monthly, stripe_price_id").order("price_monthly").execute()
    return plans.data or []


@router.post("/checkout")
async def create_checkout(body: CheckoutIn, tenant_id: str = Depends(get_current_tenant)):
    supabase = get_supabase_admin()

    plan = supabase.table("plan_subscription").select("id, name, stripe_price_id").eq("id", body.plan_id).single().execute().data
    if not plan or not plan.get("stripe_price_id"):
        raise HTTPException(status_code=404, detail="Plan introuvable")

    tenant = supabase.table("tenant").select("id, name").eq("id", tenant_id).single().execute().data
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{"price": plan["stripe_price_id"], "quantity": 1}],
            success_url=body.success_url,
            cancel_url=body.cancel_url,
            metadata={"tenant_id": tenant_id, "plan_id": body.plan_id},
        )
    except stripe.error.AuthenticationError:
        raise HTTPException(status_code=503, detail="Clé Stripe non configurée — contactez le support.")
    except stripe.error.InvalidRequestError as e:
        raise HTTPException(status_code=400, detail=f"Erreur Stripe : {e.user_message or str(e)}")
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=502, detail=f"Erreur paiement : {e.user_message or str(e)}")

    return {"checkout_url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, settings.stripe_webhook_secret)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Signature invalide")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        meta = session.get("metadata", {})
        tenant_id = meta.get("tenant_id")
        addon_type = meta.get("addon_type")
        plan_id = meta.get("plan_id")
        stripe_subscription_id = session.get("subscription")

        event_type = meta.get("type")
        addon_type = meta.get("addon_type")

        if tenant_id and event_type == "domain_purchase":
            # ── Achat domaine via OVH déclenché après paiement Stripe confirmé ──
            domain = meta.get("domain")
            auto_renew = meta.get("auto_renew") == "true"
            if domain:
                supabase = get_supabase_admin()
                # Idempotence — ne pas racheter si déjà traité
                already = supabase.table("custom_domain").select("id").eq("domain", domain).limit(1).execute()
                if not already.data:
                    from app.services import ovh_domains, vercel_domains as vd
                    # 1. Achat OVH
                    try:
                        await ovh_domains.purchase_domain(domain)
                    except Exception as exc:
                        import logging
                        logging.getLogger(__name__).error("OVH purchase failed for %s: %s", domain, exc)
                        # TODO: déclencher un remboursement Stripe automatique
                        return {"received": True}
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
                    supabase.table("custom_domain").upsert({
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
            supabase = get_supabase_admin()
            supabase.table("tenant").update({"custom_domain_addon": True}).eq("id", tenant_id).execute()
            # Si un domaine était déjà en DB, l'activer sur Vercel maintenant
            domain_row = supabase.table("custom_domain").select("domain").eq("tenant_id", tenant_id).limit(1).execute()
            if domain_row.data:
                from app.services import vercel_domains as vd
                try:
                    await vd.add_domain(domain_row.data[0]["domain"])
                except Exception:
                    pass

        elif meta.get("type") == "logo_request":
            # ── Paiement logo confirmé ──
            logo_request_id = meta.get("logo_request_id")
            payment_intent  = session.get("payment_intent")
            if logo_request_id:
                supabase = get_supabase_admin()
                supabase.table("logo_request").update({
                    "status":                   "paid",
                    "stripe_payment_intent_id": payment_intent,
                }).eq("id", logo_request_id).execute()

        elif tenant_id and plan_id:
            supabase = get_supabase_admin()
            supabase.table("subscription").upsert({
                "tenant_id": tenant_id,
                "plan_id": plan_id,
                "stripe_subscription_id": stripe_subscription_id,
                "status": "active",
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

    elif event["type"] == "customer.subscription.updated":
        sub = event["data"]["object"]
        stripe_sub_id = sub["id"]
        new_status = sub["status"]  # active, trialing, past_due, canceled…
        supabase = get_supabase_admin()
        supabase.table("subscription").update({"status": new_status}).eq("stripe_subscription_id", stripe_sub_id).execute()

    elif event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        stripe_sub_id = sub["id"]
        supabase = get_supabase_admin()
        supabase.table("subscription").update({"status": "canceled"}).eq("stripe_subscription_id", stripe_sub_id).execute()

    elif event["type"] == "invoice.payment_succeeded":
        invoice = event["data"]["object"]
        # Ignorer les factures à zéro (setup, essais gratuits)
        if (invoice.get("amount_paid") or 0) == 0:
            return {"received": True}
        stripe_sub_id = invoice.get("subscription")
        if stripe_sub_id:
            supabase = get_supabase_admin()
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
            supabase = get_supabase_admin()
            supabase.table("subscription").update({"status": "past_due"}).eq("stripe_subscription_id", stripe_sub_id).execute()
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

    return {"received": True}


@router.post("/billing-portal")
async def billing_portal(tenant_id: str = Depends(get_current_tenant)):
    """Ouvre le portail de facturation Stripe pour le tenant courant."""
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
    """Retourne le plan et les features du tenant courant."""
    return await get_tenant_plan(tenant_id)
