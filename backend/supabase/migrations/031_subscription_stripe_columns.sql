-- ============================================================
-- Migration 031 — Colonnes Stripe manquantes
-- ============================================================

-- Colonne absente en pratique (déclarée en 001 mais pas appliquée)
ALTER TABLE subscription
  ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(100);

-- ID client Stripe sur le tenant — permet d'ouvrir le portail
-- sans avoir besoin de l'abonnement actif
ALTER TABLE tenant
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_subscription_stripe_sub_id
  ON subscription(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_stripe_customer_id
  ON tenant(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
