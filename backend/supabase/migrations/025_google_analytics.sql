-- Google Analytics OAuth connection per tenant
CREATE TABLE IF NOT EXISTS google_analytics_connection (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        UNIQUE NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  access_token    text        NOT NULL,
  refresh_token   text,
  ga4_property_id text,
  connected_at    timestamptz NOT NULL DEFAULT now()
);
