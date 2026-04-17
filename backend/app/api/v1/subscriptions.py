import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
from app.middleware.tenant import get_current_tenant
from app.core.supabase import get_supabase, get_supabase_admin
from app.core.config import settings

stripe.api_key = settings.stripe_secret_key

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


class CheckoutIn(BaseModel):
    plan_id: str
    success_url: str
    cancel_url: str


@router.post("/checkout")
async def create_checkout(body: CheckoutIn, tenant_id: str = Depends(get_current_tenant)):
    supabase = get_supabase()

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
        tenant_id = session.get("metadata", {}).get("tenant_id")
        plan_id = session.get("metadata", {}).get("plan_id")
        stripe_subscription_id = session.get("subscription")

        if tenant_id and plan_id:
            supabase = get_supabase_admin()
            supabase.table("subscription").upsert({
                "tenant_id": tenant_id,
                "plan_id": plan_id,
                "stripe_subscription_id": stripe_subscription_id,
                "status": "active",
            }, on_conflict="tenant_id").execute()

    return {"received": True}
