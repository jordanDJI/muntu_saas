-- Migration 027 — Garantit l'existence des colonnes notes sur lead et appointment
-- Ces colonnes sont dans le schéma initial (001) mais peuvent être absentes
-- du cache PostgREST si la migration n'a pas été appliquée correctement.

ALTER TABLE lead        ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS notes TEXT;

-- Force le rechargement du cache de schéma PostgREST
NOTIFY pgrst, 'reload schema';
