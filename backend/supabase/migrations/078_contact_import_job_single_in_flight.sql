-- Un seul import CSV/Excel "processing" à la fois par tenant.
--
-- Le quota de contacts (contact_limits.get_contact_quota) est recalculé une fois
-- par job, pas verrouillé en base : plusieurs imports lancés en parallèle (ou un
-- double-clic) peuvent chacun lire le même compte avant qu'aucun n'ait inséré,
-- et dépasser ensemble le plafond de tolérance (150% du plan). Le contrôle
-- applicatif (contacts.py, avant insertion du job) ferme la fenêtre dans le cas
-- courant mais reste lui-même sujet à une course ; cet index la ferme pour de bon.
create unique index if not exists idx_contact_import_job_one_processing
  on contact_import_job (tenant_id)
  where status = 'processing';
