-- ============================================================
-- Migration 055 — Content management (blog + landing testimonials)
-- ============================================================

-- Articles de blog
CREATE TABLE IF NOT EXISTS blog_post (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text        NOT NULL UNIQUE,
  title           text        NOT NULL,
  description     text,
  category        text,
  metier          text,
  body_html       text,
  reading_minutes int         NOT NULL DEFAULT 5,
  status          text        NOT NULL DEFAULT 'draft',  -- draft | published
  published_at    date,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Témoignages de la landing page
CREATE TABLE IF NOT EXISTS landing_testimonial (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  role        text,
  text        text        NOT NULL,
  initials    text,
  bg_color    text        NOT NULL DEFAULT 'rgba(13,75,88,.4)',
  text_color  text        NOT NULL DEFAULT 'var(--l-teal-xl)',
  sort_order  int         NOT NULL DEFAULT 0,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- Seed : métadonnées des 3 articles existants (body géré par les pages statiques)
INSERT INTO blog_post (slug, title, description, category, metier, reading_minutes, status, published_at)
VALUES
  (
    'doctolib-vs-klientys-kine-infirmier',
    'Doctolib vs Klientys : ce que les kinés et infirmiers ne savent pas',
    'Doctolib coûte 160 €/mois et vous rend invisible en dehors de votre ville principale. Voici pourquoi de plus en plus de libéraux font le switch.',
    'Comparatifs', 'Santé', 6, 'published', '2025-05-16'
  ),
  (
    'cout-site-internet-independant',
    'Combien coûte vraiment un site internet pour indépendant ?',
    'Wix, Squarespace, site sur mesure, tout-en-un : comparaison honnête des coûts réels. Avec le calcul que personne ne fait.',
    'Prix & ROI', null, 7, 'published', '2025-05-16'
  ),
  (
    'remplir-agenda-en-ligne-sans-plateforme',
    'Comment remplir son agenda en ligne sans Habitatpresto ni Superprof',
    'Ces plateformes prennent 15 à 20 % sur chaque mission. Voici comment attirer des clients directement via Google — et garder 100 % de vos revenus.',
    'Acquisition clients', 'Artisans & services', 8, 'published', '2025-05-16'
  )
ON CONFLICT (slug) DO NOTHING;

-- Seed : 3 témoignages existants de la landing page
INSERT INTO landing_testimonial (name, role, text, initials, bg_color, text_color, sort_order)
VALUES
  (
    'Josiane Yollande',
    'Infirmière libérale, Bruxelles',
    'Mes patients réservent maintenant directement en ligne. Plus d''appels le soir — mon agenda est toujours plein et je me concentre sur mes soins.',
    'JY', 'rgba(13,75,88,.4)', 'var(--l-teal-xl)', 1
  ),
  (
    'Thierry Bales',
    'Artisan BTP, Darmstadt – Allemagne',
    'Je suis sur chantier toute la journée. L''agent IA répond à mes clients pendant que je travaille. Mon taux de no-show a chuté de 40% grâce aux rappels automatiques.',
    'TB', 'rgba(170,189,216,.15)', 'var(--l-blue)', 2
  ),
  (
    'Samy Glo',
    'Esthéticienne, Paris',
    'Je n''y connaissais rien en informatique. Le wizard est tellement bien guidé que même moi j''ai réussi ! Mon agenda est plein depuis le premier mois.',
    'SG', 'rgba(221,170,64,.15)', 'var(--l-gold)', 3
  );
