# EP-03 · Site vitrine public & site-builder

**Objectif** : donner à chaque pro un site professionnel, adapté à son métier, qu'il construit seul en quelques étapes et publie en un clic.

**Périmètre code** : `frontend/app/dashboard/site-builder/page.tsx`, `frontend/app/[tenant]/` (page, contact-form, NavBar, SiteFooter, GallerySection, ServiceModal), `frontend/app/[tenant]/preview-banner`, `frontend/lib/sectorTemplates.ts`, `backend/app/api/v1/sites.py`, `backend/app/api/v1/public.py`, `backend/app/api/v1/uploads.py`, `backend/app/services/google_indexing.py`, migrations `003`, `007`, `008`, `042`, `060`

**Personas** : Pro, Visiteur du site

---

## User stories

### US-03.01 · Construire mon site avec un assistant pas à pas
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro non technicien**, je veux remplir un assistant guidé afin d'obtenir un site complet sans écrire de code.

**Critères d'acceptation**
- 9 étapes : identité visuelle → pages & photos → textes → coordonnées → zones → prestations → atouts → témoignages → analytics & CSS.
- Validations : titre obligatoire, email au bon format, nom de prestation / titre d'atout / nom + contenu de témoignage obligatoires si la ligne est entamée.
- Adresse stockée à la fois dans `site.address` (consolidée, pays inclus) et `site_style.address_parts`.
- 20 icônes SVG pour les atouts ; les anciennes valeurs emoji restent affichées.

**Tickets** : KLT-0303, KLT-0305

### US-03.02 · Démarrer avec un site pré-rempli pour mon métier
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux que l'assistant soit pré-rempli selon mon secteur afin de ne pas partir d'une page blanche.

**Critères d'acceptation**
- `?template=auto` applique `sectorTemplates` (textes, prestations types, horaires selon secteur).
- 8 secteurs : health, beauty, coaching, finance, trade, restaurant, commerce, other.

### US-03.03 · Prévisualiser mon brouillon
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux voir mon site avant de le publier afin de vérifier le rendu.

**Critères d'acceptation**
- `/{slug}?preview=1` affiche le brouillon avec `PreviewBanner`.
- Le bouton « Publier » de la bannière vérifie la session et renvoie vers `/login?redirect=` si nécessaire.

**Tickets** : KLT-0307

### US-03.04 · Publier et dépublier mon site
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux publier mon site en un clic, et pouvoir le retirer, afin de contrôler ce qui est visible.

**Critères d'acceptation**
- `POST /sites/{id}/publish` passe le site en `published` ; le site public ne s'affiche qu'à cet état.
- La dépublication demande une confirmation inline ; les erreurs affichent le vrai message du backend.
- Publication / dépublication notifient Google (Indexing API) quand configuré.

**Tickets** : KLT-0301, KLT-0302, KLT-0304, KLT-0306, KLT-0313

### US-03.05 · Montrer mon travail dans une galerie photos
**Statut** : ✅ Livré · **Persona** : Pro, Visiteur

> En tant que **pro**, je veux publier une galerie de photos afin de rassurer mes futurs clients.

**Critères d'acceptation**
- Upload depuis l'étape 1, choix d'affichage (horizontal / vertical), lightbox.
- Limite par plan : 8 / 16 / 24 photos.
- Lien « Galerie » dans la navigation du site uniquement si la galerie existe.

**Tickets** : KLT-0312

### US-03.06 · Présenter mes prestations avec plusieurs photos
**Statut** : ✅ Livré · **Persona** : Pro, Visiteur

> En tant que **visiteur**, je veux ouvrir une prestation pour voir ses photos et sa description complète afin de choisir en connaissance de cause.

**Critères d'acceptation**
- `service_offer.photos text[]` (migration `060`), rétrocompatible avec `image_url`.
- Limite : 3 photos (Essentiel), 9 (Pro / Business). Badge « Principale » sur la première.
- `ServiceModal` : carrousel (flèches, indicateurs, Échap) + CTA réservation.

### US-03.07 · Adapter le site à mon secteur (horaires, menu, catégories)
**Statut** : ✅ Livré · **Persona** : Pro (restaurant, commerce…)

> En tant que **restaurateur**, je veux afficher mes horaires et ma carte par catégorie afin que le site corresponde à mon activité.

**Critères d'acceptation**
- Horaires d'ouverture à l'étape 3, affichés dans Contact (conditionnés par le secteur).
- `service_type` ∈ `service | product | menu_item` + `category` ; le site groupe la carte par catégorie.

### US-03.08 · Disposer de pages légales sans effort
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux que les mentions légales, la politique de confidentialité et la politique cookies soient générées afin d'être en règle sans juriste.

**Critères d'acceptation**
- Footer 4 colonnes (marque, navigation, coordonnées, légal) ; modales légales générées depuis les données du site.

### US-03.09 · Être bien référencé
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux que mon site soit compris par Google afin d'être trouvé localement.

**Critères d'acceptation**
- JSON-LD schema.org au type sectoriel (Physician, BeautySalon, HomeAndConstructionBusiness…), horaires, images.
- Le site n'est **pas** indexé (`noindex`, retiré du sitemap) tant qu'une intégration externe est active sans domaine personnalisé (voir EP-13).

