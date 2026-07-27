-- Migration 059 — mots-clés Google Trends personnalisés par tenant
ALTER TABLE tenant
  ADD COLUMN IF NOT EXISTS trend_keywords text[];

COMMENT ON COLUMN tenant.trend_keywords IS 'Mots-clés Google Trends personnalisés (NULL = défauts du secteur)';
