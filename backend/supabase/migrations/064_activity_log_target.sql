-- Rattachement de activity_log à un enregistrement précis (ex. un contact) pour permettre
-- un journal des modifications filtrable par fiche, en plus du flux tenant global existant.
-- Nullable et non-breaking pour les appels existants à log_activity() sans target.

alter table activity_log
  add column if not exists target_type text,
  add column if not exists target_id uuid;

create index if not exists idx_activity_log_target on activity_log (target_type, target_id, created_at desc);
