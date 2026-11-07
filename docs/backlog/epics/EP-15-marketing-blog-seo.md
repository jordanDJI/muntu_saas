# EP-15 · Site marketing, blog & SEO

**Objectif** : acquérir des pros sans budget publicitaire : une landing qui convertit, un blog multilingue alimenté en partie automatiquement, et une indexation rapide par Google, Bing et les moteurs IA.

**Périmètre code** : `frontend/app/page.tsx` (landing), `frontend/app/blog/` (`[...slug]`, `_articles.ts`, articles statiques), `frontend/app/site-internet-pour/[metier]`, `frontend/app/legal/` (cgu, dpa, mentions, privacy, sous-traitants), `frontend/app/sitemap.ts`, `robots.ts`, `llms.txt/route.ts`, `frontend/app/api/` (`og`, `revalidate`, `blog-markdown`), `backend/app/api/v1/admin.py` (`/admin/content/*`), `content.py`, `backend/app/services/google_indexing.py`, `revalidate.py`, `html_sanitize.py`, migrations `055_content`, `061_blog_i18n`, `079_content_rls`

**Personas** : Prospect (visiteur), Opérateur, Agent de contenu automatisé

---

## User stories

### US-15.01 · Comprendre l'offre et démarrer un essai depuis la landing
**Statut** : ✅ Livré · **Persona** : Prospect

> En tant que **pro qui découvre Klientys**, je veux comprendre l'offre, les prix et voir des témoignages afin de décider de tester.

