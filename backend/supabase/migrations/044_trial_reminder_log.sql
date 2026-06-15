-- Évite les doublons de rappels trial (un email par seuil par tenant)
CREATE TABLE IF NOT EXISTS trial_reminder_log (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    days_before int         NOT NULL,
    sent_at     timestamptz DEFAULT now(),
    UNIQUE (tenant_id, days_before)
);
