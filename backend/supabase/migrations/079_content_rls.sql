-- RLS sur les tables du volet Contenu (blog + témoignages landing page).
--
-- Déjà active en production (activée hors migration), mais la migration 055 qui
-- crée ces tables ne l'activait pas : un environnement reconstruit depuis les
-- migrations les laissait ouvertes en lecture ET en écriture à la clé anon, qui
-- est publique. N'importe qui pouvait alors publier un article ou modifier les
-- témoignages en contournant le backend — et donc le sanitizer HTML.
--
-- Aucune policy volontairement : seul le backend (service role) y accède, les
-- pages publiques passent par /api/v1/public/blog et /api/v1/public/testimonials.
ALTER TABLE blog_post           ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_testimonial ENABLE ROW LEVEL SECURITY;
