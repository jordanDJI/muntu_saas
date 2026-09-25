-- Moteur RGPD : historique des consentements + rétention/anonymisation automatique.

create table if not exists contact_consent (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  contact_id uuid not null references contact(id) on delete cascade,
  channel text not null,        -- 'email' | 'telephone' | 'courrier' | 'marketing'
  granted boolean not null,
  consent_text text,            -- snapshot du texte accepté au moment du consentement
  source text not null,         -- 'public_form' | 'manual' | 'import' | 'public_link'
  created_at timestamptz not null default now()
);

create index if not exists idx_contact_consent_contact on contact_consent (contact_id, created_at desc);

alter table contact
  add column if not exists last_interaction_at timestamptz default now(),
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists anonymized_at timestamptz;

alter table tenant
  add column if not exists contact_retention_months int;  -- null = pas de purge automatique pour ce tenant
