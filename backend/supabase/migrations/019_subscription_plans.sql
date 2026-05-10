-- ============================================================
-- Migration 019 — Subscription plan features (structured JSONB)
-- ============================================================

-- Add missing columns if they don't exist yet
ALTER TABLE plan_subscription ADD COLUMN IF NOT EXISTS price_eur NUMERIC(8,2) NOT NULL DEFAULT 0;
ALTER TABLE plan_subscription ADD COLUMN IF NOT EXISTS features  JSONB DEFAULT '{}';

-- Rename Starter → Essentiel and update all plans with structured feature flags
UPDATE plan_subscription
SET name = 'Essentiel',
    features = '{
      "max_contacts": 100,
      "max_team_members": 1,
      "analytics": false,
      "analytics_roi": false,
      "agent_vitrine": false,
      "agent_support": false,
      "agent_assistant": false,
      "multi_page_site": false,
      "multi_tenant": false,
      "booking": true,
      "crm": true
    }'::jsonb
WHERE name = 'Starter';

UPDATE plan_subscription
SET features = '{
      "max_contacts": 500,
      "max_team_members": 3,
      "analytics": true,
      "analytics_roi": false,
      "agent_vitrine": true,
      "agent_support": true,
      "agent_assistant": false,
      "multi_page_site": true,
      "multi_tenant": false,
      "booking": true,
      "crm": true
    }'::jsonb
WHERE name = 'Pro';

UPDATE plan_subscription
SET features = '{
      "max_contacts": -1,
      "max_team_members": -1,
      "analytics": true,
      "analytics_roi": true,
      "agent_vitrine": true,
      "agent_support": true,
      "agent_assistant": true,
      "multi_page_site": true,
      "multi_tenant": true,
      "booking": true,
      "crm": true
    }'::jsonb
WHERE name = 'Business';
