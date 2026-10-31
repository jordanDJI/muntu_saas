-- Intégrations des widgets Klientys sur des supports externes (site du client,
-- page Notion, lien en bio Instagram…).
--
-- Une intégration = un support nommé par le tenant. Son identifiant public
-- (`key`, ex. int_3f9a1c0b7e24) figure dans le code collé sur le support :
-- chaque lead et chaque RDV arrivé par ce code est rattaché à l'intégration,
-- ce qui permet de mesurer les demandes par support.
--
-- La désactivation est appliquée côté serveur : on ne peut pas savoir si le
-- code a été retiré du site du client, donc une intégration désactivée voit
-- ses widgets masqués et ses envois refusés, même si le code est toujours là.

CREATE TABLE IF NOT EXISTS site_integration (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  key              text NOT NULL UNIQUE,
  name             text NOT NULL,
  -- website : loader embed.js + divs · iframe : balise <iframe> seule
  -- (Notion, Carrd…) · link : URL à partager (bio Instagram, fiche Google)
  kind             text NOT NULL DEFAULT 'website' CHECK (kind IN ('website', 'iframe', 'link')),
  status           text NOT NULL DEFAULT 'active'  CHECK (status IN ('active', 'disabled')),
  -- manual : désactivée par le tenant · custom_domain : désactivée
  -- automatiquement quand son domaine est passé sur Klientys
  disabled_reason  text CHECK (disabled_reason IN ('manual', 'custom_domain')),
  disabled_at      timestamptz,
  -- true : créée automatiquement à la première visite d'un ancien code sans
  -- identifiant (nommée d'après le domaine, renommable)
  auto_created     boolean NOT NULL DEFAULT false,
  -- Domaine d'origine d'une intégration auto-créée. L'unicité (tenant, domaine)
  -- absorbe la course des widgets d'une même page (chatbot + contact + book)
  -- qui se chargent ensemble : sans elle, chacun créait sa propre intégration.
  auto_domain      text,
  last_seen_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_integration_auto_domain_key UNIQUE (tenant_id, auto_domain)
);

CREATE INDEX IF NOT EXISTS site_integration_tenant_idx ON site_integration (tenant_id);

-- Domaines sur lesquels les widgets d'une intégration ont été vus. Un même
-- code collé sur deux sites apparaît ici deux fois : l'interface le signale.
CREATE TABLE IF NOT EXISTS site_integration_domain (
  integration_id   uuid NOT NULL REFERENCES site_integration(id) ON DELETE CASCADE,
  -- hôte normalisé : minuscules, sans port ni « www. »
  domain           text NOT NULL,
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (integration_id, domain)
);

CREATE INDEX IF NOT EXISTS site_integration_domain_domain_idx ON site_integration_domain (domain);

-- Attribution. ON DELETE SET NULL : supprimer une intégration ne doit jamais
-- emporter les demandes reçues.
ALTER TABLE lead        ADD COLUMN IF NOT EXISTS integration_id uuid REFERENCES site_integration(id) ON DELETE SET NULL;
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS integration_id uuid REFERENCES site_integration(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS lead_integration_idx        ON lead (integration_id)        WHERE integration_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS appointment_integration_idx ON appointment (integration_id) WHERE integration_id IS NOT NULL;

-- Aucune policy : seul le backend (service role) y accède.
ALTER TABLE site_integration        ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_integration_domain ENABLE ROW LEVEL SECURITY;
