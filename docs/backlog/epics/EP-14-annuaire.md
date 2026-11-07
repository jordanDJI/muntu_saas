# EP-14 · Annuaire public

**Objectif** : apporter des clients aux pros et du trafic SEO à Klientys grâce à un annuaire public, multi-métiers et multi-villes, indexable par les moteurs de recherche.

**Périmètre code** : `backend/app/api/v1/directory.py`, `frontend/app/annuaire/` (hub, `[metier]/[ville]`, `[metier]/[ville]/[slug]`, `ville/[ville]`), `frontend/data/villes.json`, Paramètres → Annuaire (`SectionAnnuaire`), Admin → Config (métiers custom), migrations `023`, `027_directory_metier_label`

**Personas** : Pro, Visiteur (internaute), Opérateur

---

## User stories

### US-14.01 · Apparaître dans l'annuaire
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux publier une fiche dans l'annuaire Klientys afin d'être trouvé par des clients de ma ville.

**Critères d'acceptation**
- `POST /directory/opt-in`, `PATCH /directory/my-listing`, `DELETE /directory/opt-out` (`is_listed = false`).
- Métier standard ou « Autre (précisez) » (`custom_metier`, `metier_label`).
- Zones en autocomplete Nominatim (debounce 350 ms, `onMouseDown`, fermeture 150 ms après `onBlur`), stockées en Title Case.

**Tickets** : KLT-1401

### US-14.02 · Parcourir l'annuaire par métier
**Statut** : ✅ Livré · **Persona** : Visiteur

> En tant qu'**internaute**, je veux parcourir les métiers et les villes populaires afin de trouver un pro près de chez moi.

**Critères d'acceptation**
- Hub `/annuaire` : métiers standards, « Autres métiers » promus, villes populaires par pays (FR, BE, DE).
- Charte Klientys, `MarketingNav` + `MarketingFooter`, CTA vers `/onboarding`.

**Tickets** : KLT-1406

### US-14.03 · Trouver les pros d'un métier dans une ville
**Statut** : ✅ Livré · **Persona** : Visiteur

> En tant qu'**internaute**, je veux la liste des kinés de Rennes afin de choisir et réserver.

**Critères d'acceptation**
- `/annuaire/{metier}/{ville}` : fiches actives, `cache: "no-store"`.
- Toute ville acceptée (pas seulement `villes.json`) ; pas de 404 sur un métier ou une ville inconnus.
- Données structurées : BreadcrumbList, ItemList, FAQPage.

**Tickets** : KLT-1402, KLT-1403, KLT-1404, KLT-1405, KLT-1420

### US-14.04 · Voir tous les pros d'une ville
**Statut** : ✅ Livré · **Persona** : Visiteur

> En tant qu'**internaute**, je veux voir tous les pros d'une ville, groupés par métier, afin de découvrir l'offre locale.

**Critères d'acceptation**
- `/annuaire/ville/{ville}` ; liens « Voir tous → » par groupe ; `metier` optionnel dans `GET /directory/listings`.

**Tickets** : KLT-1408

### US-14.05 · Consulter la fiche d'un pro
**Statut** : ✅ Livré · **Persona** : Visiteur

> En tant qu'**internaute**, je veux une fiche détaillée avec un lien vers le site et la réservation afin de contacter le pro.

**Critères d'acceptation**
- `/annuaire/{metier}/{ville}/{slug}` (`GET /directory/listing/{slug}`), JSON-LD LocalBusiness.

**Tickets** : KLT-1420, KLT-1422

### US-14.06 · Faire entrer les métiers de la communauté dans l'annuaire
**Statut** : ✅ Livré · **Persona** : Opérateur, Pro

> En tant qu'**opérateur**, je veux promouvoir un métier saisi librement par les pros afin qu'il ait sa propre page dans l'annuaire.

**Critères d'acceptation**
- `GET /directory/metiers` (métiers custom distincts), promotion admin (pluriel + famille) dans `system_config.custom_metiers`, sans redéploiement.
- Le dropdown des paramètres sépare « Métiers standards » et « Ajoutés par la communauté ».
- **Les fiches `metier = "autre"` non promues n'apparaissent pas dans le hub.**

**Tickets** : KLT-1421

---

## Tickets

### KLT-1401 · Fiches introuvables à cause de la casse des zones
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-14.01 · **Réf.** : `a864dbb` (2026-05-28), `6e089ef`

**Cause** — `.contains()` sur un `text[]` est sensible à la casse : « rennes » ≠ « Rennes ».

**Correction** — Title Case à l'écriture (backend) et à la lecture (`titleCaseZone()`), requête sur `ville.title()`.

### KLT-1402 · Jointure `!inner` renvoyant une liste vide
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-14.03 · **Réf.** : `a864dbb`

**Correction** — `tenant(slug)` sans `!inner` + repli par requête séparée (`slug_map`).

### KLT-1403 · Résultats vides mis en cache avant l'opt-in
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-14.03 · **Réf.** : `a864dbb`

**Correction** — `cache: "no-store"` sur les pages annuaire.

### KLT-1404 · `villePrep` non défini dans `generateMetadata`
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-14.03 · **Réf.** : `c76925c` (2026-05-27)

**Correction** — Variable calculée dans `generateMetadata`.

### KLT-1405 · 404 sur les villes absentes de villes.json
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-14.03 · **Réf.** : `e4d7f2b`, `12febca` (2026-05-27)

**Correction** — Pages dynamiques pour toute ville et tout métier ; `villes.json` étendu à la Belgique et à l'Allemagne ; sitemap généré pour les villes inconnues, dédoublonné par `{metier, ville}`.

