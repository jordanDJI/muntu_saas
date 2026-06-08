-- ============================================================
-- Migration 032 — Demandes de création de logo
-- ============================================================

CREATE TABLE IF NOT EXISTS logo_request (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid REFERENCES tenant(id) ON DELETE CASCADE,
  tenant_name               text,
  -- Brief collecté par l'IA
  brief                     jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Historique complet de la conversation [{role, content}]
  chat_history              jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Tarification
  price_tier                text NOT NULL DEFAULT 'standard',  -- essentiel | standard | premium
  price_eur                 numeric(8,2) NOT NULL,
  -- Statut : pending_payment → paid → in_progress → review → done
  status                    text NOT NULL DEFAULT 'pending_payment',
  stripe_checkout_session_id text,
  stripe_payment_intent_id  text,
  -- Suivi admin
  admin_notes               text,
  delivered_at              timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE logo_request ENABLE ROW LEVEL SECURITY;

CREATE POLICY logo_request_tenant_select ON logo_request
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM membership WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_logo_request_tenant_id ON logo_request(tenant_id);
CREATE INDEX IF NOT EXISTS idx_logo_request_status    ON logo_request(status);
CREATE INDEX IF NOT EXISTS idx_logo_request_created   ON logo_request(created_at DESC);
