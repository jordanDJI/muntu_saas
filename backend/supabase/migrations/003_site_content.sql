-- ============================================================
-- Migration 003 — Contenu enrichi du site vitrine
-- ============================================================

ALTER TABLE site
    ADD COLUMN IF NOT EXISTS tagline        VARCHAR(300),
    ADD COLUMN IF NOT EXISTS description    TEXT,
    ADD COLUMN IF NOT EXISTS phone          VARCHAR(50),
    ADD COLUMN IF NOT EXISTS email_contact  VARCHAR(255),
    ADD COLUMN IF NOT EXISTS address        TEXT,
    ADD COLUMN IF NOT EXISTS coverage_zones JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS values_list    JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS social_links   JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS site_style     JSONB DEFAULT '{}'::jsonb;

-- site_style structure :
-- {
--   "logo_option":    "has_logo" | "needs_creation" | "text_only",
--   "primary_color":  "indigo" | "blue" | "green" | "red" | "purple" | "slate",
--   "font_style":     "modern" | "classic" | "handwritten",
--   "pages_enabled":  ["home", "about", "services", "contact"],
--   "photos_option":  "has_photos" | "needs_stock"
-- }

-- ============================================================
-- TESTIMONIALS
-- ============================================================

CREATE TABLE IF NOT EXISTS testimonial (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id     UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    author_name VARCHAR(150) NOT NULL,
    author_role VARCHAR(150),
    content     TEXT NOT NULL,
    rating      SMALLINT DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testimonial_site ON testimonial(site_id);

ALTER TABLE testimonial ENABLE ROW LEVEL SECURITY;

-- Lecture publique : la page vitrine utilise la clé anon, elle doit pouvoir lire.
-- Écriture : uniquement via le client admin (service_role) côté backend → bypass RLS, aucune policy nécessaire.
CREATE POLICY testimonial_public_read ON testimonial
    FOR SELECT USING (true);
