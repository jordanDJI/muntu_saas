-- ============================================================
-- MVP Schema — SaaS Présence Digitale
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PLATEFORME
-- ============================================================

CREATE TABLE plan_subscription (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(50) NOT NULL,
    price_eur   NUMERIC(8,2) NOT NULL,
    stripe_price_id VARCHAR(100),
    features    JSONB DEFAULT '{}',
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tenant (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(150) NOT NULL,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    plan_id     UUID REFERENCES plan_subscription(id),
    sector      VARCHAR(50),
    country     VARCHAR(10) DEFAULT 'BE',
    timezone    VARCHAR(50) DEFAULT 'Europe/Brussels',
    locale      VARCHAR(10) DEFAULT 'fr',
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE app_user (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   TEXT,
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    avatar_url      TEXT,
    last_login_at   TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE membership (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    role        VARCHAR(30) NOT NULL DEFAULT 'member',
    created_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

CREATE TABLE subscription (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    plan_id                 UUID NOT NULL REFERENCES plan_subscription(id),
    stripe_subscription_id  VARCHAR(100),
    status                  VARCHAR(30) DEFAULT 'trial',
    started_at              TIMESTAMP DEFAULT NOW(),
    expires_at              TIMESTAMP,
    UNIQUE(tenant_id)
);

-- ============================================================
-- SITE
-- ============================================================

CREATE TABLE template (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,
    sector      VARCHAR(50),
    preview_url TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE site (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id        UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    template_id      UUID REFERENCES template(id),
    title            VARCHAR(200) NOT NULL,
    audience_mode    VARCHAR(20) DEFAULT 'b2c',
    default_language VARCHAR(10) DEFAULT 'fr',
    status           VARCHAR(20) DEFAULT 'draft',
    absence_mode     BOOLEAN DEFAULT FALSE,
    absence_message  TEXT,
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE page (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id     UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    slug        VARCHAR(100) NOT NULL,
    title       VARCHAR(200),
    content     JSONB DEFAULT '{}',
    is_published BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE(site_id, slug)
);

CREATE TABLE service_offer (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id     UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    duration_min INTEGER,
    price_eur   NUMERIC(8,2),
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE service_area (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id     UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    city        VARCHAR(100),
    postal_code VARCHAR(20),
    radius_km   INTEGER,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- CRM
-- ============================================================

CREATE TABLE contact (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    email           VARCHAR(255),
    phone           VARCHAR(30),
    contact_type    VARCHAR(20) DEFAULT 'individual',
    notes           TEXT,
    deleted_at      TIMESTAMP NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE pipeline_stage (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    position    INTEGER NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, position)
);

CREATE TABLE channel (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    type        VARCHAR(30),
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE lead (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    contact_id          UUID NOT NULL REFERENCES contact(id),
    pipeline_stage_id   UUID REFERENCES pipeline_stage(id),
    service_offer_id    UUID REFERENCES service_offer(id),
    source              VARCHAR(50),
    status              VARCHAR(30) DEFAULT 'new',
    priority            VARCHAR(20) DEFAULT 'normal',
    audience_type       VARCHAR(20) DEFAULT 'b2c',
    request_type        VARCHAR(50),
    notes               TEXT,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- AGENDA
-- ============================================================

CREATE TABLE calendar (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL DEFAULT 'Principal',
    cal_com_id  VARCHAR(100),
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE appointment (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calendar_id         UUID NOT NULL REFERENCES calendar(id) ON DELETE CASCADE,
    contact_id          UUID NOT NULL REFERENCES contact(id),
    lead_id             UUID REFERENCES lead(id),
    service_offer_id    UUID REFERENCES service_offer(id),
    type                VARCHAR(50) DEFAULT 'b2c_appointment',
    audience_type       VARCHAR(20) DEFAULT 'b2c',
    status              VARCHAR(20) DEFAULT 'confirmed',
    scheduled_at        TIMESTAMP NOT NULL,
    end_at              TIMESTAMP NOT NULL,
    cal_booking_id      VARCHAR(100),
    notes               TEXT,
    created_at          TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notification (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES app_user(id),
    type        VARCHAR(50) NOT NULL,
    title       VARCHAR(200),
    body        TEXT,
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_lead_tenant_id ON lead(tenant_id);
CREATE INDEX idx_lead_status ON lead(status);
CREATE INDEX idx_contact_tenant_id ON contact(tenant_id);
CREATE INDEX idx_appointment_calendar_id ON appointment(calendar_id);
CREATE INDEX idx_appointment_scheduled_at ON appointment(scheduled_at);
CREATE INDEX idx_site_tenant_id ON site(tenant_id);
CREATE INDEX idx_membership_tenant_id ON membership(tenant_id);
CREATE INDEX idx_notification_tenant_id ON notification(tenant_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE site ENABLE ROW LEVEL SECURITY;
ALTER TABLE page ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification ENABLE ROW LEVEL SECURITY;

-- site
CREATE POLICY site_tenant_isolation ON site
    USING (tenant_id = (current_setting('app.tenant_id')::UUID));

-- page
CREATE POLICY page_tenant_isolation ON page
    USING (site_id IN (SELECT id FROM site WHERE tenant_id = current_setting('app.tenant_id')::UUID));

-- contact
CREATE POLICY contact_tenant_isolation ON contact
    USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- lead
CREATE POLICY lead_tenant_isolation ON lead
    USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- calendar
CREATE POLICY calendar_tenant_isolation ON calendar
    USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- appointment
CREATE POLICY appointment_tenant_isolation ON appointment
    USING (calendar_id IN (SELECT id FROM calendar WHERE tenant_id = current_setting('app.tenant_id')::UUID));

-- notification
CREATE POLICY notification_tenant_isolation ON notification
    USING (tenant_id = current_setting('app.tenant_id')::UUID);
