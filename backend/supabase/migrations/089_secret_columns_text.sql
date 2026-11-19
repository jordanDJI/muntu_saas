-- 089 — Colonnes de secrets en `text` (suite de 081).
--
-- En production, agent_config.telegram_bot_token était un varchar(120) — écart
-- entre les migrations et la base réelle (voir CLAUDE.md, « les migrations ne
-- sont pas la source de vérité »). Un secret chiffré (préfixe « enc:v1: » + jeton
-- Fernet, ~150 caractères) n'y tenait pas : scripts/encrypt_existing_secrets.py
-- échouait en 22001, et un tenant ne pouvait plus enregistrer son bot Telegram.
--
-- On élargit en `text` toute colonne de secret encore en varchar. varchar → text
-- ne réécrit pas la table et ne perd aucune donnée. Une colonne absente ou déjà
-- en text est ignorée.
--
-- Après application : python /app/scripts/encrypt_existing_secrets.py --apply

do $$
declare
  r record;
begin
  for r in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and data_type = 'character varying'
      and (table_name, column_name) in (
        ('agent_config', 'telegram_bot_token'),
        ('site', 'paypal_client_secret'),
        ('google_analytics_connection', 'access_token'),
        ('google_analytics_connection', 'refresh_token'),
        ('ocr_summary', 'summary_encrypted')
      )
  loop
    execute format('alter table public.%I alter column %I type text', r.table_name, r.column_name);
    raise notice 'élargie en text : %.%', r.table_name, r.column_name;
  end loop;
end $$;
