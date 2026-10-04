"""
Client PayPal Orders API v2.

Chaque tenant fournit ses propres credentials PayPal (Client ID + Secret)
obtenus depuis developer.paypal.com → My Apps & Credentials.

Notes d'implémentation :
- httpx.AsyncClient et non `requests` : ces fonctions sont appelées depuis
  des endpoints `async def`, un client bloquant gelait la boucle
  d'événements pendant toute la latence PayPal (jusqu'à 15 s x 2 appels).
- Le token OAuth est mis en cache par (client_id, sandbox) : sans cache,
  chaque création ou capture d'order coûtait deux allers-retours HTTP.
"""
import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_PAYPAL_LIVE = "https://api-m.paypal.com"
_PAYPAL_SANDBOX = "https://api-m.sandbox.paypal.com"

_TIMEOUT = httpx.Timeout(15.0)

# {(client_id, sandbox): (token, expires_at_monotonic)}
_token_cache: dict[tuple[str, bool], tuple[str, float]] = {}
# Marge de sécurité retirée à la durée de vie annoncée par PayPal
_TOKEN_SKEW_SECONDS = 60


def _base(sandbox: bool = False) -> str:
    return _PAYPAL_SANDBOX if sandbox else _PAYPAL_LIVE


async def _get_access_token(client_id: str, client_secret: str, sandbox: bool = False) -> str:
    """Échange client_id:secret contre un Bearer token OAuth2 (avec cache)."""
    key = (client_id, sandbox)
    cached = _token_cache.get(key)
    now = time.monotonic()
    if cached and cached[1] > now:
        return cached[0]

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.post(
            f"{_base(sandbox)}/v1/oauth2/token",
            data={"grant_type": "client_credentials"},
            auth=(client_id, client_secret),
        )
        r.raise_for_status()
        data = r.json()

    token = data["access_token"]
    ttl = int(data.get("expires_in") or 0)
    if ttl > _TOKEN_SKEW_SECONDS:
        _token_cache[key] = (token, now + ttl - _TOKEN_SKEW_SECONDS)
    return token


async def _post(path: str, token: str, sandbox: bool, json: dict | None = None) -> dict:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.post(
            f"{_base(sandbox)}{path}",
            json=json if json is not None else {},
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        r.raise_for_status()
        return r.json() if r.content else {}


# -- Configuration du dépôt par tenant ---------------------------------------

def parse_deposit_config(site_row: dict) -> dict | None:
    """
    Normalise la config d'acompte d'une ligne `site`. Fonction pure (testable).

    Renvoie None si l'acompte n'est pas utilisable : désactivé, credentials
    incomplets, ou montant absent/invalide. Mieux vaut refuser le paiement que
    créer un order à un montant arbitraire.
    """
    deposit = (site_row.get("site_style") or {}).get("deposit") or {}

    if not deposit.get("enabled"):
        return None

    client_id = (deposit.get("paypal_client_id") or "").strip()
    client_secret = (site_row.get("paypal_client_secret") or "").strip()
    if not client_id or not client_secret:
        return None

    try:
        amount = round(float(deposit.get("amount") or 0), 2)
    except (TypeError, ValueError):
        return None
    if amount <= 0:
        return None

    return {
        "amount": amount,
        "currency": (deposit.get("currency") or "EUR").upper(),
        "client_id": client_id,
        "client_secret": client_secret,
        "sandbox": bool(deposit.get("sandbox", False)),
    }


def get_deposit_config(sb, tenant_id: str) -> dict | None:
    """
    Lit la config d'acompte du site du tenant.

    Le montant vient TOUJOURS d'ici, jamais du client : il était auparavant
    fourni dans le corps de la requête, ce qui permettait de payer un acompte
    de 0,01 EUR.
    """
    res = (
        sb.table("site")
        .select("site_style, paypal_client_secret")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    )
    return parse_deposit_config((res.data or [{}])[0])


# -- Orders ------------------------------------------------------------------

async def create_order(
    client_id: str,
    client_secret: str,
    amount: float,
    currency: str,
    description: str,
    sandbox: bool = False,
    return_url: str = "https://klientys.co",
    cancel_url: str = "https://klientys.co",
) -> dict:
    """
    Crée un order PayPal et retourne {"order_id": str, "approve_url": str}.
    Le client approuve sur approve_url, puis le backend capture via capture_order().
    """
    if amount is None or float(amount) <= 0:
        raise ValueError("Montant d'acompte invalide")

    token = await _get_access_token(client_id, client_secret, sandbox)
    payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "amount": {
                    "currency_code": currency.upper(),
                    "value": f"{float(amount):.2f}",
                },
                "description": description[:127],
            }
        ],
        "application_context": {
            "brand_name": "Klientys",
            "user_action": "PAY_NOW",
            "return_url": return_url,
            "cancel_url": cancel_url,
        },
    }
    data = await _post("/v2/checkout/orders", token, sandbox, payload)
    approve_url = next(
        (lnk["href"] for lnk in data.get("links", []) if lnk["rel"] == "approve"),
        "",
    )
    return {"order_id": data["id"], "approve_url": approve_url}


