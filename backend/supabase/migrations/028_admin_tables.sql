-- 028_admin_tables.sql
-- Panneau admin SaaS : feature flags, config système, log des actions, colonnes tenant

-- Colonnes supplémentaires sur la table tenant
ALTER TABLE tenant
  ADD COLUMN IF NOT EXISTS suspended_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason   TEXT,
  ADD COLUMN IF NOT EXISTS trial_extended_until TIMESTAMPTZ;

-- Feature flags globaux (activation/désactivation de features pour tous les tenants)
CREATE TABLE IF NOT EXISTS feature_flag (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  description TEXT,
  enabled     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Overrides par tenant (force enable/disable une feature pour un tenant précis)
CREATE TABLE IF NOT EXISTS tenant_feature_override (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  feature_key TEXT        NOT NULL,
  enabled     BOOLEAN     NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, feature_key)
);

CREATE INDEX IF NOT EXISTS tfo_tenant_idx ON tenant_feature_override (tenant_id);

-- Configuration système (maintenance mode, messages globaux…)
CREATE TABLE IF NOT EXISTS system_config (
  key        TEXT    PRIMARY KEY,
  value      JSONB   NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Valeurs par défaut
INSERT INTO system_config (key, value) VALUES
  ('maintenance_mode',            'false'::jsonb),
  ('maintenance_message',         '"Maintenance en cours. Retour dans quelques minutes."'::jsonb),
  ('new_signup_notifications',    'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Log des actions administrateur
CREATE TABLE IF NOT EXISTS admin_action_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id       UUID        NOT NULL,
  admin_email         TEXT,
  action_type         TEXT        NOT NULL,
  target_tenant_id    UUID        REFERENCES tenant(id) ON DELETE SET NULL,
  target_tenant_name  TEXT,
  payload             JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS aal_admin_idx  ON admin_action_log (admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS aal_tenant_idx ON admin_action_log (target_tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS aal_date_idx   ON admin_action_log (created_at DESC);
