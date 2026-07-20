-- Migration 050 : Fondations RAG (Wave 3) — pgvector + table agent_document
-- Prérequis : activer l'extension vector dans Supabase Dashboard → Extensions → vector
-- avant d'exécuter cette migration.

CREATE EXTENSION IF NOT EXISTS vector;

-- Drop et recréation propre (table vide à ce stade, aucune donnée à préserver)
DROP TABLE IF EXISTS agent_document;

CREATE TABLE agent_document (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID          NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  agent_type  TEXT          NOT NULL DEFAULT 'support_client',
  filename    TEXT,
  content     TEXT,
  embedding   VECTOR(768),
  metadata    JSONB         DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX agent_document_tenant_idx
  ON agent_document (tenant_id, agent_type);

-- Index cosinus IVFFlat (décommenter après les premiers inserts) :
-- CREATE INDEX agent_document_embedding_idx
--   ON agent_document USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE  agent_document IS 'Documents uploadés par le tenant pour le RAG de l''Agent 2';
