-- Annuaire public Klientys
-- Opt-in explicite par tenant pour apparaître dans l'annuaire

create table if not exists directory_listing (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid references tenant(id) on delete cascade unique,
  is_listed      boolean not null default false,
  listed_at      timestamptz,
  metier_slug    text not null,
  display_name   text not null,
  tagline        text,
  zones          text[] not null default '{}',
  primary_zone   text not null,
  profile_photo_url text,
  accepts_booking   boolean not null default true,
  updated_at     timestamptz not null default now()
);

-- Index pour les recherches annuaire
create index if not exists idx_directory_metier_zone
  on directory_listing (metier_slug, primary_zone)
  where is_listed = true;

create index if not exists idx_directory_zones
  on directory_listing using gin (zones)
  where is_listed = true;

-- RLS
alter table directory_listing enable row level security;

-- Lecture publique des fiches actives
create policy "directory_public_read" on directory_listing
  for select using (is_listed = true);

-- Tenant peut lire/modifier sa propre fiche
create policy "directory_tenant_read_own" on directory_listing
  for select using (
    tenant_id in (
      select tenant_id from membership where user_id = auth.uid()
    )
  );

create policy "directory_tenant_write_own" on directory_listing
  for all using (
    tenant_id in (
      select tenant_id from membership where user_id = auth.uid()
    )
  );
