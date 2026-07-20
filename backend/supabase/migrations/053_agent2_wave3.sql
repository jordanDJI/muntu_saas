-- Migration 053 : Agent 2 Wave 3 — suivi post-intervention + mode diagnostic

ALTER TABLE agent_config
  ADD COLUMN IF NOT EXISTS followup_enabled        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS followup_delay_hours    INT     DEFAULT 24,
  ADD COLUMN IF NOT EXISTS followup_message        TEXT,
  ADD COLUMN IF NOT EXISTS diagnostic_mode_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN agent_config.followup_enabled
  IS 'Active l''envoi automatique d''un message de suivi après chaque RDV confirmé';
COMMENT ON COLUMN agent_config.followup_delay_hours
  IS 'Délai en heures avant l''envoi du message de suivi (défaut 24h)';
COMMENT ON COLUMN agent_config.followup_message
  IS 'Template du message de suivi — supporte {prenom} comme variable';
COMMENT ON COLUMN agent_config.diagnostic_mode_enabled
  IS 'L''agent pose des questions structurées avant de proposer une solution (arbre de diagnostic)';
