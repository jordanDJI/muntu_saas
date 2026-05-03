-- Migration 010 — Tables conversation et message
-- Utilisées par : Agent 2 (WhatsApp client), Agent 3 (assistant dashboard), Worker 4 (synthèse cron)

CREATE TABLE conversation (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    contact_id  UUID REFERENCES contact(id) ON DELETE SET NULL,
    agent_type  VARCHAR(50) NOT NULL,
    channel     VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
    metadata    JSONB NOT NULL DEFAULT '{}',
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at    TIMESTAMPTZ,
    deleted_at  TIMESTAMPTZ
);

CREATE TABLE message (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
    sender_type     VARCHAR(20) NOT NULL,   -- 'user' | 'assistant' | 'system'
    content         TEXT NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversation_tenant  ON conversation(tenant_id);
CREATE INDEX idx_conversation_contact ON conversation(contact_id);
CREATE INDEX idx_conversation_started ON conversation(started_at);
CREATE INDEX idx_message_conversation ON message(conversation_id);
CREATE INDEX idx_message_sent_at      ON message(sent_at);

ALTER TABLE conversation ENABLE ROW LEVEL SECURITY;
ALTER TABLE message      ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversation_tenant_isolation ON conversation
    USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY message_tenant_isolation ON message
    USING (
        EXISTS (
            SELECT 1 FROM conversation c
            WHERE c.id = message.conversation_id
              AND c.tenant_id = current_setting('app.tenant_id')::UUID
        )
    );
