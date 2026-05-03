-- Migration 012 — Configuration Telegram par agent
-- telegram_bot_token     : pour support_client  → token du bot (les clients y écrivent)
-- telegram_notify_chat_id: pour assistant_tenant → chat_id perso du professionnel (notifs RDV)
-- contact.telegram_chat_id: lie un chat_id Telegram à un contact existant

ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS telegram_bot_token    VARCHAR(120);
ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS telegram_notify_chat_id BIGINT;

ALTER TABLE contact ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_contact_telegram ON contact(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
