"""
Vérifie la chaîne d'acompte contre le sandbox PayPal (KLT-0520) :
création d'order → approbation par un compte acheteur sandbox → capture →
contrôle du montant → remboursement.

Ne touche PAS à la base : seul services/paypal.py est exercé, avec les mêmes
appels que /paypal-order, /paypal-capture et deposits.refund. Pour le parcours
complet avec création du RDV, utiliser un tenant de recette (docs/recette/).

Prérequis : une app sandbox sur developer.paypal.com (onglet Sandbox) et un
compte acheteur sandbox.

    cd backend
    PAYPAL_SANDBOX_CLIENT_ID=... PAYPAL_SANDBOX_CLIENT_SECRET=... \
        python scripts/sandbox_paypal_check.py --amount 25 --currency EUR

Le script affiche l'URL d'approbation : l'ouvrir, se connecter avec le compte
acheteur sandbox, approuver, puis revenir appuyer sur Entrée.
"""
import argparse
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services import paypal  # noqa: E402


def _fail(msg: str) -> None:
    print(f"ÉCHEC — {msg}")
    sys.exit(1)


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--amount", type=float, default=25.0)
    parser.add_argument("--currency", default="EUR")
    parser.add_argument("--keep", action="store_true", help="ne pas rembourser à la fin")
    args = parser.parse_args()

    cid = os.environ.get("PAYPAL_SANDBOX_CLIENT_ID", "")
    secret = os.environ.get("PAYPAL_SANDBOX_CLIENT_SECRET", "")
    if not cid or not secret:
        _fail("PAYPAL_SANDBOX_CLIENT_ID / PAYPAL_SANDBOX_CLIENT_SECRET manquants")

    order = await paypal.create_order(cid, secret, args.amount, args.currency, "Test acompte Klientys", sandbox=True)
    print(f"1. Order créé : {order['order_id']}")
    print(f"2. Approuver avec le compte acheteur sandbox :\n   {order['approve_url']}")
    input("   Entrée une fois l'approbation faite… ")

    payment = await paypal.capture_order(cid, secret, order["order_id"], sandbox=True)
    print(f"3. Capture : {payment}")
    if payment.get("status") != "COMPLETED":
        _fail(f"capture non complétée ({payment.get('status')})")

    # Même contrôle que /paypal-capture : le montant vient de la config, jamais du client.
    if round(float(payment["amount"]), 2) != round(args.amount, 2) or payment["currency"] != args.currency:
        _fail(f"montant capturé {payment['amount']} {payment['currency']} ≠ {args.amount} {args.currency}")
    print("4. Montant et devise conformes")

    if args.keep:
        print("OK — capture conservée (--keep)")
        return

    refund = await paypal.refund_capture(cid, secret, payment["capture_id"], sandbox=True, currency=args.currency)
    print(f"5. Remboursement : {refund}")
    if refund.get("status") not in ("COMPLETED", "PENDING"):
        _fail(f"remboursement en statut {refund.get('status')}")
    print("OK — création, capture, contrôle du montant et remboursement fonctionnent sur le sandbox")


if __name__ == "__main__":
    asyncio.run(main())
