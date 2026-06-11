-- Migration 040 — Pièces jointes par contact
-- Nécessite la création du bucket Supabase Storage : 'contact-attachments' (accès privé)

CREATE TABLE IF NOT EXISTS contact_attachment (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        REFERENCES tenant(id)  ON DELETE CASCADE NOT NULL,
  contact_id   uuid        REFERENCES contact(id) ON DELETE CASCADE NOT NULL,
  file_name    text        NOT NULL,
  file_size    int         NOT NULL,
  mime_type    text,
  storage_path text        NOT NULL UNIQUE,
  created_at   timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_attachment_contact ON contact_attachment (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_attachment_tenant  ON contact_attachment (tenant_id);
