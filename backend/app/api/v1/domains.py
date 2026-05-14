"""
Gestion des domaines personnalisés par tenant.
- Phase 1 : connecter un domaine existant (Vercel API + instructions DNS)
- Phase 2 : acheter un nouveau domaine via OVH
- Addon Stripe +5€/mois pour les plans non-Business
"""
import stripe
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.middleware.tenant import get_current_tenant
from app.core.supabase import get_supabase_admin
from app.core.config import settings
from app.services import vercel_domains, ovh_domains
from app.services.subscription import get_tenant_plan

stripe.api_key = settings.stripe_secret_key
router = APIRouter(prefix="/domains", tags=["Domains"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _has_domain_access(tenant_id: str) -> bool:
    """True si plan Business OU addon custom_domain payé."""
    sb = get_supabase_admin()
    tenant = sb.table("tenant").select("custom_domain_addon").eq("id", tenant_id).single().execute().data
    if tenant and tenant.get("custom_domain_addon"):
        return True
    plan = await get_tenant_plan(tenant_id)
    return plan["features"].get("custom_domain", False)


def _clean_domain(raw: str) -> str:
    return (
        raw.lower().strip()
        .removeprefix("https://")
        .removeprefix("http://")
        .rstrip("/")
    )


def _with_markup(price_ovh: float) -> float:
    """Applique la marge configurée sur le prix HT OVH. Arrondi au centime supérieur."""
    import math
    gross = price_ovh * (1 + settings.domain_markup_percent / 100)
    return math.ceil(gross * 100) / 100  # ex: 9.99 * 1.25 = 12.4875 → 12.49


# ── Schemas ───────────────────────────────────────────────────────────────────

class ConnectDomainIn(BaseModel):
    domain: str

class DomainPurchaseCheckoutIn(BaseModel):
    domain: str
    auto_renew: bool = True
    success_url: str
    cancel_url: str

class AddonCheckoutIn(BaseModel):
    success_url: str
    cancel_url: str


# ── Endpoints privés (tenant authentifié) ─────────────────────────────────────

@router.get("/my")
async def get_my_domain(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()
    rows = sb.table("custom_domain").select("*").eq("tenant_id", tenant_id).limit(1).execute()
    return rows.data[0] if rows.data else None


@router.post("/connect")
async def connect_domain(body: ConnectDomainIn, tenant_id: str = Depends(get_current_tenant)):
    if not await _has_domain_access(tenant_id):
        raise HTTPException(
            status_code=403,
            detail="Fonctionnalité réservée au plan Business ou disponible avec l'option domaine (+5€/mois)",
        )

    domain = _clean_domain(body.domain)
    if not domain or "." not in domain:
        raise HTTPException(status_code=422, detail="Domaine invalide")

    sb = get_supabase_admin()
    # Vérifier que le domaine n'est pas déjà pris par un autre tenant
    existing = sb.table("custom_domain").select("tenant_id").eq("domain", domain).limit(1).execute()
    if existing.data and existing.data[0]["tenant_id"] != tenant_id:
        raise HTTPException(status_code=409, detail="Ce domaine est déjà utilisé par un autre compte")

    # Ajouter le domaine dans Vercel
    try:
        await vercel_domains.add_domain(domain)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur Vercel : {str(e)}")

    # Instructions DNS : CNAME pour les sous-domaines, sinon A record
    is_subdomain = domain.count(".") >= 2
    dns_name = domain.split(".")[0] if is_subdomain else "@"
    dns_type = "CNAME"
    dns_value = "cname.vercel-dns.com"

    sb.table("custom_domain").upsert(
        {
            "tenant_id": tenant_id,
            "domain": domain,
            "status": "pending",
            "source": "external",
            "dns_record_type": dns_type,
            "dns_record_name": dns_name,
            "dns_record_value": dns_value,
        },
        on_conflict="tenant_id",
    ).execute()

    return {
        "domain": domain,
        "status": "pending",
        "dns_record_type": dns_type,
        "dns_record_name": dns_name,
        "dns_record_value": dns_value,
    }


@router.get("/status")
async def poll_domain_status(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()
    rows = sb.table("custom_domain").select("*").eq("tenant_id", tenant_id).limit(1).execute()
    if not rows.data:
        raise HTTPException(status_code=404, detail="Aucun domaine configuré")

    row = rows.data[0]
    domain = row["domain"]

    try:
        vercel_data = await vercel_domains.get_domain_status(domain)
    except Exception:
        return {**row, "propagated": False, "ssl": False, "conflicts": []}

    verified = vercel_data.get("verified", False)
    propagated = vercel_data.get("propagated", False)
    ssl_active = vercel_data.get("ssl", False)
    config_status = vercel_data.get("config_status", "WAITING")
    conflicts = vercel_data.get("conflicts", [])

    # Actif = DNS propagé ET SSL valide
    new_status = "active" if (verified and ssl_active) else "pending"

    if new_status != row["status"] or config_status != row.get("vercel_status"):
        update = {"status": new_status, "vercel_status": config_status}
        if new_status == "active" and not row.get("verified_at"):
            update["verified_at"] = datetime.now(timezone.utc).isoformat()
        sb.table("custom_domain").update(update).eq("tenant_id", tenant_id).execute()
        row = {**row, **update}

    return {**row, "propagated": propagated, "ssl": ssl_active, "conflicts": conflicts}


@router.delete("/my")
async def delete_domain(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()
    rows = sb.table("custom_domain").select("*").eq("tenant_id", tenant_id).limit(1).execute()
    if not rows.data:
        raise HTTPException(status_code=404, detail="Aucun domaine configuré")

    row = rows.data[0]
    domain = row["domain"]

    # Retirer de Vercel
    try:
        await vercel_domains.remove_domain(domain)
    except Exception:
        pass

    # Nettoyer les DNS OVH si domaine acheté via la plateforme
    # (sans supprimer le domaine OVH — il appartient au tenant)
    if row.get("source") == "ovh_purchased":
        try:
            await ovh_domains.remove_dns_records(domain)
        except Exception:
            pass

    sb.table("custom_domain").delete().eq("tenant_id", tenant_id).execute()
    return {"deleted": True}


@router.get("/search")
async def search_domains(
    query: str = Query(..., min_length=2, max_length=63),
    tenant_id: str = Depends(get_current_tenant),
):
    if not await _has_domain_access(tenant_id):
        raise HTTPException(status_code=403, detail="Fonctionnalité réservée au plan Business ou avec l'option domaine")

    try:
        raw = await ovh_domains.search_domains(query)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur OVH : {str(e)}")

    # Applique la marge — le tenant voit directement le prix qu'il paiera
    results = [
        {
            **r,
            "price_ht": _with_markup(r["price_ht"]) if r.get("price_ht") is not None else None,
        }
        for r in raw
    ]
    return results


@router.post("/purchase")
async def purchase_domain_checkout(body: DomainPurchaseCheckoutIn, tenant_id: str = Depends(get_current_tenant)):
    """
    Crée une session Stripe Checkout pour l'achat du domaine.
    L'achat OVH réel est déclenché par le webhook Stripe après paiement confirmé.
    """
    if not await _has_domain_access(tenant_id):
        raise HTTPException(status_code=403, detail="Fonctionnalité réservée au plan Business ou avec l'option domaine")

    domain = _clean_domain(body.domain)
    if not domain or "." not in domain:
        raise HTTPException(status_code=422, detail="Domaine invalide")

    sb = get_supabase_admin()
    existing = sb.table("custom_domain").select("tenant_id").eq("domain", domain).limit(1).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="Ce domaine est déjà enregistré sur cette plateforme")

    # Prix OVH re-vérifié côté serveur + marge appliquée
    try:
        price_ovh = await ovh_domains.get_domain_price(domain)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur OVH lors de la vérification du prix : {str(e)}")

    price_tenant = _with_markup(price_ovh)                      # ce que paie le tenant
    unit_amount_cents = max(50, int(round(price_tenant * 100)))  # minimum Stripe : 50 centimes

    session = stripe.checkout.Session.create(
        mode="payment",
        line_items=[{
            "price_data": {
                "currency": "eur",
                "unit_amount": unit_amount_cents,
                "product_data": {
                    "name": f"Nom de domaine {domain}",
                    "description": (
                        f"Enregistrement pour 1 an — "
                        f"renouvellement {'automatique' if body.auto_renew else 'manuel'}"
                    ),
                },
            },
            "quantity": 1,
        }],
        success_url=body.success_url,
        cancel_url=body.cancel_url,
        metadata={
            "tenant_id": tenant_id,
            "domain": domain,
            "auto_renew": "true" if body.auto_renew else "false",
            "type": "domain_purchase",
            "price_ovh": str(price_ovh),      # coût réel OVH (pour la comptabilité)
            "price_tenant": str(price_tenant), # ce qui a été facturé au tenant
        },
    )

    return {"checkout_url": session.url}


@router.post("/addon/checkout")
async def addon_checkout(body: AddonCheckoutIn, tenant_id: str = Depends(get_current_tenant)):
    if not settings.stripe_domain_addon_price_id:
        raise HTTPException(status_code=503, detail="Option domaine non encore disponible à l'achat")

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": settings.stripe_domain_addon_price_id, "quantity": 1}],
        success_url=body.success_url,
        cancel_url=body.cancel_url,
        metadata={"tenant_id": tenant_id, "addon_type": "custom_domain"},
    )
    return {"checkout_url": session.url}


# ── Endpoint public (pas d'auth) — résolution domaine → slug ─────────────────

@router.get("/resolve")
async def resolve_domain(domain: str = Query(...)):
    """Utilisé par le middleware Next.js pour router les domaines custom."""
    sb = get_supabase_admin()
    row = (
        sb.table("custom_domain")
        .select("tenant_id")
        .eq("domain", domain)
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Domaine non trouvé")

    tenant = sb.table("tenant").select("slug").eq("id", row.data[0]["tenant_id"]).single().execute()
    if not tenant.data or not tenant.data.get("slug"):
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    return {"slug": tenant.data["slug"]}
