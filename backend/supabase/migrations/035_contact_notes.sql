-- Migration 035 — Ajout de la colonne notes sur la table contact
-- La colonne notes existe déjà sur lead (027) et appointment (027).
-- Ce champ permet d'ajouter des notes internes sur un contact dans le CRM.

ALTER TABLE contact ADD COLUMN IF NOT EXISTS notes TEXT;
