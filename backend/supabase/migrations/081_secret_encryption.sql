-- 081 — Chiffrement applicatif des secrets (KLT-1820, KLT-0820) et webhook
-- Telegram par identifiant (KLT-0821).
--
-- Le chiffrement lui-même est fait par le backend (app/core/crypto.py, préfixe
-- « enc:v1: »). Cette migration n'ajoute que ce dont la base a besoin pour
-- retrouver une ligne sans lire le secret en clair.
--
-- Après application ET après avoir posé DATA_ENCRYPTION_KEY dans l'environnement :
--   cd backend && python scripts/encrypt_existing_secrets.py --apply

-- Empreinte SHA-256 du jeton de bot : le chiffrement Fernet n'est pas
-- déterministe, on ne peut plus chercher « where telegram_bot_token = $1 ».
alter table agent_config add column if not exists telegram_bot_token_hash text;

-- Identifiant aléatoire placé dans l'URL du webhook à la place du jeton du bot,
-- qui apparaissait dans tous les logs d'accès.
alter table agent_config add column if not exists telegram_webhook_id text;

create unique index if not exists agent_config_telegram_webhook_id_key
  on agent_config (telegram_webhook_id) where telegram_webhook_id is not null;

create index if not exists agent_config_telegram_bot_token_hash_idx
  on agent_config (telegram_bot_token_hash) where telegram_bot_token_hash is not null;

-- Rattrapage des empreintes pour les jetons encore en clair. sha256() est natif
-- depuis PostgreSQL 11 ; même calcul que crypto.lookup_hash() (hex minuscule).
update agent_config
   set telegram_bot_token_hash = encode(sha256(convert_to(telegram_bot_token, 'UTF8')), 'hex')
 where telegram_bot_token is not null
   and telegram_bot_token <> ''
   and telegram_bot_token not like 'enc:%'
   and telegram_bot_token_hash is null;

comment on column ocr_summary.summary_encrypted is
  'Chiffré par le backend (préfixe enc:v1:, app/core/crypto.py). Les lignes antérieures à la migration 081 sont en clair jusqu''au passage de scripts/encrypt_existing_secrets.py.';
