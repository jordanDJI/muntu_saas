-- ============================================================
-- Migration 061 — Blog multilingue (fr par défaut + en/de/nl)
-- ============================================================
-- URL : fr = /blog/{slug} (défaut, pas de préfixe)
--       en/de/nl = /blog/{lang}/{slug}
-- translation_group_id relie les versions linguistiques d'un même article
-- (pour les balises hreflang et le bouton "Traduire" dans /admin/content).

ALTER TABLE blog_post
  ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS translation_group_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS translated_from uuid REFERENCES blog_post(id) ON DELETE SET NULL;

-- L'unicité du slug doit être par langue, pas globale (même slug possible dans 2 langues)
ALTER TABLE blog_post DROP CONSTRAINT IF EXISTS blog_post_slug_key;
ALTER TABLE blog_post ADD CONSTRAINT blog_post_slug_lang_key UNIQUE (slug, lang);

CREATE INDEX IF NOT EXISTS blog_post_translation_group_idx ON blog_post (translation_group_id);
CREATE INDEX IF NOT EXISTS blog_post_lang_idx ON blog_post (lang);

COMMENT ON COLUMN blog_post.lang IS 'fr (défaut, URL /blog/slug) | en | de | nl (URL /blog/{lang}/slug)';
COMMENT ON COLUMN blog_post.translation_group_id IS 'Relie les versions linguistiques d''un même article (hreflang + bouton Traduire)';
COMMENT ON COLUMN blog_post.translated_from IS 'FK vers l''article FR source si cette ligne est une traduction générée';
