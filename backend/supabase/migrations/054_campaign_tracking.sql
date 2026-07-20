-- Migration 054 — Tracking email campagnes (ouvertures, clics, désabonnements)

-- ── 1. Colonnes opt-out sur contact ──────────────────────────────────────────
ALTER TABLE contact
  ADD COLUMN IF NOT EXISTS unsubscribe_token  uuid    DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS marketing_opt_out  boolean DEFAULT false NOT NULL;

-- Génère un token pour les contacts existants qui n'en ont pas
UPDATE contact SET unsubscribe_token = gen_random_uuid()
WHERE unsubscribe_token IS NULL;

-- ── 2. Compteurs de tracking sur email_campaign ───────────────────────────────
ALTER TABLE email_campaign
  ADD COLUMN IF NOT EXISTS open_count          int DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS click_count         int DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS unsubscribed_count  int DEFAULT 0 NOT NULL;

-- ── 3. Table de suivi par destinataire ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_campaign_contact (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid        REFERENCES email_campaign(id) ON DELETE CASCADE NOT NULL,
  tenant_id       uuid        REFERENCES tenant(id)         ON DELETE CASCADE NOT NULL,
  contact_id      uuid        REFERENCES contact(id)        ON DELETE CASCADE NOT NULL,
  token           uuid        DEFAULT gen_random_uuid() NOT NULL UNIQUE,
  opened_at       timestamptz,
  open_count      int         DEFAULT 0 NOT NULL,
  clicked_at      timestamptz,
  click_count     int         DEFAULT 0 NOT NULL,
  unsubscribed_at timestamptz,
  created_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ecc_campaign ON email_campaign_contact (campaign_id);
CREATE INDEX IF NOT EXISTS idx_ecc_token    ON email_campaign_contact (token);
CREATE INDEX IF NOT EXISTS idx_ecc_contact  ON email_campaign_contact (contact_id);

COMMENT ON TABLE email_campaign_contact
  IS 'Suivi par destinataire : ouvertures (pixel), clics (redirect), désabonnement';
COMMENT ON COLUMN email_campaign_contact.token
  IS 'Token opaque pour les endpoints de tracking — pas exposé dans les URLs publiques du tenant';
COMMENT ON COLUMN contact.unsubscribe_token
  IS 'Token unique pour le lien de désabonnement (stable, régénéré uniquement sur demande)';
COMMENT ON COLUMN contact.marketing_opt_out
  IS 'true = exclu des campagnes email marketing. Ne bloque PAS les emails transactionnels (RDV, factures…)';

-- ── 4. RLS — isolation par tenant ────────────────────────────────────────────

-- email_campaign (créée sans RLS dans migration 039 — on la corrige ici)
ALTER TABLE email_campaign ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_campaign_tenant_isolation ON email_campaign
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- email_campaign_contact — accédée uniquement via service role (tracking public)
-- RLS activé mais policy vide → seul le service role peut lire/écrire
ALTER TABLE email_campaign_contact ENABLE ROW LEVEL SECURITY;

CREATE POLICY ecc_tenant_isolation ON email_campaign_contact
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- Les incréments (open_count, click_count, unsubscribed_count) sont gérés
-- directement en Python (lecture + écriture) dans campaigns.py.
