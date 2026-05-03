-- Migration 011 — Numéros WhatsApp par agent
-- support_client    → numéro WABA business (les clients y écrivent, 360dialog y reçoit)
-- assistant_tenant  → numéro perso du professionnel (reçoit les notifications RDV)

ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(30);
