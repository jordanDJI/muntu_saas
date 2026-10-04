-- ============================================================
-- Migration 075 — Supprimer les index uniques redondants créés par la 074
-- ============================================================
-- La migration 074 a créé huit index uniques pour garantir que chaque
-- `on_conflict=` du code dispose bien d'une contrainte. Sept d'entre eux
-- faisaient doublon : les contraintes existaient déjà, sous les noms
-- auto-générés par Postgres (`<table>_<colonnes>_key`).
--
-- Cause de l'erreur : `CREATE UNIQUE INDEX IF NOT EXISTS` ne compare que le
-- NOM de l'index, jamais sa définition. Des noms choisis librement
-- (`uq_custom_domain_domain`…) ne pouvaient donc pas entrer en collision avec
-- les noms existants (`custom_domain_domain_key`…), et le garde-fou
-- `IF NOT EXISTS` n'a rien empêché.
--
-- Conséquence : aucune perte de correction — l'unicité reste garantie par les
-- contraintes d'origine — mais chaque écriture sur ces sept tables maintenait
-- deux index identiques, pour rien.
--
-- On supprime les index créés par la 074, pas les contraintes d'origine : ces
-- dernières sont adossées à pg_constraint et déclarées dans les migrations
-- (021 pour custom_domain, 018 pour tenant_roi_cache, 025 pour
-- google_analytics_connection, 028 pour tenant_feature_override, 055 pour
-- push_subscription).

DROP INDEX IF EXISTS uq_custom_domain_domain;             -- = custom_domain_domain_key
DROP INDEX IF EXISTS uq_custom_domain_tenant;             -- = custom_domain_tenant_id_key
DROP INDEX IF EXISTS uq_ga_connection_tenant;             -- = google_analytics_connection_tenant_id_key
DROP INDEX IF EXISTS uq_membership_tenant_user;           -- = uq_membership
DROP INDEX IF EXISTS uq_push_subscription_user_tenant;    -- = push_subscription_user_id_tenant_id_key
DROP INDEX IF EXISTS uq_feature_override_tenant_key;      -- = tenant_feature_override_tenant_id_feature_key_key
DROP INDEX IF EXISTS uq_roi_cache_tenant_period;          -- = tenant_roi_cache_tenant_id_period_key

-- CONSERVÉS volontairement :
--
--   uq_subscription_tenant        préexistait sous ce nom exact ; c'est le seul
--                                 index unique sur subscription (tenant_id), et
--                                 l'upsert du webhook Stripe en dépend
--                                 (on_conflict="tenant_id").
--
--   uq_appointment_deposit_order  index unique PARTIEL créé par la migration
--                                 072 (WHERE deposit_paypal_order_id IS NOT
--                                 NULL). Aucun équivalent préexistant : il
--                                 empêche un même order PayPal de financer
--                                 deux rendez-vous.

-- ── Contrôle après application ──────────────────────────────────────────────
-- Ne doit renvoyer AUCUNE ligne : plus aucun couple (table, colonnes) ne doit
-- être couvert par deux index uniques.
--
--   select table_name, columns, count(*) as nb_index, array_agg(index_name) as doublons
--   from (
--     select t.relname as table_name,
--            i.relname as index_name,
--            array_agg(a.attname order by k.ord) as columns
--     from pg_index ix
--     join pg_class i on i.oid = ix.indexrelid
--     join pg_class t on t.oid = ix.indrelid
--     join pg_namespace n on n.oid = t.relnamespace
--     join unnest(ix.indkey) with ordinality as k(attnum, ord) on true
--     join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
--     where n.nspname = 'public' and ix.indisunique
--     group by t.relname, i.relname
--   ) s
--   group by table_name, columns
--   having count(*) > 1
--   order by 1;
