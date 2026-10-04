-- ============================================================
-- Migration 072 — Traçabilité des paiements (remboursements, idempotence)
-- ============================================================
-- ⚠️  À APPLIQUER AVANT DE DÉPLOYER LE CODE.
-- Le code écrit deposit_capture_id / deposit_currency / past_due_since /
-- custom_domain_addon_sub_id, et GET /calendar/appointments sélectionne
-- deposit_currency. Déployé avant cette migration :
--   - l'agenda renverrait une erreur PostgREST (colonne inconnue) ;
--   - une réservation avec acompte serait encaissée puis remboursée
--     automatiquement, l'insertion du RDV échouant ;
--   - le webhook Stripe échouerait sur past_due_since, donc Stripe relancerait
--     sans jamais activer l'abonnement.
-- Les tables stripe_event et payment_incident, elles, dégradent proprement :
-- toutes leurs écritures sont déjà protégées par try/except.

-- ── Acomptes PayPal : de quoi rembourser et tracer ──────────────────────────
-- L'API Refunds de PayPal s'applique à la CAPTURE, pas à l'order. Sans cet
-- identifiant, rembourser imposait un aller-retour supplémentaire pour
-- retrouver la capture depuis l'order.
ALTER TABLE appointment
  ADD COLUMN IF NOT EXISTS deposit_capture_id   text,
  ADD COLUMN IF NOT EXISTS deposit_currency     text,
  ADD COLUMN IF NOT EXISTS deposit_refund_id    text,
  ADD COLUMN IF NOT EXISTS deposit_refunded_at  timestamptz;

COMMENT ON COLUMN appointment.deposit_status IS
  'Statut de l''acompte : none | pending_payment | paid | refunded | refund_failed';

-- Un order PayPal ne doit jamais pouvoir financer deux rendez-vous.
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointment_deposit_order
  ON appointment (deposit_paypal_order_id)
  WHERE deposit_paypal_order_id IS NOT NULL;

-- Support du job de purge des RDV en attente de paiement abandonnés.
CREATE INDEX IF NOT EXISTS idx_appointment_status_created
  ON appointment (status, created_at)
  WHERE status = 'pending_payment';

-- ── Addon domaine : pouvoir le désactiver à la résiliation ──────────────────
-- custom_domain_addon était posé à true au paiement sans que l'abonnement
-- Stripe correspondant soit enregistré nulle part : la table subscription
-- porte une contrainte UNIQUE(tenant_id) et ne peut donc pas l'accueillir.
-- Résultat : l'addon restait actif à vie après résiliation.
ALTER TABLE tenant
  ADD COLUMN IF NOT EXISTS custom_domain_addon_sub_id text;

CREATE INDEX IF NOT EXISTS idx_tenant_addon_sub_id
  ON tenant (custom_domain_addon_sub_id)
  WHERE custom_domain_addon_sub_id IS NOT NULL;

-- ── Idempotence des webhooks Stripe ─────────────────────────────────────────
-- Stripe retente la livraison d'un événement jusqu'à 3 jours. Sans
-- déduplication, un retry de invoice.payment_succeeded renvoyait un reçu au
-- client, et un retry de checkout.session.completed rejouait la logique métier.
CREATE TABLE IF NOT EXISTS stripe_event (
    id          text PRIMARY KEY,            -- evt_... fourni par Stripe
    type        text NOT NULL,
    processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stripe_event ENABLE ROW LEVEL SECURITY;
-- Aucune policy : table interne, écrite et lue uniquement en service role.

REVOKE ALL ON stripe_event FROM anon, authenticated;

-- ── Achats ponctuels : tracer les échecs post-paiement ──────────────────────
-- Un achat de domaine dont l'enregistrement OVH échoue après encaissement
-- Stripe doit laisser une trace exploitable, pas seulement une ligne de log.
CREATE TABLE IF NOT EXISTS payment_incident (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid REFERENCES tenant(id) ON DELETE SET NULL,
    kind          text NOT NULL,             -- domain_purchase_failed, deposit_booking_failed...
    provider      text NOT NULL,             -- stripe | paypal
    reference     text,                      -- session / order / payment_intent
    amount        numeric(10,2),
    currency      text,
    refunded      boolean NOT NULL DEFAULT false,
    detail        text,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_incident_created
  ON payment_incident (created_at DESC);

ALTER TABLE payment_incident ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON payment_incident FROM anon, authenticated;

-- ── Période de grâce sur les impayés ────────────────────────────────────────
-- get_tenant_plan() ne reconnaissait que active/trialing : au premier
-- prélèvement échoué le tenant basculait en trial_expired et perdait tout
-- accès, alors que Stripe relance la carte pendant deux à trois semaines.
-- On mémorise le début de l'impayé pour accorder une fenêtre de grâce.
ALTER TABLE subscription
  ADD COLUMN IF NOT EXISTS past_due_since timestamptz;
