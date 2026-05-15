"""
Service OVH — recherche de disponibilité et achat de domaines.
Utilise la bibliothèque officielle `ovh` (pip install ovh).
Authentification : OVH_APP_KEY, OVH_APP_SECRET, OVH_CONSUMER_KEY dans .env
"""
import asyncio
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

SEARCH_TLDS = [".be", ".fr", ".com", ".eu", ".net"]

# IP Vercel pour les enregistrements A (domaines apex)
VERCEL_APEX_IP = "216.198.79.1"
VERCEL_CNAME_TARGET = "cname.vercel-dns.com"


def _client():
    import ovh  # import lazy — pas de crash si le package manque en dev
    return ovh.Client(
        endpoint=settings.ovh_endpoint,
        application_key=settings.ovh_app_key,
        application_secret=settings.ovh_app_secret,
        consumer_key=settings.ovh_consumer_key,
    )


def _is_configured() -> bool:
    return bool(settings.ovh_app_key and settings.ovh_app_secret and settings.ovh_consumer_key)


def _apex_and_sub(domain: str) -> tuple[str, str]:
    """Retourne (zone_apex, subdomain). Ex: 'www.monsite.be' → ('monsite.be', 'www')."""
    parts = domain.split(".")
    apex = ".".join(parts[-2:])
    subdomain = ".".join(parts[:-2])
    return apex, subdomain


# ── Recherche ─────────────────────────────────────────────────────────────────

def _subsidiary() -> str:
    """Subsidiary OVH selon l'endpoint configuré."""
    return "CA" if "ca" in settings.ovh_endpoint else "FR"


def _is_available(item: dict) -> bool:
    """
    Détecte la disponibilité d'un domaine selon le format de réponse OVH.
    - EU endpoint : champ 'action' == 'order'
    - CA endpoint : settings.pricingMode == 'create-default'
    """
    action = item.get("action")
    if action is not None:
        return action == "order"
    pricing_mode = (item.get("settings") or {}).get("pricingMode", "")
    return pricing_mode == "create-default"


def _search_sync(query: str) -> list[dict]:
    client = _client()
    results: list[dict] = []

    for tld in SEARCH_TLDS:
        domain = f"{query.lower().strip()}{tld}"
        cart_id = None
        try:
            cart = client.post("/order/cart", ovhSubsidiary=_subsidiary(), _need_auth=False)
            cart_id = cart["cartId"]
            client.post(f"/order/cart/{cart_id}/assign")
            items = client.post(f"/order/cart/{cart_id}/domain", domain=domain)
            if not isinstance(items, list):
                items = [items]

            for item in items:
                prices = item.get("prices", [])
                price_ht = next(
                    (p["price"]["value"] for p in prices if p.get("label") in ("TOTAL", "PRICE")),
                    None,
                )
                currency = next(
                    (p["price"]["currencyCode"] for p in prices if p.get("label") == "TOTAL"),
                    "EUR",
                )
                results.append({
                    "domain": domain,
                    "available": _is_available(item),
                    "price_ht": price_ht,
                    "currency": currency,
                })
        except Exception as e:
            logger.warning("OVH search error for %s: %s", domain, e)
            results.append({"domain": domain, "available": False, "price_ht": None, "currency": "EUR"})
        finally:
            if cart_id:
                try:
                    client.delete(f"/order/cart/{cart_id}")
                except Exception:
                    pass

    return results


async def search_domains(query: str) -> list[dict]:
    if not _is_configured():
        raise RuntimeError("OVH API non configurée (OVH_APP_KEY / OVH_APP_SECRET / OVH_CONSUMER_KEY manquants)")
    return await asyncio.get_event_loop().run_in_executor(None, _search_sync, query)


def _get_price_sync(domain: str) -> float:
    """
    Vérifie la disponibilité et retourne le prix HT exact pour un domaine précis.
    Appelé côté serveur au moment du checkout — source de vérité pour la facturation.
    """
    client = _client()
    cart_id = None
    try:
        cart = client.post("/order/cart", ovhSubsidiary=_subsidiary(), _need_auth=False)
        cart_id = cart["cartId"]
        client.post(f"/order/cart/{cart_id}/assign")
        items = client.post(f"/order/cart/{cart_id}/domain", domain=domain)
        if not isinstance(items, list):
            items = [items]
        item = items[0]
        if not _is_available(item):
            raise ValueError(f"Domaine {domain} non disponible à l'achat")
        prices = item.get("prices", [])
        price_ht = next(
            (p["price"]["value"] for p in prices if p.get("label") in ("TOTAL", "PRICE")),
            None,
        )
        if price_ht is None:
            raise ValueError(f"Prix indisponible pour {domain}")
        return float(price_ht)
    finally:
        if cart_id:
            try:
                client.delete(f"/order/cart/{cart_id}")
            except Exception:
                pass


