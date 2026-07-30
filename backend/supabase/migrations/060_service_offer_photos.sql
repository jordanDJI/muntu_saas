-- Migration 060 : photos multiples par prestation
-- Ajoute un tableau d'URLs de photos à service_offer.
-- image_url (existant) reste pour rétrocompatibilité — considéré comme photos[0] si photos est vide.

alter table service_offer
  add column if not exists photos text[] default '{}';

comment on column service_offer.photos is
  'URLs des photos de la prestation (max 3 Essentiel, 9 Pro/Business). image_url reste en fallback.';