async def capture_order(
    client_id: str,
    client_secret: str,
    order_id: str,
    sandbox: bool = False,
) -> dict:
    """
    Capture le paiement d'un order approuvé par le client.
    Retourne {"status", "amount", "currency", "capture_id"}.
    Lève une exception si le paiement échoue.

    `capture_id` est nécessaire pour un éventuel remboursement : l'API
    Refunds de PayPal s'applique à la capture, pas à l'order.
    """
    token = await _get_access_token(client_id, client_secret, sandbox)
    data = await _post(f"/v2/checkout/orders/{order_id}/capture", token, sandbox)

    if data.get("status") != "COMPLETED":
        raise ValueError(f"PayPal capture status inattendu : {data.get('status')}")

    # Extraire le montant capturé depuis la première purchase_unit.
    # Un montant illisible ne doit jamais passer pour un paiement valide :
    # on lève plutôt que de retomber sur un défaut silencieux à 0.
    try:
        capture = data["purchase_units"][0]["payments"]["captures"][0]
        amount = float(capture["amount"]["value"])
        currency = capture["amount"]["currency_code"].upper()
        capture_id = capture.get("id", "")
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise ValueError(f"Réponse de capture PayPal illisible : {exc}") from exc

    return {"status": "COMPLETED", "amount": amount, "currency": currency, "capture_id": capture_id}


async def get_order(client_id: str, client_secret: str, order_id: str, sandbox: bool = False) -> dict:
    """Lit un order (vérification de montant / devise / statut hors capture)."""
    token = await _get_access_token(client_id, client_secret, sandbox)
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.get(
            f"{_base(sandbox)}/v2/checkout/orders/{order_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        r.raise_for_status()
        return r.json()


# -- Remboursements ----------------------------------------------------------

async def refund_capture(
    client_id: str,
    client_secret: str,
    capture_id: str,
    sandbox: bool = False,
    amount: float | None = None,
    currency: str = "EUR",
    note: str = "Remboursement d'acompte",
) -> dict:
    """
    Rembourse une capture. `amount=None` -> remboursement total.
    Retourne {"refund_id", "status"}.
    """
    token = await _get_access_token(client_id, client_secret, sandbox)
    payload: dict[str, Any] = {"note_to_payer": note[:255]}
    if amount is not None:
        payload["amount"] = {"value": f"{float(amount):.2f}", "currency_code": currency.upper()}
    data = await _post(f"/v2/payments/captures/{capture_id}/refund", token, sandbox, payload)
    return {"refund_id": data.get("id", ""), "status": data.get("status", "")}


async def refund_order(
    client_id: str,
    client_secret: str,
    order_id: str,
    sandbox: bool = False,
    amount: float | None = None,
    currency: str = "EUR",
    note: str = "Remboursement d'acompte",
) -> dict:
    """
    Rembourse un order déjà capturé, en retrouvant d'abord sa capture.
    Utile quand seul `deposit_paypal_order_id` a été persisté.
    """
    order = await get_order(client_id, client_secret, order_id, sandbox)
    try:
        capture_id = order["purchase_units"][0]["payments"]["captures"][0]["id"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError(f"Aucune capture trouvée pour l'order {order_id}") from exc
    return await refund_capture(
        client_id, client_secret, capture_id, sandbox,
        amount=amount, currency=currency, note=note,
    )
