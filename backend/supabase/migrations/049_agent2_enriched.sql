-- Migration 049 : Agent 2 enrichi — base de connaissance métier, persona, devis, mémoire, escalade

-- ── Nouveaux champs agent_config ─────────────────────────────────────────────
ALTER TABLE agent_config
  ADD COLUMN IF NOT EXISTS persona_name        TEXT,
  ADD COLUMN IF NOT EXISTS persona_tone        TEXT        DEFAULT 'friendly',
  ADD COLUMN IF NOT EXISTS knowledge_base      TEXT,
  ADD COLUMN IF NOT EXISTS faq_pairs           JSONB       DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS quote_enabled       BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS quote_variables     JSONB       DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS escalation_triggers TEXT[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS urgent_keywords     TEXT[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS memory_enabled      BOOLEAN     DEFAULT true;

-- ── Mémoire contact (résumé inter-sessions de l'Agent 2) ─────────────────────
ALTER TABLE contact
  ADD COLUMN IF NOT EXISTS agent_memory TEXT;

COMMENT ON COLUMN agent_config.persona_name        IS 'Nom de l''assistant IA affiché aux clients (ex: Julie)';
COMMENT ON COLUMN agent_config.persona_tone        IS 'Ton de l''agent : friendly | formal | technical';
COMMENT ON COLUMN agent_config.knowledge_base      IS 'Base de connaissance métier libre (tarifs, matériaux, FAQ…)';
COMMENT ON COLUMN agent_config.faq_pairs           IS '[{"q":"…","a":"…"}] — paires FAQ configurées manuellement';
COMMENT ON COLUMN agent_config.quote_enabled       IS 'Permet à l''agent de fournir des devis indicatifs';
COMMENT ON COLUMN agent_config.quote_variables     IS '[{"name":"surface_m2","label":"Surface en m²","type":"number"}]';
COMMENT ON COLUMN agent_config.escalation_triggers IS 'Mots-clés déclenchant une escalade immédiate vers le professionnel';
COMMENT ON COLUMN agent_config.urgent_keywords     IS 'Mots-clés d''urgence (fuite, court-circuit…) → réponse prioritaire';
COMMENT ON COLUMN agent_config.memory_enabled      IS 'Active la mémoire inter-sessions par contact';
COMMENT ON COLUMN contact.agent_memory             IS 'Résumé auto-généré des conversations Agent 2 passées avec ce contact';

-- Note : la table agent_document et l'extension pgvector (RAG Wave 3)
-- sont dans la migration 050_rag_foundation.sql — à exécuter séparément
-- après activation de l'extension vector dans le dashboard Supabase.
