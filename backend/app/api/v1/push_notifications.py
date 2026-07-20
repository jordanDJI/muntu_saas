"""
Web Push — gestion des abonnements VAPID.
  GET  /push/vapid-public-key          Clé publique VAPID (frontend)
  POST /push/subscribe                 Enregistrer/mettre à jour un abonnement tenant
  DELETE /push/subscribe               Supprimer l'abonnement de l'utilisateur courant
  POST /push/subscribe/contact         Abonnement côté client (site public, pas d'auth JWT)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Any

from app.core.config import settings as cfg
from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant, get_current_user

router = APIRouter(prefix="/push", tags=["Push"])


class PushSubscriptionIn(BaseModel):
    subscription: dict   # { endpoint, keys: { p256dh, auth } }


class ContactPushSubscriptionIn(BaseModel):
    contact_id: str
    tenant_id:  str
    subscription: dict


# ── Clé publique VAPID (publique — pas d'auth) ────────────────────────────────

@router.get("/vapid-public-key")
def get_vapid_public_key():
    if not cfg.vapid_public_key:
        raise HTTPException(503, "Push notifications non configurées")
    return {"public_key": cfg.vapid_public_key}


# ── Abonnement dashboard (tenant authentifié) ─────────────────────────────────

@router.post("/subscribe")
def subscribe(
    data: PushSubscriptionIn,
    user: dict = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    user_id = user["id"]

    sb.table("push_subscription").upsert(
        {
            "user_id":      user_id,
            "tenant_id":    tenant_id,
            "subscription": data.subscription,
        },
        on_conflict="user_id,tenant_id",
    ).execute()
    return {"success": True}


@router.delete("/subscribe")
def unsubscribe(
    user: dict = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    sb.table("push_subscription").delete().eq("user_id", user["id"]).eq("tenant_id", tenant_id).execute()
    return {"success": True}


# ── Abonnement client public (pas d'auth JWT) ─────────────────────────────────

@router.post("/subscribe/contact")
def subscribe_contact(data: ContactPushSubscriptionIn):
    sb = get_supabase_admin()
    sb.table("contact_push_subscription").upsert(
        {
            "contact_id":   data.contact_id,
            "tenant_id":    data.tenant_id,
            "subscription": data.subscription,
        },
        on_conflict="contact_id",
    ).execute()
    return {"success": True}
