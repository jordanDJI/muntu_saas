-- Migration 038 — Historique des échanges par contact (timeline)
-- Remplace le champ notes unique par un flux d'activités horodatées.
-- Types: note | call | email | meeting

CREATE TABLE IF NOT EXISTS contact_activity (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid REFERENCES tenant(id) ON DELETE CASCADE NOT NULL,
  contact_id uuid REFERENCES contact(id) ON DELETE CASCADE NOT NULL,
  type       text NOT NULL DEFAULT 'note'
             CHECK (type IN ('note', 'call', 'email', 'meeting')),
  content    text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_activity_contact
  ON contact_activity (contact_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_activity_tenant
  ON contact_activity (tenant_id, created_at DESC);
