-- 086 — Moteur d'acquisition : nouvelles entreprises SIRENE, outil « demande
-- locale », parrainage.
--
-- Après application :
--   • INSEE_API_KEY dans l'environnement backend (clé gratuite, portail-api.insee.fr,
--     application abonnée à l'API Sirene) — sans elle, l'import SIRENE est inactif.
--   • Aucune configuration Stripe : le coupon de parrainage est créé à la première
--     utilisation (services/referral.py).
--
-- Toutes les tables sont internes (lues par le backend uniquement) : RLS sans policy.

-- ── Entreprises nouvellement immatriculées (prospection) ─────────────────────
create table if not exists prospect_company (
  id              uuid primary key default gen_random_uuid(),
  source          text not null default 'sirene',          -- sirene | kbo
  external_id     text not null,                           -- SIRET, numéro BCE
  name            text not null,
  naf_code        text,
  sector          text,                                    -- clé secteur Klientys
  headcount_band  text,                                    -- tranche d'effectif INSEE
  legal_category  text,
  created_on      date,                                    -- date de création de l'établissement
  street          text,
  postal_code     text,
  city            text,
  department      text,
  country         text not null default 'FR',
  status          text not null default 'new',             -- new | contacted | converted | ignored
  notes           text,
  imported_at     timestamptz not null default now(),
  status_changed_at timestamptz,
  unique (source, external_id)
);
create index if not exists prospect_company_listing_idx
  on prospect_company (status, created_on desc);
create index if not exists prospect_company_sector_idx
  on prospect_company (sector, department);
alter table prospect_company enable row level security;

-- ── Leads de l'outil public « demande locale » ───────────────────────────────
create table if not exists marketing_lead (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null,
  first_name          text,
  source              text not null default 'demand_tool',
  sector              text,
  activity            text,
  city                text,
  country             text,
  marketing_consent   boolean not null default false,
  report              jsonb,
  converted_tenant_id uuid references tenant(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists marketing_lead_email_idx on marketing_lead (lower(email));
create index if not exists marketing_lead_created_idx on marketing_lead (created_at desc);
alter table marketing_lead enable row level security;

-- Cache de l'outil public : Google Trends limite fortement le débit, et
-- l'outil ne doit pas épuiser le quota dont dépend le potentiel de demande des tenants.
create table if not exists public_demand_cache (
  cache_key   text primary key,
  data        jsonb not null,
  computed_at timestamptz not null default now()
);
alter table public_demand_cache enable row level security;

-- ── Parrainage ────────────────────────────────────────────────────────────────
-- Une ligne par filleul. Le code de parrainage est le slug du parrain, résolu en
-- identifiant à l'inscription : un changement de slug ultérieur ne casse rien.
create table if not exists referral (
  id                   uuid primary key default gen_random_uuid(),
  referrer_tenant_id   uuid not null references tenant(id) on delete cascade,
  referred_tenant_id   uuid not null references tenant(id) on delete cascade,
  code_used            text,
  via                  text not null default 'link',       -- link | badge | code
  status               text not null default 'signed_up',  -- signed_up | converted
  referred_discount_at timestamptz,                        -- 1er mois offert appliqué au checkout
  converted_at         timestamptz,                        -- 1re facture réellement payée
  reward_status        text not null default 'pending',    -- pending | credited | trial_extended | failed
  reward_detail        text,
  rewarded_at          timestamptz,
  created_at           timestamptz not null default now(),
  unique (referred_tenant_id)
);
create index if not exists referral_referrer_idx on referral (referrer_tenant_id, created_at desc);
alter table referral enable row level security;
