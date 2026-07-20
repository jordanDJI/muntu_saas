-- Migration 052 : Fonction RPC pgvector pour la recherche RAG Agent 2
-- Prérequis : extension vector active (migration 050)

CREATE OR REPLACE FUNCTION match_agent_documents(
  query_embedding vector(768),
  match_tenant_id uuid,
  match_agent_type text DEFAULT 'support_client',
  match_count int DEFAULT 3,
  min_similarity float DEFAULT 0.4
)
RETURNS TABLE (id uuid, content text, filename text, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    content,
    filename,
    1 - (embedding <=> query_embedding) AS similarity
  FROM agent_document
  WHERE tenant_id = match_tenant_id
    AND agent_type = match_agent_type
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > min_similarity
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
