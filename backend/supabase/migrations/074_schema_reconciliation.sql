-- ============================================================
-- Migration 074 — Réconciliation du schéma réel et des migrations
-- ============================================================
-- Constat : la base de production et le dossier migrations/ ont divergé dans
-- les deux sens. Comparaison faite le 2026-10-04 entre les 73 migrations et
-- le schéma exposé par PostgREST :
--
--   * 34 éléments déclarés par une migration et ABSENTS en base
--     (la migration 001 n'a jamais été appliquée telle quelle : la base a été
--      construite autrement, puis 001 a été écrite après coup pour la décrire,
--      de façon imparfaite) ;
--   * 50 colonnes présentes en base et déclarées PAR AUCUNE migration
--     (ajoutées à la main dans l'éditeur Supabase) ;
--   * la table site_event, documentée dans CLAUDE.md, n'a aucun fichier de
--     migration.
--
-- Conséquence : une reconstruction depuis les migrations seules (supabase db
-- reset, nouvel environnement, CI) produit une base qui ne ressemble pas à la
-- production. C'est la même cause racine que les policies RLS écrites à la
-- main, corrigées par la migration 071.
--
-- Principe de cette migration : le schéma RÉEL fait foi. On ne supprime rien,
-- on n'aligne pas la base sur les migrations — on aligne les migrations sur la
-- base, pour qu'une reconstruction converge. Tout est idempotent : appliquée
-- en production, cette migration est un no-op à deux exceptions près, les
-- sections A et B, qui corrigent de vrais problèmes.
-- ============================================================


-- ============================================================
-- A. BUG RÉEL — un résumé IA perdu à chaque réservation Telegram
-- ============================================================
-- `conversation_summary` est déclarée par la migration 014 et absente en base.
-- webhook.py écrit dedans après chaque réservation via l'agent Telegram :
--
--     sb.table("appointment").update({"conversation_summary": summary})
--
-- L'appel est enveloppé dans un `try / except Exception: pass`, donc l'erreur
-- « column does not exist » est avalée sans trace : le résumé de conversation
-- généré par Gemini est jeté silencieusement depuis l'origine de la feature.
ALTER TABLE appointment
  ADD COLUMN IF NOT EXISTS conversation_summary text;

COMMENT ON COLUMN appointment.conversation_summary IS
  'Résumé de la conversation ayant mené à la réservation (agent Telegram, Gemini).';


-- ============================================================
-- B. CONTRAINTES D'UNICITÉ DONT DÉPENDENT LES UPSERTS
-- ============================================================
-- Chaque `on_conflict=` de supabase-py exige une contrainte unique
-- correspondante, sinon Postgres renvoie 42P10 et l'upsert échoue.
--
-- Le cas sensible est `subscription (tenant_id)` : le webhook Stripe fait
-- `upsert(..., on_conflict="tenant_id")` pour activer un abonnement, et aucun
-- paiement Stripe n'a jamais abouti sur ce compte (0 facture, 0 abonnement
-- live au 2026-10-04) — ce chemin n'a donc probablement jamais tourné en
-- production. Sans contrainte, le premier vrai paiement encaisserait l'argent
-- sans rien activer.
--
-- VÉRIFIÉ depuis : la contrainte existait déjà, sous ce nom exact
-- (uq_subscription_tenant). Le risque n'était donc pas réel, et le CREATE
-- ci-dessous est un no-op. C'est en le vérifiant qu'on a découvert que sept
-- des huit index de cette section faisaient doublon — voir la 075.
--
-- Aucun doublon de données sur ces clés, les index se créent sans erreur.
-- Pour re-contrôler avant d'appliquer sur un autre environnement :
--
--   select tenant_id, count(*) from subscription group by 1 having count(*)>1;
--   select tenant_id, user_id, count(*) from membership group by 1,2 having count(*)>1;
--   select tenant_id, feature_key, count(*) from tenant_feature_override group by 1,2 having count(*)>1;
--   select tenant_id, period, count(*) from tenant_roi_cache group by 1,2 having count(*)>1;

