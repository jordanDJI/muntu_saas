-- 047_booking_questions_deposit.sql
-- Questions personnalisées sur le formulaire de RDV + dépôt PayPal par RDV

-- Questions : stockées dans site_style.booking_questions (JSONB, pas de migration sur site)
-- Réponses  : stockées ici dans appointment.custom_answers

ALTER TABLE appointment
  ADD COLUMN IF NOT EXISTS custom_answers jsonb DEFAULT '{}';

COMMENT ON COLUMN appointment.custom_answers IS
  'Réponses du client aux questions personnalisées du formulaire de RDV. Format: { "q_id": "réponse", ... }';

-- Dépôt PayPal
ALTER TABLE appointment
  ADD COLUMN IF NOT EXISTS deposit_status  text    DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS deposit_amount  numeric(10,2),
  ADD COLUMN IF NOT EXISTS deposit_paypal_order_id text;

COMMENT ON COLUMN appointment.deposit_status IS
  'Statut du dépôt PayPal : none | pending_payment | paid';

-- Secret PayPal (côté backend uniquement, jamais exposé publiquement)
ALTER TABLE site
  ADD COLUMN IF NOT EXISTS paypal_client_secret text;

COMMENT ON COLUMN site.paypal_client_secret IS
  'PayPal Client Secret du tenant — jamais retourné par l''API publique';
