-- Cache des données Google Trends par tenant et période
CREATE TABLE IF NOT EXISTS tenant_roi_cache (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  period      text        NOT NULL,  -- week | month | quarter | year
  data        jsonb       NOT NULL DEFAULT '{}',
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period)
);
CREATE INDEX IF NOT EXISTS idx_roi_cache_tenant ON tenant_roi_cache (tenant_id);
