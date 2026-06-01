-- 029_sector_config.sql
-- Seed des mots-clés secteurs dans system_config (éditables via admin panel)

INSERT INTO system_config (key, value) VALUES (
  'sector_keywords',
  '{
    "health":   ["infirmière à domicile", "kinésithérapeute", "médecin généraliste"],
    "beauty":   ["coiffeur", "esthéticienne", "salon de beauté"],
    "coaching": ["coach de vie", "coaching personnel", "coach sportif"],
    "finance":  ["comptable indépendant", "conseiller financier", "expert comptable"],
    "trade":    ["plombier", "électricien", "artisan"],
    "other":    ["prestataire de service", "indépendant"]
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- Labels lisibles des secteurs (pour l'UI admin et les dropdowns)
INSERT INTO system_config (key, value) VALUES (
  'sector_labels',
  '{
    "health":   "Santé",
    "beauty":   "Beauté / Bien-être",
    "coaching": "Coaching / Conseil",
    "finance":  "Finance",
    "trade":    "Artisan / Commerce",
    "other":    "Autre"
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;
