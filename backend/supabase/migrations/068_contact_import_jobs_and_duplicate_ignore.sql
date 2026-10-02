-- Import CSV/Excel en arrière-plan (survit à la fermeture de l'onglet) + doublons ignorés définitivement.

create table if not exists contact_import_job (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  status text not null default 'processing',  -- 'processing' | 'done' | 'error'
  filename text,
  created_count int,
  skipped_count int,
  errors jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists idx_contact_import_job_tenant on contact_import_job (tenant_id, created_at desc);

create table if not exists contact_duplicate_ignore (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  match_type text not null,   -- 'email' | 'phone'
  match_value text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, match_type, match_value)
);
