create table if not exists design_request (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid references tenant(id) on delete cascade,
  tenant_name    text,
  site_id        uuid references site(id) on delete set null,
  site_name      text,
  is_additional  boolean not null default false,
  message        text,
  status         text not null default 'pending',
  admin_notes    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index on design_request (tenant_id);
create index on design_request (status, created_at desc);

alter table design_request enable row level security;
create policy "tenant own" on design_request
  for all using (tenant_id = (
    select m.tenant_id from membership m
    where m.user_id = auth.uid()
    limit 1
  ));
