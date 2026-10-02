-- Champs de fiche contact configurables par tenant (base + custom).
-- contact.contact_details devient contact.custom_fields : map plate {field_key: value},
-- sans plus de sous-objets imbriqués (address/urls aplatis en clés racine) pour coller
-- au modèle "un champ = une clé" de contact_field_def.

create table if not exists contact_field_def (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  field_key text not null,
  label text not null,
  field_type text not null,       -- 'text' | 'phone' | 'email' | 'date' | 'number' | 'select'
  storage_mode text not null,     -- 'column' (vraie colonne contact.*) | 'jsonb' (contact.custom_fields)
  is_base boolean not null default false,   -- true = champ Klientys prédéfini (désactivable, jamais supprimable)
  enabled boolean not null default true,
  required boolean not null default false,
  position int not null default 0,
  options jsonb,                   -- pour field_type='select'
  created_at timestamptz not null default now()
);
create unique index if not exists idx_contact_field_def_tenant_key on contact_field_def (tenant_id, field_key);
create index if not exists idx_contact_field_def_tenant_position on contact_field_def (tenant_id, position);

alter table contact rename column contact_details to custom_fields;

update contact set custom_fields =
  (custom_fields - 'address' - 'urls') ||
  coalesce(custom_fields->'address', '{}'::jsonb) ||
  coalesce(custom_fields->'urls', '{}'::jsonb)
where custom_fields ? 'address' or custom_fields ? 'urls';
