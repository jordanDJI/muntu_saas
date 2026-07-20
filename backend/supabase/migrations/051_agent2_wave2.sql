-- Migration 051 : Agent 2 Wave 2 — photo-diagnostic Gemini Vision

ALTER TABLE agent_config
  ADD COLUMN IF NOT EXISTS photo_diagnosis_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN agent_config.photo_diagnosis_enabled
  IS 'Active le pré-diagnostic photo via Gemini Vision (Telegram uniquement)';
