import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
from app.middleware.tenant import get_current_tenant
from app.core.supabase import get_supabase_admin
from app.core.config import settings
from app.services.subscription import get_tenant_plan

stripe.api_key = settings.stripe_secret_key

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

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": plan["stripe_price_id"], "quantity": 1}],
        success_url=body.success_url,
        cancel_url=body.cancel_url,
        metadata={"tenant_id": tenant_id, "plan_id": body.plan_id},
    )

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

        elif tenant_id and plan_id:
            supabase = get_supabase_admin()
            supabase.table("subscription").upsert({
                "tenant_id": tenant_id,
                "plan_id": plan_id,
                "stripe_subscription_id": stripe_subscription_id,
                "status": "active",
            }, on_conflict="tenant_id").execute()

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

    elif event["type"] == "invoice.payment_failed":
        invoice = event["data"]["object"]
        stripe_sub_id = invoice.get("subscription")
        if stripe_sub_id:
            supabase = get_supabase_admin()
            supabase.table("subscription").update({"status": "past_due"}).eq("stripe_subscription_id", stripe_sub_id).execute()

    return {"received": True}


@router.post("/billing-portal")
async def billing_portal(tenant_id: str = Depends(get_current_tenant)):
    """Ouvre le portail de facturation Stripe pour le tenant courant."""
    supabase = get_supabase_admin()
    sub = supabase.table("subscription").select("stripe_subscription_id").eq("tenant_id", tenant_id).eq("status", "active").limit(1).execute()
    if not sub.data or not sub.data[0].get("stripe_subscription_id"):
        raise HTTPException(status_code=404, detail="Aucun abonnement actif")

    stripe_sub = stripe.Subscription.retrieve(sub.data[0]["stripe_subscription_id"])
    customer_id = stripe_sub["customer"]

    return_url = "https://klientys.co/dashboard/settings"
    if settings.app_env != "production":
        return_url = f"{settings.frontend_url}/dashboard/settings"

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
    return {"url": session.url}


@router.get("/plan")
async def get_my_plan(tenant_id: str = Depends(get_current_tenant)):
    """Retourne le plan et les features du tenant courant."""
    return await get_tenant_plan(tenant_id)