async def get_domain_price(domain: str) -> float:
    """Prix HT vérifié côté serveur — ne jamais faire confiance au prix du client."""
    if not _is_configured():
        raise RuntimeError("OVH API non configurée")
    return await asyncio.get_event_loop().run_in_executor(None, _get_price_sync, domain)


# ── Achat ─────────────────────────────────────────────────────────────────────

def _purchase_sync(domain: str) -> dict:
    client = _client()

    cart = client.post("/order/cart", ovhSubsidiary=_subsidiary(), _need_auth=False)
    cart_id = cart["cartId"]
    client.post(f"/order/cart/{cart_id}/assign")

    items = client.post(f"/order/cart/{cart_id}/domain", domain=domain)
    if not isinstance(items, list):
        items = [items]
    item = items[0]

    if not _is_available(item):
        raise ValueError(f"Domaine {domain} non disponible à l'achat")

    order = client.post(
        f"/order/cart/{cart_id}/checkout",
        autoPayWithPreferredPaymentMethod=True,
        waiveRetractationPeriod=True,
    )
    return {
        "order_id": order.get("orderId"),
        "order_url": order.get("url"),
        "total": order.get("prices", {}).get("withTax", {}).get("value"),
    }


async def purchase_domain(domain: str) -> dict:
    if not _is_configured():
        raise RuntimeError("OVH API non configurée")
    return await asyncio.get_event_loop().run_in_executor(None, _purchase_sync, domain)


# ── DNS ───────────────────────────────────────────────────────────────────────

def _configure_dns_sync(domain: str) -> None:
    """
    Configure les enregistrements DNS dans la zone OVH vers Vercel.
    - Sous-domaine (ex: www.monsite.be) : CNAME → cname.vercel-dns.com
    - Apex (ex: monsite.be)             : A → 216.198.79.1 + CNAME www → cname.vercel-dns.com
    """
    client = _client()
    apex, subdomain = _apex_and_sub(domain)

    if subdomain:
        # Sous-domaine : CNAME uniquement
        client.post(
            f"/domain/zone/{apex}/record",
            fieldType="CNAME",
            subDomain=subdomain,
            target=f"{VERCEL_CNAME_TARGET}.",
            ttl=3600,
        )
    else:
        # Apex : A record (@ → IP Vercel) + CNAME (www → Vercel)
        client.post(
            f"/domain/zone/{apex}/record",
            fieldType="A",
            subDomain="",
            target=VERCEL_APEX_IP,
            ttl=3600,
        )
        client.post(
            f"/domain/zone/{apex}/record",
            fieldType="CNAME",
            subDomain="www",
            target=f"{VERCEL_CNAME_TARGET}.",
            ttl=3600,
        )

    client.post(f"/domain/zone/{apex}/refresh")


async def configure_dns(domain: str) -> None:
    if not _is_configured():
        return
    await asyncio.get_event_loop().run_in_executor(None, _configure_dns_sync, domain)


def _remove_dns_sync(domain: str) -> None:
    """
    Supprime les enregistrements DNS Vercel de la zone OVH.
    Ne supprime PAS le domaine lui-même (il appartient au tenant).
    """
    client = _client()
    apex, subdomain = _apex_and_sub(domain)

    try:
        record_ids: list = client.get(f"/domain/zone/{apex}/record")
        for record_id in record_ids:
            try:
                rec = client.get(f"/domain/zone/{apex}/record/{record_id}")
                target: str = rec.get("target", "")
                rec_sub: str = rec.get("subDomain", "")
                rec_type: str = rec.get("fieldType", "")

                is_vercel_cname = VERCEL_CNAME_TARGET in target
                is_vercel_a = rec_type == "A" and rec.get("target") == VERCEL_APEX_IP and rec_sub == subdomain

                if is_vercel_cname or is_vercel_a:
                    client.delete(f"/domain/zone/{apex}/record/{record_id}")
            except Exception:
                pass
        client.post(f"/domain/zone/{apex}/refresh")
    except Exception as e:
        logger.warning("OVH remove_dns error for %s: %s", domain, e)


async def remove_dns_records(domain: str) -> None:
    """Nettoie les enregistrements DNS Vercel sans supprimer le domaine OVH."""
    if not _is_configured():
        return
    await asyncio.get_event_loop().run_in_executor(None, _remove_dns_sync, domain)