**Critères d'acceptation**
- Hero, témoignages (dynamiques, `landing_testimonial`), pricing 3 plans, trust bar, FAQ, footer légal.
- Chiffres réels issus de la base (repli « 500+ » en cas d'échec).
- Menu mobile plein écran, CTA collant sous 900 px.
- Tracking landing (consentement préalable).

**Tickets** : KLT-1501, KLT-1510, KLT-1511

### US-15.02 · Lire le blog dans ma langue
**Statut** : ✅ Livré · **Persona** : Prospect

> En tant que **prospect néerlandophone**, je veux lire les articles en néerlandais afin de m'informer dans ma langue.

**Critères d'acceptation**
- `/blog/{slug}` (fr) et `/blog/{lang}/{slug}` (en, de, nl) via le catch-all `[...slug]`.
- hreflang entre versions (`translation_group_id`).
- **Les listes par langue (`/blog/en`, `/blog/de`, `/blog/nl`) n'existent pas encore (404).**

**Tickets** : KLT-1520

### US-15.03 · Gérer les articles et témoignages (opérateur)
**Statut** : ✅ Livré · **Persona** : Opérateur

> En tant qu'**opérateur**, je veux créer, relire et publier des articles et des témoignages afin d'alimenter le site marketing sans déployer.

**Critères d'acceptation**
- `/admin/content` : CRUD `blog_post` (draft / published) et `landing_testimonial`.
- `published_at` automatique à la publication.
- `body_html` nettoyé (bleach) à chaque écriture.

**Tickets** : KLT-1503, KLT-1505, KLT-1508

### US-15.04 · Proposer des articles automatiquement (agent de contenu)
**Statut** : ✅ Livré · **Persona** : Agent automatisé, Opérateur

> En tant qu'**opérateur**, je veux qu'un agent planifié rédige des brouillons afin de publier régulièrement sans écrire chaque article.

**Critères d'acceptation**
- `POST /admin/content/blog/propose` (secret `X-Content-Agent-Secret`, `hmac.compare_digest`, limitation de débit) : toujours `draft`, jamais publié directement.
- `GET /admin/content/blog/agent-list` : ce qui existe déjà, sans état persistant côté agent.
- Uniquement en français.

**Tickets** : KLT-1504, KLT-1512

### US-15.05 · Traduire un article publié
**Statut** : ✅ Livré · **Persona** : Opérateur

> En tant qu'**opérateur**, je veux traduire un article français publié en un clic afin de toucher les marchés BE et DE.

**Critères d'acceptation**
- Bouton « 🌐 Traduire » sur un article `fr` publié → `POST /admin/content/blog/{id}/translate` (Gemini `gemini-2.5-flash`).
- Une ligne par langue en `draft`, à relire et publier séparément ; HTML et liens conservés.
- Retour `{ created, skipped, failed }`, 502 si tout échoue.

### US-15.06 · Être indexé vite et proprement
**Statut** : ✅ Livré · **Persona** : Opérateur

> En tant qu'**opérateur**, je veux que chaque publication soit signalée aux moteurs et visible immédiatement afin de ne pas attendre des jours l'indexation.

**Critères d'acceptation**
- Google Indexing API à la publication / suppression ; dépublication ou changement de slug → `notify_url_deleted` sur l'ancienne URL + revalidation des versions sœurs.
- Revalidation à la demande (`REVALIDATE_SECRET`).
- Sitemap dynamique (blog toutes langues, annuaire, sites publiés hors `noindex`) ; Bing ; `robots.ts`.
- `llms.txt` pour les moteurs IA ; images OG générées (`/api/og`).

**Tickets** : KLT-1502, KLT-1506, KLT-1507

### US-15.07 · Trouver une page dédiée à mon métier
**Statut** : ✅ Livré · **Persona** : Prospect

> En tant qu'**infirmière** qui cherche « site internet infirmière », je veux une page qui parle de mon métier afin de me sentir concernée.

**Critères d'acceptation**
- `/site-internet-pour/{metier}` : pages par métier.

### US-15.08 · Consulter les documents légaux
**Statut** : ✅ Livré · **Persona** : Prospect, Pro

> En tant que **client B2B**, je veux lire les CGU, la politique de confidentialité, le DPA et la liste des sous-traitants afin de valider Klientys juridiquement.

**Critères d'acceptation**
- `/legal/cgu`, `/legal/privacy`, `/legal/mentions`, `/legal/dpa`, `/legal/sous-traitants`.
- Éditeur correctement identifié (ADUMIS, SIREN) ; la personne physique n'apparaît qu'aux mentions légales.

**Tickets** : KLT-1509

### US-15.09 · Partager les articles sur la page LinkedIn de Klientys
**Statut** : ⬜ À faire · **Persona** : Opérateur

> En tant qu'**opérateur**, je veux qu'un article publié puisse être partagé sur la page LinkedIn de Klientys afin de diffuser le contenu sans copier-coller.

**Critères d'acceptation**
- Publication sur la **page** entreprise (pas le profil personnel) via la Community Management API.
- Déclenchement manuel depuis `/admin/content` (pas automatique au début).

**Tickets** : KLT-1521

---

## Tickets

### KLT-1501 · Slug avec année et chiffres codés en dur
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-15.01 · **Réf.** : `a07a49d` (2026-06-01)

**Correction** — Nouveau slug sans année (redirection 301 de l'ancien), titre dynamique, chiffres « 500+ » lus en base avec repli.

### KLT-1502 · Sitemap incomplet
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-15.06 · **Réf.** : `0965479` (2026-05-27), `e4d7f2b`

**Correction** — Pages annuaire générées, dédoublonnées ; blog multilingue via `GET /public/blog-all-langs`.

### KLT-1503 · XSS stockée dans les articles de blog
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-15.03 · **Réf.** : `5571b58` (2026-10-11)

**Problème** — `body_html` était rendu par `dangerouslySetInnerHTML` sans aucun nettoyage, y compris dans la prévisualisation admin — donc dans la session du super admin, avant publication. Un brouillon proposé par l'agent (secret partagé) pouvait suffire.

**Correction** — `bleach` à chaque écriture (propose, création, modification, traduction). Voir KLT-1420 pour le JSON-LD.

### KLT-1504 · Secret de l'agent de contenu comparé en temps non constant
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-15.04 · **Réf.** : `5571b58`

**Correction** — `hmac.compare_digest` + limitation de débit sur les deux endpoints.

### KLT-1505 · Articles sans date affichés en tête du blog
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-15.03 · **Réf.** : `_resolve_published_at`

**Cause** — `ORDER BY published_at DESC` place les `NULL` en premier : traductions et propositions de l'agent passaient devant.

**Correction** — Date saisie, sinon date existante, sinon aujourd'hui.

### KLT-1506 · « Article introuvable » servi jusqu'à 1 h après publication
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-15.06 · **Réf.** : `app/api/revalidate/route.ts`

**Cause** — Une URL visitée avant publication restait en cache (`revalidate: 3600`).

**Correction** — Revalidation à la demande à chaque création, modification ou suppression.

### KLT-1507 · Ancienne URL laissée indexée après dépublication ou changement de slug
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-15.06 · **Réf.** : `admin.py` (content)

**Correction** — `notify_url_deleted` sur l'ancienne URL, revalidation de celle-ci et des versions sœurs.

### KLT-1508 · Tables de contenu sans RLS
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-15.03 · **Réf.** : migration `079_content_rls.sql`

**Correction** — RLS activée sans policy sur `blog_post` et `landing_testimonial` (backend uniquement).

### KLT-1509 · Identité de l'éditeur inexacte
**Type** : Conformité · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-15.08 · **Réf.** : `60fb34b` (2026-10-13)

**Correction** — Éditeur corrigé ; publication du DPA et de la liste des sous-traitants.

### KLT-1510 · Décalage de mise en page (CLS) dû au logo
**Type** : Performance · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-15.01 · **Réf.** : `e4d7f2b`

**Correction** — `next/image` avec `priority` et dimensions ; compression, AVIF / WebP, cache 24 h.

### KLT-1511 · FAQ qui se refermait toute seule
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-15.01 · **Réf.** : CLAUDE.md « Landing page »

**Cause** — Conflit entre l'IntersectionObserver (`data-r`) et la classe `open` gérée par React sur le même élément.

**Correction** — `data-r` sur un wrapper parent.

### KLT-1512 · Agent de contenu planifié : mise au point
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-15.04 · **Réf.** : `c70dc25` → `bb336d5` (5 commits, 2026-08-12 → 13)

**Contenu** — Cron de proposition d'articles et endpoint de liste des articles existants.

### KLT-1520 · Pages de liste du blog par langue
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-15.02 · **Réf.** : non commité (2026-11-03) · `frontend/app/blog/[...slug]/page.tsx`, CLAUDE.md « Blog marketing »

**Réalisation** — `/blog/en|de|nl` servis par la route catch-all (`BlogLangIndex.tsx`), hreflang entre listes, entrées de sitemap, slugs `en`/`de`/`nl` refusés à la création d'un article.

**Constat** — `/blog/en`, `/blog/de`, `/blog/nl` renvoient 404 : les articles traduits ne sont accessibles que par lien direct ou par le sitemap, sans page d'entrée, et le sélecteur de langue du blog n'a nulle part où envoyer.

**Proposition** — Dans le catch-all : 1 segment ∈ `{en, de, nl}` → liste des articles publiés de cette langue (avant le cas « slug fr ») ; hreflang entre les listes ; entrée dans le sitemap.

**Critères de validation** — `/blog/nl` liste les articles `nl` publiés ; un article fr dont le slug vaut « en » reste accessible (ou ce slug est interdit à la création).

**Estimation** — S

### KLT-1521 · Publication des articles sur la page LinkedIn
**Type** : Amélioration · **Statut** : ⬜ À faire · **Priorité** : P3 · **US** : US-15.09 · **Réf.** : mémoire projet « Partage blog → page LinkedIn »

**En attente** — Demande d'accès à la Community Management API envoyée ; le développement attend la réponse de LinkedIn (décision du 3 novembre 2026).

**Constat** — L'accès à la Community Management API a été demandé ; un formulaire doit être rempli **avant le 21 novembre 2026**. Aucun code n'existe encore.

**Proposition**
1. Compléter le formulaire LinkedIn avant l'échéance.
2. Une fois l'accès obtenu : OAuth administrateur de la page, stockage du token (chiffré, KLT-1820), bouton « Partager sur LinkedIn » sur un article publié (titre, description, image OG, lien).

**Critères de validation** — Un article de test apparaît sur la page Klientys avec son aperçu.

**Estimation** — M

### KLT-1523 · Supprimer l'article statique « …-2025 » devenu inaccessible
**Type** : Dette technique · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-15.01 · **Réf.** : non commité (2026-11-03) · `frontend/app/blog/cout-site-internet-independant-2025/page.tsx`, `frontend/next.config.ts:4-11`

**Réalisation** — Page supprimée, deux liens internes redirigés vers le nouvel article, redirection 301 conservée.

**Constat** — `next.config.ts` redirige `/blog/cout-site-internet-independant-:year` en 301 vers le slug sans année : la page `-2025` n'est plus jamais servie, mais reste dans le code et porte encore son propre `canonical`.

**Proposition** — Supprimer le dossier ; vérifier qu'aucun lien interne ni `_articles.ts` ne le référence ; garder la redirection.

**Critères de validation** — Le build passe, `/blog/cout-site-internet-independant-2025` répond toujours 308 / 301 vers le nouvel article.

**Estimation** — XS
