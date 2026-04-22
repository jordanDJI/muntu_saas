-- ============================================================
-- Migration 002 — Agents IA
-- SaaS Présence Digitale
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM
-- ============================================================

CREATE TYPE agent_type_enum AS ENUM (
    'vitrine',           -- Agent 1 : chatbot public sur le site vitrine
    'support_client',    -- Agent 2 : support WhatsApp client converti
    'assistant_tenant'   -- Agent 3 : assistant opérationnel du professionnel
);

-- ============================================================
-- agent_config
-- Configuration d'un agent IA par tenant (1 ligne par type d'agent)
-- ============================================================

CREATE TABLE agent_config (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    agent_type                  agent_type_enum NOT NULL,
    status                      VARCHAR(30) NOT NULL DEFAULT 'active',
    model                       VARCHAR(100) NOT NULL DEFAULT 'gemini-2.0-flash',
    system_prompt               TEXT,
    synthesis_schedule_minutes  INTEGER NOT NULL DEFAULT 180,
    created_at                  TIMESTAMP DEFAULT NOW(),
    updated_at                  TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_agent_config UNIQUE (tenant_id, agent_type)
);

CREATE INDEX idx_agent_config_tenant ON agent_config(tenant_id);

-- ============================================================
-- agent_link
-- Token JWT signé remis au client converti pour accès Agent 2
-- ============================================================

CREATE TABLE agent_link (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    contact_id  UUID NOT NULL REFERENCES contact(id) ON DELETE CASCADE,
    token       VARCHAR(512) NOT NULL,
    channel     VARCHAR(30) NOT NULL DEFAULT 'whatsapp',
    expires_at  TIMESTAMP NOT NULL,
    used_at     TIMESTAMP,
    created_at  TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_agent_link_token UNIQUE (token)
);

CREATE INDEX idx_agent_link_contact ON agent_link(contact_id);
CREATE INDEX idx_agent_link_token   ON agent_link(token);
CREATE INDEX idx_agent_link_tenant  ON agent_link(tenant_id);

-- ============================================================
-- ocr_summary
-- Résumé chiffré extrait par OCR — le document original n'est jamais persisté
-- Données de santé Article 9 RGPD → summary_encrypted via pgcrypto
-- ============================================================

CREATE TABLE ocr_summary (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    contact_id          UUID NOT NULL REFERENCES contact(id) ON DELETE CASCADE,
    appointment_id      UUID REFERENCES appointment(id),
    summary_encrypted   TEXT NOT NULL,
    document_type       VARCHAR(100),
    processed_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ocr_summary_contact     ON ocr_summary(contact_id);
CREATE INDEX idx_ocr_summary_appointment ON ocr_summary(appointment_id);
CREATE INDEX idx_ocr_summary_tenant      ON ocr_summary(tenant_id);

-- ============================================================
-- agent_synthesis
-- Résumés consolidés produits par le Worker 4 (cron configurable)
-- ============================================================

CREATE TABLE agent_synthesis (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id        UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    agent_config_id  UUID NOT NULL REFERENCES agent_config(id),
    content          TEXT NOT NULL,
    period_start     TIMESTAMP NOT NULL,
    period_end       TIMESTAMP NOT NULL,
    delivered_at     TIMESTAMP,
    created_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agent_synthesis_tenant ON agent_synthesis(tenant_id);
CREATE INDEX idx_agent_synthesis_period ON agent_synthesis(period_start, period_end);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE agent_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_link      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_summary     ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_synthesis ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_config_tenant_isolation ON agent_config
    USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY agent_link_tenant_isolation ON agent_link
    USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY ocr_summary_tenant_isolation ON ocr_summary
    USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY agent_synthesis_tenant_isolation ON agent_synthesis
    USING (tenant_id = current_setting('app.tenant_id')::UUID);
