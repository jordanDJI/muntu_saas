-- ============================================================
-- Migration 026 — Enable RLS on platform tables
-- Fixes Supabase security advisor warnings
-- ============================================================

-- plan_subscription: platform reference data (pricing plans)
-- Read-only for everyone; write access only via service role (backend)
ALTER TABLE plan_subscription ENABLE ROW LEVEL SECURITY;

CREATE POLICY plan_subscription_read_all ON plan_subscription
    FOR SELECT
    USING (true);

-- template: platform reference data (site templates)
-- Read-only for everyone; write access only via service role (backend)
ALTER TABLE template ENABLE ROW LEVEL SECURITY;

CREATE POLICY template_read_all ON template
    FOR SELECT
    USING (true);

-- app_user: internal user table managed exclusively by the backend via service role
-- No direct PostgREST access allowed; service role bypasses RLS
ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;