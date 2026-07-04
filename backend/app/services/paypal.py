"""
Client PayPal Orders API v2.
Chaque tenant fournit ses propres credentials PayPal (Client ID + Secret)
obtenus depuis developer.paypal.com → My Apps & Credentials.
"""
import logging
from typing import Optional

import requests

logger = logging.getLogger(__name__)

_PAYPAL_LIVE = "https://api-m.paypal.com"
_PAYPAL_SANDBOX = "https://api-m.sandbox.paypal.com"


def _base(sandbox: bool = False) -> str:
    return _PAYPAL_SANDBOX if sandbox else _PAYPAL_LIVE


def _get_access_token(client_id: str, client_secret: str, sandbox: bool = False) -> str:
    """Échange client_id:secret contre un Bearer token OAuth2."""
    r = requests.post(
        f"{_base(sandbox)}/v1/oauth2/token",
        data={"grant_type": "client_credentials"},
        auth=(client_id, client_secret),
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def create_order(
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
    token = _get_access_token(client_id, client_secret, sandbox)
    payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "amount": {
                    "currency_code": currency.upper(),
                    "value": f"{amount:.2f}",
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
    r = requests.post(
        f"{_base(sandbox)}/v2/checkout/orders",
        json=payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=15,
    )
    r.raise_for_status()
    data = r.json()
    order_id = data["id"]
    approve_url = next(
        (lnk["href"] for lnk in data.get("links", []) if lnk["rel"] == "approve"),
        "",
    )
    return {"order_id": order_id, "approve_url": approve_url}


def capture_order(
    client_id: str,
    client_secret: str,
    order_id: str,
    sandbox: bool = False,
) -> dict:
    """
    Capture le paiement d'un order approuvé par le client.
    Retourne {"status": "COMPLETED", "amount": float, "currency": str}.
    Lève une exception si le paiement échoue.
    """
    token = _get_access_token(client_id, client_secret, sandbox)
    r = requests.post(
        f"{_base(sandbox)}/v2/checkout/orders/{order_id}/capture",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=15,
    )
    r.raise_for_status()
    data = r.json()

    if data.get("status") != "COMPLETED":
        raise ValueError(f"PayPal capture status inattendu : {data.get('status')}")

    # Extraire le montant capturé depuis la première purchase_unit
    try:
        capture = data["purchase_units"][0]["payments"]["captures"][0]
        amount = float(capture["amount"]["value"])
        currency = capture["amount"]["currency_code"]
    except (KeyError, IndexError, ValueError):
        amount = 0.0
        currency = "EUR"

    return {"status": "COMPLETED", "amount": amount, "currency": currency}
