-- Snapshot immuable du site au moment de la publication
-- La page publique lit ce champ ; le builder/preview lit les tables live.
ALTER TABLE site ADD COLUMN IF NOT EXISTS published_snapshot JSONB;
