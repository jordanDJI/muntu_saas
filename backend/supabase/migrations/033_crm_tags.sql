-- Migration 033 — CRM Tags
-- Tags colorés par tenant + liaison many-to-many avec contact

CREATE TABLE IF NOT EXISTS contact_tag (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    name       VARCHAR(50) NOT NULL,
    color      VARCHAR(20) NOT NULL DEFAULT 'blue',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, name)
);

CREATE TABLE IF NOT EXISTS contact_tag_link (
    contact_id UUID NOT NULL REFERENCES contact(id) ON DELETE CASCADE,
    tag_id     UUID NOT NULL REFERENCES contact_tag(id) ON DELETE CASCADE,
    PRIMARY KEY (contact_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_tag_tenant    ON contact_tag(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contact_tag_link_contact ON contact_tag_link(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tag_link_tag     ON contact_tag_link(tag_id);

ALTER TABLE contact_tag  ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tag_link ENABLE ROW LEVEL SECURITY;
