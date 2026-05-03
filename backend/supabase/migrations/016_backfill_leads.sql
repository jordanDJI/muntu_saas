-- Crée un lead pour chaque contact existant qui n'en a pas encore.
-- Utilise la source du contact (website, telegram, whatsapp, dashboard…).
INSERT INTO lead (tenant_id, contact_id, source, status, audience_type)
SELECT
    c.tenant_id,
    c.id,
    COALESCE(NULLIF(c.source, ''), 'dashboard'),
    'new',
    'b2c'
FROM contact c
WHERE c.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM lead l
      WHERE l.tenant_id  = c.tenant_id
        AND l.contact_id = c.id
  );
