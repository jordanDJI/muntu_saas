-- Migration 034 — CRM Reminders (relances)
-- Rappels de relance sur un contact, avec date d'échéance et statut done

CREATE TABLE IF NOT EXISTS contact_reminder (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contact(id) ON DELETE CASCADE,
    due_date   DATE NOT NULL,
    note       TEXT,
    done       BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminder_tenant_due  ON contact_reminder(tenant_id, due_date, done);
CREATE INDEX IF NOT EXISTS idx_reminder_contact     ON contact_reminder(contact_id);

ALTER TABLE contact_reminder ENABLE ROW LEVEL SECURITY;
