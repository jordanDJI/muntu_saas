-- La colonne last_name porte une contrainte NOT NULL posée hors migration (absente de 001_mvp_schema.sql),
-- incompatible avec des imports CSV/Excel réels (ex. exports LinkedIn) où le nom de famille manque parfois.
-- first_name/last_name/email/phone restent des champs "de base" toujours présents mais non obligatoires à la saisie.

alter table contact
  alter column last_name drop not null;
