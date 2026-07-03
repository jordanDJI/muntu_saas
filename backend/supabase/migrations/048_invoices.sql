-- 048_invoices.sql
-- Module facturation électronique EU-compliant
-- Génère PDF (A4) + UBL 2.1 XML pour chaque facture tenant → client
-- Klientys est générateur uniquement, aucun agrément PDP requis

-- ─── Paramètres de facturation du tenant ─────────────────────────────────────
ALTER TABLE tenant
  ADD COLUMN IF NOT EXISTS invoice_settings JSONB DEFAULT '{}';

COMMENT ON COLUMN tenant.invoice_settings IS
  'Config facturation tenant : { prefix, vat_number, payment_terms_days, bank_iban, bank_bic, bank_name, footer_note }';

-- ─── Séquence de numérotation par tenant + année ──────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_sequence (
  tenant_id    UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  year         INT  NOT NULL,
  last_number  INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, year)
);

-- Incrémente atomiquement et retourne le nouveau numéro
CREATE OR REPLACE FUNCTION increment_invoice_sequence(p_tenant_id UUID, p_year INT)
RETURNS INT AS $$
DECLARE
  v_num INT;
BEGIN
  INSERT INTO invoice_sequence(tenant_id, year, last_number)
    VALUES (p_tenant_id, p_year, 1)
  ON CONFLICT (tenant_id, year)
    DO UPDATE SET last_number = invoice_sequence.last_number + 1;

  SELECT last_number INTO v_num
    FROM invoice_sequence
   WHERE tenant_id = p_tenant_id AND year = p_year;

  RETURN v_num;
END;
$$ LANGUAGE plpgsql;

-- ─── Factures ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contact(id) ON DELETE SET NULL,
  appointment_id  UUID REFERENCES appointment(id) ON DELETE SET NULL,

  number          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','paid','cancelled','overdue')),

  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  currency        TEXT NOT NULL DEFAULT 'EUR',

  -- Totaux calculés et dénormalisés pour perf
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_rate        NUMERIC(5,2)  NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Snapshot client (immuable après création)
  client_name     TEXT,
  client_email    TEXT,
  client_address  TEXT,
  client_vat      TEXT,

  -- Snapshot tenant (immuable après création)
  tenant_name     TEXT,
  tenant_address  TEXT,
  tenant_vat      TEXT,

  notes           TEXT,
  payment_terms   TEXT,

  pdf_url         TEXT,   -- Supabase Storage : invoices/{tenant_id}/{invoice_id}.pdf
  ubl_url         TEXT,   -- Supabase Storage : invoices/{tenant_id}/{invoice_id}.ubl.xml

  paid_at         TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, number)
);

COMMENT ON TABLE invoice IS 'Factures émises par les tenants vers leurs clients';
COMMENT ON COLUMN invoice.number IS 'Numéro séquentiel : {PREFIX}-{YEAR}-{NNNN} ex: FAC-2025-0001';
COMMENT ON COLUMN invoice.pdf_url IS 'URL Supabase Storage du PDF généré — null si pas encore généré';
COMMENT ON COLUMN invoice.ubl_url IS 'URL Supabase Storage du XML UBL 2.1 — null si pas encore généré';

-- ─── Lignes de facture ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_line (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
  description TEXT          NOT NULL,
  quantity    NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_rate    NUMERIC(5,2)  NOT NULL DEFAULT 0,
  total       NUMERIC(10,2) NOT NULL DEFAULT 0,
  position    INT           NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE invoice_line IS 'Lignes d''une facture (description, qté, prix HT, TVA, total TTC)';

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE invoice          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line     ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequence ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_rls ON invoice
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY invoice_line_rls ON invoice_line
  USING (invoice_id IN (
    SELECT id FROM invoice
     WHERE tenant_id = current_setting('app.tenant_id')::UUID
  ));

CREATE POLICY invoice_sequence_rls ON invoice_sequence
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- ─── Index ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invoice_tenant_id        ON invoice(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_contact_id       ON invoice(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoice_appointment_id   ON invoice(appointment_id);
CREATE INDEX IF NOT EXISTS idx_invoice_status           ON invoice(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoice_issue_date       ON invoice(tenant_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_line_invoice_id  ON invoice_line(invoice_id);
