-- Ajoute un label lisible pour les métiers personnalisés dans l'annuaire
alter table directory_listing add column if not exists metier_label text;