### KLT-1406 · Annuaire hors charte graphique
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-14.02 · **Réf.** : `e4d7f2b`

**Correction** — Indigo → teal, fond `#F4F8FA`, navigation et footer marketing, villes par pays avec drapeaux.

### KLT-1408 · Recherche par ville impossible sans métier
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-14.04 · **Réf.** : `a864dbb`

**Correction** — `metier` optionnel ; liens « Villes populaires » vers `/annuaire/ville/{slug}` au lieu d'être câblés sur `kinesitherapeute`.

### KLT-1420 · Injection de script via le JSON-LD de l'annuaire (XSS)
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-14.03, US-14.05 · **Réf.** : non commité (2026-11-03) · `frontend/app/annuaire/[metier]/[ville]/[slug]/page.tsx:99-122`, `frontend/app/annuaire/[metier]/[ville]/page.tsx:41-42, 124-125, 226`, `frontend/app/[tenant]/page.tsx:683`, `frontend/app/blog/[...slug]/page.tsx:151`

**Réalisation** — Helper `serializeJsonLd()` (`lib/jsonLd.ts`) sur les 16 balises JSON-LD, refus de `<` / `>` dans les champs courts de l'annuaire (`directory.py`). Vérifié en local : Next.js ne décode pas le segment d'URL, la variante « lien piégé » n'était donc pas exploitable, la variante stockée l'était. Test Playwright `e2e/security-regressions.spec.ts`.

**Constat** — Les données structurées sont injectées par `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(...) }} />`. `JSON.stringify` n'échappe pas `<` : une valeur contenant `</script><script>…</script>` ferme la balise et exécute du JavaScript.

Deux sources de données atteignent ces balises :
1. **Données saisies par un tenant** — sur la fiche annuaire, `listing.tagline`, `site.description`, `listing.zones` et `display_name` vont dans le JSON-LD `LocalBusiness`. Un tenant malveillant (essai gratuit, sans carte) peut donc faire exécuter un script **sur klientys.co**, le domaine où vivent les sessions des autres pros et de l'opérateur. C'est une XSS stockée.
2. **Paramètre d'URL** — sur la page métier + ville, le segment `ville` (`vSlug`) devient `villeLabel` / `villePrep`, injecté dans le JSON-LD FAQ et le fil d'Ariane : un lien piégé suffit (XSS réfléchie), si Next.js décode le segment (à vérifier par le test ci-dessous).

Le site public du tenant (`[tenant]/page.tsx`) et le blog utilisent le même motif ; pour le blog, `body_html` est déjà nettoyé par bleach (KLT-1503) mais titre et description passent aussi dans le JSON-LD.

**Proposition**
1. Créer un helper unique `jsonLd(data)` qui fait `JSON.stringify(data).replace(/</g, "\\u003c")` (et ` `, ` `).
2. Remplacer les 9 usages (`grep -rn "application/ld+json"`).
3. Côté backend, refuser `<` et `>` dans les champs courts de l'annuaire (`tagline`, `zones`, `display_name`) — défense en profondeur.
4. Ajouter une règle de revue : aucun `dangerouslySetInnerHTML` hors du helper et du HTML bleaché.

**Critères de validation**
- Une fiche avec la tagline `</script><script>alert(1)</script>` s'affiche sans exécution ; le texte apparaît échappé dans le JSON-LD.
- `/annuaire/kinesitherapeute/%3C%2Fscript%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E` n'exécute rien.
- Le Rich Results Test de Google valide toujours les pages.

**Estimation** — S

### KLT-1421 · Métiers « autre » non promus invisibles dans l'annuaire
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-14.06 · **Réf.** : non commité (2026-11-03) · CLAUDE.md « Pièges connus » (Métier « autre »)

**Réalisation** — Avertissement dans Paramètres → Annuaire quand le métier n'est ni standard ni promu. La page admin listait déjà les métiers en attente.

**Constat** — Un pro au métier libre (ex. « réflexologue ») publie une fiche qui n'est listée nulle part tant que l'opérateur n'a pas promu le métier. Il croit être visible et ne l'est pas.

**Proposition**
1. Afficher dans Paramètres → Annuaire « Votre fiche sera visible dès validation de votre métier » tant que le métier n'est pas promu.
2. Notifier l'opérateur à chaque nouveau métier custom (badge dans Admin → Config).
3. Optionnel : pages `/annuaire/{slug-custom}/{ville}` générées sans promotion, en `noindex` jusqu'à validation.

**Critères de validation** — Un pro au métier non promu voit l'avertissement ; l'opérateur voit le métier en attente.

**Estimation** — S

### KLT-1422 · Note agrégée calculée sur les témoignages saisis par le pro
**Type** : SEO · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-14.05 · **Réf.** : non commité (2026-11-03) · `frontend/app/annuaire/[metier]/[ville]/[slug]/page.tsx:108-115`

**Réalisation** — `aggregateRating` et `review` retirés du JSON-LD de la fiche annuaire **et** du site tenant.

**Constat** — Le JSON-LD publie un `aggregateRating` calculé sur les témoignages que le pro saisit lui-même dans le site-builder (note par défaut 5). Les règles de Google sur les avis interdisent les notes auto-attribuées (« self-serving reviews ») pour un `LocalBusiness` sur sa propre page, et une page de l'annuaire Klientys qui les reprend s'expose à une action manuelle qui toucherait tout l'annuaire.

**Proposition** — Retirer `aggregateRating` du JSON-LD tant que les avis ne proviennent pas de clients vérifiés (par exemple un avis demandé après un RDV confirmé, lié à `appointment`).

**Critères de validation** — Le JSON-LD des fiches ne contient plus `aggregateRating`.

**Estimation** — XS
