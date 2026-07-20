-- Migration 055 — Support interne tenant→admin + Push subscriptions

-- ── 1. Tickets de support ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_ticket (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        REFERENCES tenant(id) ON DELETE CASCADE NOT NULL,
  subject      text        NOT NULL,
  status       text        NOT NULL DEFAULT 'open',   -- open | in_progress | resolved | closed
  priority     text        NOT NULL DEFAULT 'normal', -- low | normal | high | urgent
  created_at   timestamptz DEFAULT now() NOT NULL,
  updated_at   timestamptz DEFAULT now() NOT NULL,
  resolved_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_tenant ON support_ticket (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_ticket_status ON support_ticket (status);

-- ── 2. Messages dans un ticket ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_message (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid        REFERENCES support_ticket(id) ON DELETE CASCADE NOT NULL,
  tenant_id  uuid        REFERENCES tenant(id) ON DELETE CASCADE NOT NULL,
  sender     text        NOT NULL,  -- 'tenant' | 'admin'
  body       text        NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_msg_ticket ON support_message (ticket_id, created_at ASC);

-- ── 3. Push subscriptions — côté tenant (dashboard) ──────────────────────────
CREATE TABLE IF NOT EXISTS push_subscription (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL,  -- auth.users.id
  tenant_id    uuid        REFERENCES tenant(id) ON DELETE CASCADE NOT NULL,
  subscription jsonb       NOT NULL,  -- { endpoint, keys: { p256dh, auth } }
  created_at   timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_push_sub_tenant ON push_subscription (tenant_id);

-- ── 4. Push subscriptions — côté client (site public) ────────────────────────
CREATE TABLE IF NOT EXISTS contact_push_subscription (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   uuid        REFERENCES contact(id) ON DELETE CASCADE NOT NULL,
  tenant_id    uuid        REFERENCES tenant(id) ON DELETE CASCADE NOT NULL,
  subscription jsonb       NOT NULL,
  created_at   timestamptz DEFAULT now() NOT NULL,
  UNIQUE (contact_id)
);

CREATE INDEX IF NOT EXISTS idx_cpush_tenant   ON contact_push_subscription (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cpush_contact  ON contact_push_subscription (contact_id);

-- ── 5. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE support_ticket ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_ticket_tenant ON support_ticket FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

ALTER TABLE support_message ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_msg_tenant ON support_message FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

ALTER TABLE push_subscription ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_push_subscription ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE support_ticket
  IS 'Tickets de support ouverts par les tenants vers l''équipe Klientys';
COMMENT ON TABLE push_subscription
  IS 'Abonnements Web Push des utilisateurs du dashboard (clé VAPID)';
COMMENT ON TABLE contact_push_subscription
  IS 'Abonnements Web Push des clients depuis le site public du tenant';
