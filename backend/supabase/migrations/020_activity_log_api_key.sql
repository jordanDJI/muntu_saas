-- Journal d'activité par tenant/utilisateur
create table if not exists activity_log (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  uuid        references tenant(id) on delete cascade,
  user_id    uuid,
  action     text        not null,
  detail     text,
  created_at timestamptz default now()
);
create index if not exists activity_log_tenant_created_at on activity_log (tenant_id, created_at desc);

-- Clé API par tenant (sk_ + hex uuid)
alter table tenant add column if not exists api_key text unique;