-- ATTENTION — voir la migration 075.
-- Sept des huit index ci-dessous se sont révélés redondants : les contraintes
-- existaient déjà sous les noms auto-générés par Postgres
-- (`<table>_<colonnes>_key`), et `IF NOT EXISTS` ne compare que le NOM de
-- l'index, pas sa définition. La migration 075 supprime les doublons. Seuls
-- uq_subscription_tenant (préexistant sous ce nom) et uq_appointment_deposit_order
-- (migration 072, index partiel) sont conservés.

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_tenant
  ON subscription (tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_membership_tenant_user
  ON membership (tenant_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_domain_tenant
  ON custom_domain (tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_domain_domain
  ON custom_domain (domain);

CREATE UNIQUE INDEX IF NOT EXISTS uq_feature_override_tenant_key
  ON tenant_feature_override (tenant_id, feature_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_roi_cache_tenant_period
  ON tenant_roi_cache (tenant_id, period);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ga_connection_tenant
  ON google_analytics_connection (tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_push_subscription_user_tenant
  ON push_subscription (user_id, tenant_id);

-- `membership (tenant_id, user_id)` mérite une mention : get_membership_role()
-- (middleware/roles.py) et _get_role() (api/v1/members.py) lisent le rôle avec
-- un `.limit(1)` sans tri. Sans unicité, le rôle renvoyé pour un utilisateur
-- présent deux fois dans le même espace serait non déterministe — donc la
-- garde de facturation owner/admin aussi.


-- ============================================================
-- C. COLONNES RÉELLES, DÉCLARÉES PAR AUCUNE MIGRATION
-- ============================================================
-- No-op en production : elles existent déjà. Leur raison d'être est qu'une
-- base reconstruite depuis les migrations les possède aussi.
--
-- Limite assumée : les longueurs de varchar, valeurs par défaut, contraintes
-- NOT NULL et clés étrangères d'origine ne sont PAS reproduites ici — elles ne
-- sont pas lisibles via PostgREST. Les types ci-dessous sont compatibles mais
-- pas strictement identiques. Voir la section F pour le baseline exact.

-- Facturation et plans
ALTER TABLE subscription
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date   date;

ALTER TABLE plan_subscription
  ADD COLUMN IF NOT EXISTS chatbot_enabled boolean,
  ADD COLUMN IF NOT EXISTS roi_enabled     boolean,
  ADD COLUMN IF NOT EXISTS max_messages    integer,
  ADD COLUMN IF NOT EXISTS max_sites       integer,
  ADD COLUMN IF NOT EXISTS max_users       integer;

ALTER TABLE tenant
  ADD COLUMN IF NOT EXISTS business_model text,
  ADD COLUMN IF NOT EXISTS status         text,
  ADD COLUMN IF NOT EXISTS updated_at     timestamp;

ALTER TABLE membership
  ADD COLUMN IF NOT EXISTS joined_at timestamp DEFAULT now();

-- Agenda
ALTER TABLE appointment
  ADD COLUMN IF NOT EXISTS updated_at timestamp;

ALTER TABLE calendar
  ADD COLUMN IF NOT EXISTS external_calendar_id text,
  ADD COLUMN IF NOT EXISTS last_synced_at       timestamp,
  ADD COLUMN IF NOT EXISTS timezone             text;

ALTER TABLE blocked_period
  ADD COLUMN IF NOT EXISTS color text;

-- CRM
ALTER TABLE contact
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS updated_at   timestamp;

ALTER TABLE lead
  ADD COLUMN IF NOT EXISTS channel_id uuid;

ALTER TABLE pipeline_stage
  ADD COLUMN IF NOT EXISTS is_final boolean;

-- Site
ALTER TABLE site
  ADD COLUMN IF NOT EXISTS domain text;

ALTER TABLE page
  ADD COLUMN IF NOT EXISTS audience_type   text,
  ADD COLUMN IF NOT EXISTS seo_title       text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS status          text,
  ADD COLUMN IF NOT EXISTS type            text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamp;

ALTER TABLE service_area
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS region  text;

ALTER TABLE template
  ADD COLUMN IF NOT EXISTS active        boolean,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS version       text;

-- Comptes, canaux, notifications
ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS phone      text,
  ADD COLUMN IF NOT EXISTS status     text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp;

ALTER TABLE channel
  ADD COLUMN IF NOT EXISTS connected_at        timestamp,
  ADD COLUMN IF NOT EXISTS external_identifier text,
  ADD COLUMN IF NOT EXISTS status              text;

ALTER TABLE notification
  ADD COLUMN IF NOT EXISTS appointment_id uuid,
  ADD COLUMN IF NOT EXISTS contact_id     uuid,
  ADD COLUMN IF NOT EXISTS lead_id        uuid,
  ADD COLUMN IF NOT EXISTS channel        text,
  ADD COLUMN IF NOT EXISTS content        text,
  ADD COLUMN IF NOT EXISTS scheduled_at   timestamp,
  ADD COLUMN IF NOT EXISTS sent_at        timestamp,
  ADD COLUMN IF NOT EXISTS status         text;

-- Landing page
ALTER TABLE landing_testimonial
  ADD COLUMN IF NOT EXISTS active     boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();


-- ============================================================
-- D. TABLE site_event — documentée, jamais migrée
-- ============================================================
-- Son DDL figure dans CLAUDE.md (analytics comportementaux) mais aucun fichier
-- de migration ne la crée. Elle existe en production ; ce bloc la rend
-- reproductible.
CREATE TABLE IF NOT EXISTS site_event (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  uuid REFERENCES tenant(id) ON DELETE CASCADE,
    session_id text,
    event_type text NOT NULL,
    section    text,
    data       jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_event_tenant_created
  ON site_event (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_event_tenant_type
  ON site_event (tenant_id, event_type);


-- ============================================================
-- E. DIVERGENCES CONNUES, VOLONTAIREMENT NON RÉCONCILIÉES
-- ============================================================
-- Ces éléments sont déclarés par une migration et absents en base. Aucun code
-- ne les lit : les ajouter créerait des colonnes mortes, ou des doublons de
-- colonnes qui existent déjà sous un autre nom. Le nom RÉEL fait foi.
--
--   subscription   001 déclare started_at / expires_at
--                  → réel : start_date / end_date (utilisés par admin.py)
--   membership     001 déclare created_at
--                  → réel : joined_at (aucun code ne lit l'un ni l'autre ;
--                    c'est ce qui a rendu impossible la datation des
--                    memberships lors de l'audit de sécurité)
--   calendar       001 déclare cal_com_id, created_at
--                  → réel : external_calendar_id, timezone, last_synced_at
--   notification   001 déclare title, body, is_read, user_id, created_at
--                  → réel : forme entièrement différente (section C).
--                    Aucun usage dans le code : 0 appel à table("notification")
--   page           001 déclare content, is_published, created_at
--                  → réel : status, type, seo_*. Aucun usage dans le code
--   template       001 déclare sector, preview_url, created_at
--                  → réel : business_type, version, active. Aucun usage
--   channel        001 déclare name, created_at → réel : section C. Aucun usage
--   service_area   001 déclare radius_km  → absente, aucun usage
--   app_user       001 déclare avatar_url → absente ; l'avatar vit en réalité
--                  dans user_metadata de Supabase Auth, pas dans cette table
--   service_offer / plan_subscription / pipeline_stage : created_at déclarée,
--                  absente, aucun usage
--
-- Si l'une de ces colonnes devient nécessaire un jour, elle sera ajoutée par
-- une migration dédiée — pas en ressuscitant la 001.


-- ============================================================
-- F. LIMITE DE CETTE MIGRATION
-- ============================================================
-- Elle rend une reconstruction CONVERGENTE, pas identique : longueurs de
-- varchar, valeurs par défaut, NOT NULL et clés étrangères d'origine ne sont
-- pas reproduites (PostgREST ne les expose pas).
--
-- Pour un baseline exact, générer un dump du schéma de production et le
-- committer comme référence :
--
--   supabase db dump --schema public --file backend/supabase/schema.sql
--   # ou, avec la chaîne de connexion Postgres :
--   pg_dump --schema-only --schema=public "$DATABASE_URL" > backend/supabase/schema.sql
--
-- À refaire après avoir appliqué cette migration. C'est le seul moyen de
-- garantir qu'un nouvel environnement soit identique à la production.
