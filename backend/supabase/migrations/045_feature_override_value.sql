-- Migration 045 — Ajout value_int sur tenant_feature_override
-- Permet de surcharger les limites numériques (max_contacts, max_team_members, etc.)
-- par tenant depuis le panel admin, sans toucher au plan Stripe.
ALTER TABLE tenant_feature_override
    ADD COLUMN IF NOT EXISTS value_int INTEGER;
