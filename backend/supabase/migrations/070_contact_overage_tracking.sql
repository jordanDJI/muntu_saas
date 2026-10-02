-- Tolérance de dépassement du quota de contacts (150% du plan) + suivi du dépassement
-- pour l'avertissement tenant/admin (3 mois), sans action automatique après ce délai.

alter table tenant
  add column if not exists contact_overage_since timestamptz;

-- Message informatif sur un job d'import (ex: import partiel pour cause de quota),
-- distinct de error_message qui reste réservé aux échecs techniques.
alter table contact_import_job
  add column if not exists notice text;
