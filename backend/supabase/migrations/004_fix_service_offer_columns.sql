-- ============================================================
-- Migration 004 — Alignement colonnes service_offer
-- La table en base a des noms différents du code applicatif
-- ============================================================

-- Renommer les colonnes pour correspondre au modèle Pydantic et au frontend
ALTER TABLE service_offer
    RENAME COLUMN duration_minutes TO duration_min;

ALTER TABLE service_offer
    RENAME COLUMN price_from TO price_eur;

-- Supprimer les colonnes non utilisées par l'application
ALTER TABLE service_offer
    DROP COLUMN IF EXISTS target_audience;

ALTER TABLE service_offer
    DROP COLUMN IF EXISTS bookable;
