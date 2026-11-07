#!/usr/bin/env sh
# Rejoue les scénarios du webhook Stripe en mode test (KLT-1020).
#
# Prérequis :
#   - Stripe CLI connectée au compte en mode TEST (`stripe login`)
#   - backend local lancé (uvicorn … --port 8000) avec les clés TEST
#   - dans un autre terminal :
#       stripe listen --forward-to localhost:8000/api/v1/subscriptions/webhook
#     et STRIPE_WEBHOOK_SECRET = le whsec_ affiché par cette commande
#
# Usage : sh scripts/stripe_webhook_check.sh
#
# Vérifier ensuite dans les logs du backend et en base de recette :
#   1. checkout.session.completed   → ligne subscription, statut relu chez Stripe
#   2. relivraison du même événement → aucun second traitement (table stripe_event)
#   3. async_payment_failed          → aucun achat OVH, aucun abonnement activé
#   4. charge.dispute.created        → payment_incident + email admin
#   5. customer.subscription.deleted → statut mis à jour (et addon domaine coupé si c'était lui)
set -eu

command -v stripe >/dev/null || { echo "Stripe CLI absente : https://stripe.com/docs/stripe-cli"; exit 1; }

echo "1. Paiement par carte réussi"
stripe trigger checkout.session.completed

echo "2. Relivraison du dernier événement (idempotence)"
LAST=$(stripe events list --limit 1 | sed -n 's/.*"id": "\(evt_[^"]*\)".*/\1/p' | head -n 1)
[ -n "$LAST" ] && stripe events resend "$LAST" || echo "   (aucun événement à relivrer)"

echo "3. Paiement asynchrone échoué"
stripe trigger checkout.session.async_payment_failed

echo "4. Litige bancaire"
stripe trigger charge.dispute.created

echo "5. Résiliation d'abonnement"
stripe trigger customer.subscription.deleted

echo
echo "Terminé. Contrôler : logs backend (aucune erreur 5xx), tables subscription,"
echo "stripe_event (une ligne par evt_), payment_incident."
