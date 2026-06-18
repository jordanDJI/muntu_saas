-- 046_member_permissions.sql
-- Permissions granulaires par membre (admin/member uniquement)
-- owner et admin ignorent ce champ (accès complet)

ALTER TABLE membership
  ADD COLUMN IF NOT EXISTS permissions text[] NOT NULL DEFAULT ARRAY['crm','calendar','site_builder','analytics','agents'];

COMMENT ON COLUMN membership.permissions IS
  'Sections accessibles pour les membres de rôle "member". Ignoré pour owner et admin. Valeurs: crm, calendar, site_builder, analytics, agents';

-- Stocker les permissions dans l'invitation aussi (pour les transférer lors de l'acceptation)
ALTER TABLE team_invite
  ADD COLUMN IF NOT EXISTS permissions text[] NOT NULL DEFAULT ARRAY['crm','calendar','site_builder','analytics','agents'];
