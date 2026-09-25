-- Champs de fiche contact enrichis (civilité, adresse structurée, réseaux, catégorisation)
-- contact_details : JSONB à clés connues, sur le modèle de site.site_style — voir CLAUDE.md.

alter table contact
  add column if not exists contact_details jsonb not null default '{}'::jsonb,
  add column if not exists category text,
  add column if not exists segment text;

create index if not exists idx_contact_category on contact (tenant_id, category);
