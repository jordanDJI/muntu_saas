-- Migration 057 — expires_at sur tenant_feature_override + table tenant_notification

-- Durée optionnelle sur les overrides admin
ALTER TABLE tenant_feature_override
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN tenant_feature_override.expires_at IS 'Date d''expiration de l''override (NULL = permanent)';

-- Notifications in-app pour le tenant (ex: activation de feature)
CREATE TABLE IF NOT EXISTS tenant_notification (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  type       text        NOT NULL DEFAULT 'feature_override',
  title      text        NOT NULL,
  body       text        NOT NULL,
  data       jsonb,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_notif_tenant_unread
  ON tenant_notification(tenant_id, created_at DESC)
  WHERE read_at IS NULL;

COMMENT ON TABLE tenant_notification IS 'Notifications in-app envoyées au tenant par l''équipe Klientys';