**Tickets** : KLT-1420 (échappement du JSON-LD)

### US-03.10 · Personnaliser finement le design (Business)
**Statut** : ✅ Livré · **Persona** : Pro Business

> En tant que **client Business**, je veux ajouter mon propre CSS et des vidéos par section afin d'obtenir un site à mon image.

**Critères d'acceptation**
- CSS custom à l'étape 8 et `video_urls` par section, gated `custom_css` (Business).
- Sinon : `UpgradeGate`.

### US-03.11 · Brancher mes outils de mesure
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux renseigner mes identifiants GA4, Meta Pixel et GTM afin de mesurer mes campagnes.

**Critères d'acceptation**
- Stockés dans `site_style.tracking`.
- Chargés uniquement après consentement de la catégorie correspondante (`TrackingScripts`, voir EP-18).

**Tickets** : KLT-0308

### US-03.12 · Recevoir les messages de mes visiteurs
**Statut** : ✅ Livré · **Persona** : Visiteur, Pro

> En tant que **visiteur**, je veux envoyer un message ou demander un RDV depuis le site afin d'entrer en contact avec le pro.

**Critères d'acceptation**
- Le formulaire crée un lead (`source="contact_form"` ou `booking`) et notifie le pro par email.
- Le CTA « Prendre rendez-vous » (#rdv) bascule le formulaire en mode RDV.
- Les emails des membres du tenant sont refusés (403), pour ne pas polluer le CRM avec des tests.

**Tickets** : KLT-0314

---

## Tickets

### KLT-0301 · Site public inaccessible après publication
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-03.04 · **Réf.** : `a90eec1` (2026-05-07)

**Problème** — Un site publié restait introuvable sur `/{slug}`.

**Correction** — Lecture du statut de publication corrigée côté site public.

### KLT-0302 · Site public dépendant de la clé service role côté frontend
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-03.04 · **Réf.** : `228ab1c` (2026-05-09)

**Problème** — Le frontend lisait le site directement dans Supabase, ce qui imposait `SUPABASE_SERVICE_ROLE_KEY` dans l'environnement Vercel.

**Correction** — `GET /api/v1/public/site/{slug}` côté backend ; la clé service role n'est plus nécessaire côté frontend. `paypal_client_secret` est retiré de la réponse.

### KLT-0303 · Perte de l'adresse détaillée à l'enregistrement du site
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-03.01 · **Réf.** : `12f7d86` (2026-05-26)

**Cause** — `buildSiteStyle()` n'incluait pas `address_parts` : chaque sauvegarde écrasait les champs séparés.

**Correction** — `address_parts` inclus dans `buildSiteStyle()`.

### KLT-0304 · Tous les endpoints /sites/* en erreur si google-auth absent
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-03.04 · **Réf.** : `9b6ccb8` (2026-05-26)

**Cause** — `google_indexing.py` importait `google.oauth2` au chargement du module.

**Correction** — Import paresseux dans la fonction ; l'indexation devient silencieuse si non configurée.

### KLT-0305 · Adresse consolidée sans le pays
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-03.01 · **Réf.** : `9b6ccb8`

**Correction** — `fullAddress` inclut le pays, cohérent avec `address_parts`.

### KLT-0306 · Carte de publication peu claire, erreurs génériques
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-03.04 · **Réf.** : `9b6ccb8`

**Correction** — Badge de statut animé, bouton Publier pleine largeur, confirmation inline avant dépublication, affichage de `err.message`.

### KLT-0307 · Publication depuis la prévisualisation sans session
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-03.03 · **Réf.** : `9b6ccb8`

**Correction** — `preview-banner` vérifie la session avant `publishSite` et redirige vers `/login?redirect=`.

### KLT-0308 · Identifiant Meta Pixel mal pris en compte
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-03.11 · **Réf.** : `6179620` → `e28b4ab`, `6950371` (2026-05-18 → 21)

**Correction** — Lecture de `meta_pixel_id`, événements `Lead` et `CompleteRegistration` corrigés.

### KLT-0309 · Refonte premium du site public
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-03.08 · **Réf.** : `12f7d86` (2026-05-26)

**Contenu** — NavBar fixe transparente au scroll, menu mobile plein écran, Cormorant Garamond sur les titres, `scroll-margin-top`, footer légal 4 colonnes, modales légales.

### KLT-0310 · Photo de contact réduisant la largeur du formulaire
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-03.12 · **Réf.** : `15e7945` (2026-05-27)

**Correction** — Photo déplacée dans la colonne coordonnées ; textarea redimensionnable.

### KLT-0312 · URL Supabase visible dans l'interface photo
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-03.05 · **Réf.** : `4f49f5b` (2026-06-15)

**Correction** — URL masquée, boutons Remplacer / Supprimer.

### KLT-0313 · Méthode `unpublishSite` absente du client API
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-03.04 · **Réf.** : `c37a3ae` (2026-04-20)

**Correction** — Méthode ajoutée à `lib/api.ts`.

### KLT-0314 · Message du visiteur non sauvegardé ni affiché
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-03.12 · **Réf.** : `058adc7`, `15f1ad5` (2026-05-25)

**Problème** — Le message saisi dans le formulaire de contact n'arrivait pas jusqu'au pro.

**Correction** — Message enregistré sur le lead et affiché dans le dashboard.
