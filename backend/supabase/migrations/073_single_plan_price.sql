-- ============================================================
-- Migration 073 — Un seul prix de plan
-- ============================================================
-- plan_subscription portait DEUX colonnes de prix :
--   price_eur     — déclarée dans la migration 001, lue par /admin/billing
--   price_monthly — ajoutée à la main hors migration, lue par /admin/metrics,
--                   par /subscriptions/plans et affichée au client
--
-- Les deux MRR du panel admin pouvaient donc diverger sans que rien ne le
-- signale. On fait de price_monthly la colonne de référence (c'est celle que
-- voit le client) et on garde price_eur synchronisée pour les lectures
-- historiques, avant suppression dans une migration ultérieure.

-- Au cas où la colonne n'existerait pas sur un environnement reconstruit
-- depuis les migrations seules.
ALTER TABLE plan_subscription
  ADD COLUMN IF NOT EXISTS price_monthly numeric(8,2);

-- Backfill dans les deux sens : aucune valeur n'est perdue.
UPDATE plan_subscription SET price_monthly = price_eur
 WHERE price_monthly IS NULL AND price_eur IS NOT NULL;

UPDATE plan_subscription SET price_eur = price_monthly
 WHERE price_monthly IS NOT NULL AND price_eur IS DISTINCT FROM price_monthly;

COMMENT ON COLUMN plan_subscription.price_monthly IS
  'Prix mensuel TTC affiché au client — colonne de référence.';
COMMENT ON COLUMN plan_subscription.price_eur IS
  'LEGACY : conservée synchronisée avec price_monthly. Ne plus lire.';

-- Garde-fou : empêche les deux colonnes de rediverger en silence.
CREATE OR REPLACE FUNCTION sync_plan_price() RETURNS trigger AS $$
BEGIN
  IF NEW.price_monthly IS DISTINCT FROM OLD.price_monthly THEN
    NEW.price_eur := NEW.price_monthly;
  ELSIF NEW.price_eur IS DISTINCT FROM OLD.price_eur THEN
    NEW.price_monthly := NEW.price_eur;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_plan_price ON plan_subscription;
CREATE TRIGGER trg_sync_plan_price
  BEFORE UPDATE ON plan_subscription
  FOR EACH ROW EXECUTE FUNCTION sync_plan_price();
