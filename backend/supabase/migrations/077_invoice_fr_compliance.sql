-- 077_invoice_fr_compliance.sql
-- Mise en conformité des factures avec le droit français.
--
-- Trois manques corrigés ici :
--   1. aucun identifiant légal (SIREN/SIRET) ni adresse structurée — or EN 16931
--      rend obligatoires le pays (BT-40/BT-55) et l'identifiant légal du vendeur
--      (BT-30), et le SIREN est le pivot de l'annuaire de la réforme française ;
--   2. aucune date de prestation distincte de la date d'émission, pourtant
--      mention obligatoire (art. 242 nonies A annexe II CGI) ;
--   3. aucune facture d'avoir : une facture émise ne s'annule pas en droit
--      français, elle se corrige par un avoir numéroté.

-- ─── Snapshot légal de l'émetteur et du client ────────────────────────────────
-- Snapshot et non lecture live : une facture émise est figée, un changement de
-- paramètres ne doit pas réécrire les factures passées.

ALTER TABLE invoice
  ADD COLUMN IF NOT EXISTS tenant_legal_id      TEXT,   -- SIREN / SIRET / n° BCE
  ADD COLUMN IF NOT EXISTS tenant_street        TEXT,
  ADD COLUMN IF NOT EXISTS tenant_postal_code   TEXT,
  ADD COLUMN IF NOT EXISTS tenant_city          TEXT,
  ADD COLUMN IF NOT EXISTS tenant_country       TEXT,   -- ISO 3166-1 alpha-2
  ADD COLUMN IF NOT EXISTS client_legal_id      TEXT,
  ADD COLUMN IF NOT EXISTS client_street        TEXT,
  ADD COLUMN IF NOT EXISTS client_postal_code   TEXT,
  ADD COLUMN IF NOT EXISTS client_city          TEXT,
  ADD COLUMN IF NOT EXISTS client_country       TEXT;

COMMENT ON COLUMN invoice.tenant_legal_id IS
  'Identifiant légal de l''émetteur au moment de l''émission (SIREN/SIRET en FR, BCE en BE) — BT-30 de EN 16931';
COMMENT ON COLUMN invoice.tenant_country IS
  'Code pays ISO 2 lettres — BT-40, donnée obligatoire EN 16931 (un UBL sans pays est rejeté)';

-- ─── Date de la vente ou de la prestation ─────────────────────────────────────
-- Mention obligatoire, distincte de la date d'émission : une facture émise le 5
-- pour une prestation du 28 du mois précédent doit porter les deux dates.

ALTER TABLE invoice
  ADD COLUMN IF NOT EXISTS service_date DATE;

COMMENT ON COLUMN invoice.service_date IS
  'Date de la vente ou de l''achèvement de la prestation — mention obligatoire art. 242 nonies A annexe II CGI';

-- ─── Régime de TVA et mentions légales figées ─────────────────────────────────

ALTER TABLE invoice
  ADD COLUMN IF NOT EXISTS vat_regime     TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS legal_mentions JSONB DEFAULT '{}';

COMMENT ON COLUMN invoice.vat_regime IS
  'standard | franchise (art. 293 B CGI) | medical (art. 261-4-1 CGI) | reverse_charge (autoliquidation) | export';
COMMENT ON COLUMN invoice.legal_mentions IS
  'Mentions légales figées à l''émission : { late_penalty_rate, recovery_fee, legal_form, share_capital, rcs_city, insurance_name, insurance_coverage }';

-- ─── Factures d'avoir ─────────────────────────────────────────────────────────
-- Une facture envoyée ne peut plus être modifiée. La seule correction conforme
-- est un avoir qui référence la facture d'origine.

ALTER TABLE invoice
  ADD COLUMN IF NOT EXISTS document_type  TEXT NOT NULL DEFAULT 'invoice',
  ADD COLUMN IF NOT EXISTS credit_note_of UUID REFERENCES invoice(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credit_reason  TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_document_type_check'
  ) THEN
    ALTER TABLE invoice
      ADD CONSTRAINT invoice_document_type_check
      CHECK (document_type IN ('invoice', 'credit_note'));
  END IF;
END $$;

COMMENT ON COLUMN invoice.document_type IS
  'invoice = facture (UBL InvoiceTypeCode 380) · credit_note = facture d''avoir (381)';
COMMENT ON COLUMN invoice.credit_note_of IS
  'Facture corrigée par cet avoir — obligatoire sur un avoir, la référence à la facture d''origine est exigée';

CREATE INDEX IF NOT EXISTS idx_invoice_credit_note_of ON invoice(credit_note_of);

-- Un avoir par facture : sans cette contrainte, un double clic créait deux
-- avoirs pour la même facture et le total remboursé doublait.
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_one_credit_note_per_invoice
  ON invoice(credit_note_of)
  WHERE credit_note_of IS NOT NULL;

-- ─── Séries de numérotation séparées ──────────────────────────────────────────
-- Les avoirs portent leur propre série (AV-2026-0001) : le droit français admet
-- des séries distinctes, à condition que chacune soit continue et sans trou.

ALTER TABLE invoice_sequence
  ADD COLUMN IF NOT EXISTS series TEXT NOT NULL DEFAULT 'invoice';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'invoice_sequence_pkey'
       AND conrelid = 'invoice_sequence'::regclass
  ) THEN
    ALTER TABLE invoice_sequence DROP CONSTRAINT invoice_sequence_pkey;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'invoice_sequence_pkey'
       AND conrelid = 'invoice_sequence'::regclass
  ) THEN
    ALTER TABLE invoice_sequence
      ADD CONSTRAINT invoice_sequence_pkey PRIMARY KEY (tenant_id, year, series);
  END IF;
END $$;

-- Incrémente la série demandée et renvoie le numéro dans la même instruction.
-- L'ancienne version faisait un UPSERT puis un SELECT séparé ; le RETURNING
-- supprime la fenêtre entre les deux.
CREATE OR REPLACE FUNCTION increment_invoice_sequence_series(
  p_tenant_id UUID,
  p_year      INT,
  p_series    TEXT
)
RETURNS INT AS $$
DECLARE
  v_num INT;
BEGIN
  INSERT INTO invoice_sequence(tenant_id, year, series, last_number)
    VALUES (p_tenant_id, p_year, p_series, 1)
  ON CONFLICT (tenant_id, year, series)
    DO UPDATE SET last_number = invoice_sequence.last_number + 1
  RETURNING last_number INTO v_num;

  RETURN v_num;
END;
$$ LANGUAGE plpgsql;

-- L'ancienne signature reste appelable : elle délègue à la série par défaut.
CREATE OR REPLACE FUNCTION increment_invoice_sequence(p_tenant_id UUID, p_year INT)
RETURNS INT AS $$
  SELECT increment_invoice_sequence_series(p_tenant_id, p_year, 'invoice');
$$ LANGUAGE sql;

-- ─── Paramètres tenant ────────────────────────────────────────────────────────
-- invoice_settings est un JSONB : les nouvelles clés (legal_id, legal_form,
-- share_capital, rcs_city, address_*, vat_regime, late_penalty_rate,
-- recovery_fee, insurance_*, credit_prefix) n'exigent aucune migration.

COMMENT ON COLUMN tenant.invoice_settings IS
  'Config facturation tenant : { prefix, credit_prefix, vat_number, legal_id, legal_form, share_capital, rcs_city, address_street, address_postal_code, address_city, address_country, vat_regime, late_penalty_rate, recovery_fee, insurance_name, insurance_coverage, default_tax_rate, payment_terms_days, bank_iban, bank_bic, bank_name, footer_note }';
