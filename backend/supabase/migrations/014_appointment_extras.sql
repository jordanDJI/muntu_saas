-- Migration 014 — Extras rendez-vous
-- conversation_summary : résumé de la conversation Agent 2 joint au RDV
-- reminder_sent_at     : horodatage du rappel 24h envoyé au client (évite les doublons)

ALTER TABLE appointment ADD COLUMN IF NOT EXISTS conversation_summary TEXT;
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
