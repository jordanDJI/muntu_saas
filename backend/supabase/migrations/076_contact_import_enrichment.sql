-- ============================================================
-- Migration 076 — Import de contacts : enrichissement et traçabilité
-- ============================================================
-- L'import était en insertion seule : une ligne dont l'email existait déjà
-- était comptée en « ignorée » et abandonnée. Réimporter le même fichier
-- enrichi d'informations supplémentaires ne mettait donc rien à jour.
--
-- L'import sait désormais rapprocher une ligne d'un contact existant et le
-- compléter. Deux modes :
--   complete  (défaut) — ne remplit que les champs vides, aucun risque
--   overwrite          — les valeurs du fichier remplacent celles en base
--
-- Dans les deux cas, une cellule vide n'efface jamais rien : une colonne vide
-- signifie « information absente », pas « supprime la valeur ».

ALTER TABLE contact_import_job
  ADD COLUMN IF NOT EXISTS mode             text    DEFAULT 'complete',
  ADD COLUMN IF NOT EXISTS enriched_count   integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ambiguous_count  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS changes          jsonb;

COMMENT ON COLUMN contact_import_job.mode IS
  'complete = ne remplit que les champs vides | overwrite = le fichier fait foi';
COMMENT ON COLUMN contact_import_job.enriched_count IS
  'Contacts existants mis à jour par cet import';
COMMENT ON COLUMN contact_import_job.ambiguous_count IS
  'Lignes correspondant à plusieurs contacts existants — volontairement non traitées';
COMMENT ON COLUMN contact_import_job.changes IS
  'Détail des modifications appliquées : [{contact_id, name, field, from, to}]. '
  'Écraser une valeur est destructif, la trace est donc conservée.';
