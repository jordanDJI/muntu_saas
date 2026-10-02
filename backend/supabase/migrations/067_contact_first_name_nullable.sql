-- Même situation que last_name (migration 065) : contrainte NOT NULL posée hors migration,
-- incompatible avec les imports où un contact n'a que téléphone/email/nom de famille.

alter table contact
  alter column first_name drop not null;
