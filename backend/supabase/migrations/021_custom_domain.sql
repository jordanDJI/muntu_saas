-- Domaines personnalisés par tenant
create table if not exists custom_domain (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        uuid        not null references tenant(id) on delete cascade,
  domain           text        not null,
  status           text        not null default 'pending', -- pending | active | error
  source           text        not null default 'external', -- external | ovh_purchased
  vercel_status    text,
  dns_record_type  text        default 'CNAME',
  dns_record_name  text        default 'www',
  dns_record_value text        default 'cname.vercel-dns.com',
  verified_at      timestamptz,
  created_at       timestamptz default now(),
  unique(tenant_id),
  unique(domain)
);

create index if not exists custom_domain_domain on custom_domain (domain);
create index if not exists custom_domain_status on custom_domain (status);

-- Addon domaine payant (+5€/mois) pour les plans non-Business
alter table tenant add column if not exists custom_domain_addon boolean default false;
