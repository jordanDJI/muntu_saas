-- 087 — Partage des articles du blog sur la page LinkedIn de Klientys (KLT-1521).
--
-- Après application, variables d'environnement backend (app LinkedIn
-- « Klientys Publisher », id 266675869 — PAS l'app de connexion linkedin_oidc) :
--   LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_ORGANIZATION_ID
-- et URL de redirection déclarée dans l'onglet Auth de l'app :
--   {APP_URL}/api/v1/admin/linkedin/callback

-- Connexion unique (la page de Klientys) : une seule ligne, id = 1.
-- Les jetons sont chiffrés par l'application (core/crypto.py, préfixe enc:v1:).
create table if not exists linkedin_connection (
  id                  smallint primary key default 1 check (id = 1),
  organization_id     text not null,
  access_token        text not null,
  expires_at          timestamptz not null,
  refresh_token       text,
  refresh_expires_at  timestamptz,
  scopes              text,
  connected_by_email  text,
  connected_at        timestamptz not null default now(),
  expiry_notified_at  timestamptz
);
alter table linkedin_connection enable row level security;

-- Un article n'est partagé qu'une fois : l'URN du post LinkedIn le garantit.
alter table blog_post add column if not exists linkedin_post_urn text;
alter table blog_post add column if not exists linkedin_shared_at timestamptz;
