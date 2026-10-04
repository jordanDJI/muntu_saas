-- ============================================================
-- Migration 071 — Verrouiller la RLS des tables de facturation
-- ============================================================
-- Contexte : les policies de membership / subscription / design_request
-- avaient été créées à la main dans l'UI Supabase (hors migrations) en
-- `FOR ALL` sans `WITH CHECK`. En Postgres, une policy FOR ALL sans
-- WITH CHECK réutilise l'expression USING comme contrôle d'insertion :
-- les clauses ci-dessous étaient donc aussi des autorisations d'écriture.
--
-- Trois conséquences, toutes exploitables depuis le navigateur avec la
-- clé anon publique et un simple compte créé via l'onboarding :
--
--   1. membership   USING (user_id = auth.uid())
--      Le tenant_id n'étant pas contraint, un utilisateur pouvait
--      s'insérer un membership `owner` sur N'IMPORTE QUEL tenant.
--      Comme get_current_tenant() (app/middleware/tenant.py) valide
--      X-Tenant-Id sur la seule existence d'un membership, cela donnait
--      un accès applicatif complet au tenant victime (CRM, agenda,
--      config PayPal, portail Stripe). Le même ALL permettait aussi de
--      passer son propre membership à role='owner' et de réécrire
--      `permissions` — contournant tout le modèle de la migration 046.
--
--   2. subscription USING (tenant_id IN (mes memberships))
--      Un UPDATE status='active' + plan_id=<Business> suffisait à
--      s'octroyer un plan payant à vie : get_tenant_plan()
--      (app/services/subscription.py) lit cette table en service role
--      et fait confiance à status/plan_id.
--
--   3. design_request idem → contournait le garde
--      `plan_name != "Business"` de app/api/v1/design_requests.py.
--      Le `LIMIT 1` sans ORDER BY cassait par ailleurs le multi-espaces.
--
-- Et `tenant` portait `public_read_tenant FOR SELECT TO anon USING (true)`
-- → table entière lisible publiquement (UUID de tous les tenants,
-- stripe_customer_id, suspended_reason, trial_extended_until). C'est ce
-- qui fournissait la liste des cibles du point 1. Même motif que celui
-- corrigé par la migration 069 sur service_area.
--
-- Principe retenu : ces quatre tables sont écrites EXCLUSIVEMENT par le
-- backend en service role (qui ignore GRANT et RLS). Le client n'a plus
-- qu'un droit de lecture, scopé à ses propres memberships.
--
-- Vérifié avant écriture : le frontend ne fait que lire ces tables
-- (membership + subscription dans dashboard/settings et dashboard/embed),
-- et aucun module backend n'utilise le client anon.
-- ============================================================

-- ── 1. Retirer tout droit d'écriture aux rôles client ────────────────
-- TRUNCATE est volontairement inclus : il n'est JAMAIS soumis à la RLS,
-- donc le conserver laisse une porte ouverte dès qu'une RPC est ajoutée.
-- REFERENCES et TRIGGER ne servent à aucun rôle client.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON membership, subscription, design_request, tenant
  FROM anon, authenticated;

-- ── 2. Remplacer les policies FOR ALL par des policies SELECT ────────
DROP POLICY IF EXISTS membership_own      ON membership;
DROP POLICY IF EXISTS subscription_tenant ON subscription;
DROP POLICY IF EXISTS "tenant own"        ON design_request;

CREATE POLICY membership_read_own ON membership
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY subscription_read_own ON subscription
    FOR SELECT TO authenticated
    USING (tenant_id IN (
        SELECT tenant_id FROM membership WHERE user_id = auth.uid()
    ));

-- Corrige au passage le LIMIT 1 : un compte Business multi-espaces voit
-- désormais les demandes de tous ses espaces, de façon déterministe.
CREATE POLICY design_request_read_own ON design_request
    FOR SELECT TO authenticated
    USING (tenant_id IN (
        SELECT tenant_id FROM membership WHERE user_id = auth.uid()
    ));

-- ── 3. tenant : fin de la lecture publique ───────────────────────────
-- Rien dans le frontend ne lit `tenant` en anon. Les deux seuls accès
-- (dashboard/settings/page.tsx:354, dashboard/embed/page.tsx:64) sont des
-- joins imbriqués faits en `authenticated` — qui ne disposaient d'AUCUNE
-- policy (public_read_tenant étant TO anon) et renvoyaient donc null.
-- La policy ci-dessous les répare en plus de fermer la fuite.
-- Les besoins publics (slug → site, résolution de domaine custom) passent
-- déjà par le backend en service role : GET /api/v1/public/site/{slug}
-- et GET /api/v1/domains/resolve.
DROP POLICY IF EXISTS public_read_tenant ON tenant;

CREATE POLICY tenant_read_own ON tenant
    FOR SELECT TO authenticated
    USING (id IN (
        SELECT tenant_id FROM membership WHERE user_id = auth.uid()
    ));

-- ── 4. Filet de sécurité ─────────────────────────────────────────────
-- Ces tables ont été créées avant l'habitude d'activer la RLS en
-- migration ; on la réaffirme ici pour que la protection survive à un
-- `supabase db reset` ou à un redéploiement from scratch.
ALTER TABLE membership     ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription   ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant         ENABLE ROW LEVEL SECURITY;
