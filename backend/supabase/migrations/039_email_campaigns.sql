-- Migration 039 — Campagnes email groupées
-- Permet d'envoyer un email en masse à un segment de contacts.

CREATE TABLE IF NOT EXISTS email_campaign (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid REFERENCES tenant(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  subject     text NOT NULL,
  body        text NOT NULL,
  segment     text NOT NULL DEFAULT 'all',
  tag_id      uuid REFERENCES contact_tag(id) ON DELETE SET NULL,
  status      text NOT NULL DEFAULT 'sent'
              CHECK (status IN ('sent', 'partial', 'failed')),
  sent_count  int  NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  sent_at     timestamptz DEFAULT now() NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_campaign_tenant
  ON email_campaign (tenant_id, sent_at DESC);
