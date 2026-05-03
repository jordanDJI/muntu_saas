-- Migration 015 — Invitations d'équipe
-- team_invite : tokens d'invitation pour les membres non encore inscrits

CREATE TABLE IF NOT EXISTS team_invite (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    email       TEXT        NOT NULL,
    role        VARCHAR(30) NOT NULL DEFAULT 'member',
    token       TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    invited_by  UUID        REFERENCES auth.users(id),
    accepted_at TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_invite_tenant_id ON team_invite(tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_invite_token     ON team_invite(token);
