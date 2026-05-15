-- ============================================================
-- Migration 024 — Ajouter stripe_price_id à plan_subscription
-- ============================================================

ALTER TABLE plan_subscription
  ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(255);

UPDATE plan_subscription SET stripe_price_id = 'price_1TXJ5F7BTsYqdzr56EibBXHz' WHERE name = 'Essentiel';
UPDATE plan_subscription SET stripe_price_id = 'price_1TXJ1y7BTsYqdzr5gzqTfShj' WHERE name = 'Pro';
UPDATE plan_subscription SET stripe_price_id = 'price_1TXJ4E7BTsYqdzr5arywcH2E' WHERE name = 'Business';
