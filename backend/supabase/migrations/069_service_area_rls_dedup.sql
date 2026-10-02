-- ============================================================
-- Migration 069 — Dédupliquer les policies RLS SELECT sur service_area
-- ============================================================
-- Supabase linter : plusieurs policies permissives pour le rôle anon
-- sur SELECT (public_read_service_area, public_read_published_service_area).
-- Elles ne vivaient dans aucune migration (créées à la main dans Supabase).
--
-- public_read_service_area (USING (true)) rendait public_read_published_service_area
-- inutile : en plus du coût de perf (les deux policies sont évaluées à chaque
-- requête), la policy inconditionnelle permettait à l'anon de lire les zones
-- d'intervention de sites non publiés — exactement ce que la policy "published"
-- était censée empêcher. On garde uniquement la policy gated sur le statut publié.

DROP POLICY IF EXISTS public_read_service_area ON service_area;
