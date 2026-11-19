-- 088 — Prospects SIRENE : coordonnées retrouvées et courriers (suite de 086).
--
-- SIRENE ne fournit ni téléphone ni email. Ces colonnes portent les coordonnées
-- professionnelles retrouvées sur le web (services/prospect_contacts.py), avec leur
-- source : la CNIL exige de pouvoir dire d'où vient une donnée (art. 14 RGPD).
-- Le modèle de courrier vit dans system_config (clé « prospect_letter »).

alter table prospect_company add column if not exists contact_phone         text;
alter table prospect_company add column if not exists contact_email         text;
alter table prospect_company add column if not exists contact_website       text;
alter table prospect_company add column if not exists contact_source        text;      -- page où la donnée a été lue
alter table prospect_company add column if not exists contact_verified      boolean not null default false;
alter table prospect_company add column if not exists contact_lookup_count  integer not null default 0;
alter table prospect_company add column if not exists contact_checked_at    timestamptz;
alter table prospect_company add column if not exists contact_next_check_at timestamptz;
alter table prospect_company add column if not exists contacted_via         text;      -- courrier | email | telephone | visite
alter table prospect_company add column if not exists letter_generated_at   timestamptz;

-- Recherche différée : fiches sans coordonnées dont la prochaine vérification est due.
create index if not exists prospect_company_lookup_idx
  on prospect_company (contact_next_check_at)
  where contact_phone is null and contact_email is null and contact_website is null;
