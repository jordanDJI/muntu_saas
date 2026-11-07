# EP-13 · Widgets & intégrations externes

**Objectif** : le pro qui a déjà un site (WordPress, Wix, Notion…) ou qui vit sur Instagram doit pouvoir utiliser le chatbot, la réservation et le formulaire de contact Klientys là où sont ses clients, et mesurer ce que chaque support rapporte.

**Périmètre code** : `frontend/public/embed.js`, `frontend/app/embed/` (`EmbedForm.tsx`, `book`, `chatbot`, `contact`, `i18n.ts`, `useIntegration.ts`), `frontend/app/dashboard/embed/`, `frontend/app/dashboard/components/IntegrationsPanel.tsx`, `backend/app/services/integrations.py`, `backend/app/api/v1/integrations.py`, `backend/tests/test_integrations.py`, migration `080`

**Personas** : Pro, Visiteur d'un site externe, Opérateur (support)

---

## User stories

### US-13.01 · Intégrer les widgets Klientys sur mon site
**Statut** : ✅ Livré · **Persona** : Pro (feature `embed_widget`, Pro+)

> En tant que **pro** ayant déjà un site, je veux copier un code pour y afficher le chatbot, la réservation ou le formulaire de contact afin de ne pas changer de site.

**Critères d'acceptation**
- Snippets générés sur `/dashboard/embed` : `data-saas-widget="chatbot" | "book" | "contact"` + loader `embed.js` servi en HTTPS.
- Les adresses pointent vers la production (`NEXT_PUBLIC_APP_URL`).
- Un seul div chatbot par page.
- Intégrations de tracking actives (GA4, Pixel, GTM) affichées.

**Tickets** : KLT-1301, KLT-1302, KLT-1303

### US-13.02 · Retrouver exactement le formulaire de mon site dans les widgets
**Statut** : ✅ Livré · **Persona** : Visiteur, Pro

> En tant que **pro**, je veux que le widget de réservation se comporte comme le formulaire de mon site Klientys afin de ne configurer qu'une fois.

**Critères d'acceptation**
- `book` et `contact` affichent `contact-form.tsx` (via `EmbedForm`) : questions personnalisées, acompte, prestations, nombre de personnes, consentement RGPD, couleur du site.
- Configuration reçue dans la réponse du `ping` (sans le secret PayPal ; acompte seulement s'il est utilisable).
- Options réservées aux widgets : `lang`, `fixedMode`, `integrationKey`, `track={false}`.
- Hauteurs par défaut : 720 px (réservation), 620 px (contact).

**Tickets** : KLT-1304, KLT-0503, KLT-0521

### US-13.03 · Nommer mes supports et savoir ce que chacun rapporte
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux déclarer mes supports (mon site, ma page Notion, ma bio Instagram) afin de savoir combien de demandes et de RDV chacun m'apporte.

**Critères d'acceptation**
- Intégrations illimitées, types `website` (loader + `data-saas-integration`), `iframe` (pas de chatbot), `link` (URL directe).
- `POST /integrations/public/{slug}/ping` au chargement : domaine (`site_integration_domain`), `last_seen_at` (au plus toutes les 10 min) ; hôtes Klientys ignorés.
- Ancien code sans identifiant : rattaché à l'intégration déjà vue sur le domaine, sinon intégration `auto_created` (unicité `tenant_id, auto_domain`).
- `lead.integration_id`, `appointment.integration_id` posés par `/book`, `/paypal-capture`, `/leads/public`.
- Liste avec domaines, `leads_count`, `appointments_count` dans Mon site.

**Tickets** : KLT-1305, KLT-1322

### US-13.04 · Couper les widgets d'un support
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux désactiver un support (site abandonné, ancienne page) afin que plus personne ne puisse réserver par là, même si le code y est resté.

**Critères d'acceptation**
- Désactivation côté serveur : widget masqué (`saas-widget-hide`), `/book` et `/chatbot` → 403, page « service indisponible » pour un lien.
- Réversible ; pas de suppression.
- Intégration désactivée vérifiée **avant** l'encaissement PayPal.

**Tickets** : KLT-1305

### US-13.05 · Afficher les widgets dans la langue de mon site
**Statut** : ✅ Livré · **Persona** : Visiteur

> En tant que **visiteur** d'un site néerlandophone, je veux un widget en néerlandais afin de comprendre ce que je remplis.

**Critères d'acceptation**
- `data-saas-lang="fr|en|de|nl|auto"` ; `auto` suit `<html lang>` et traduit sans rechargement (`saas-set-lang`, poignée de main `saas-widget-ready`).
- Le chatbot répond dans la langue demandée.
- **Non traduit** : erreurs renvoyées par le backend (KLT-0420) et emails au client (KLT-0720).

### US-13.06 · Ne pas pénaliser mon référencement
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro** dont le vrai site est ailleurs, je veux que le site Klientys ne lui fasse pas concurrence dans Google afin de ne pas diluer mon référencement.

**Critères d'acceptation**
- Intégration active sans domaine personnalisé actif → `noindex` et retrait du sitemap (`should_noindex`).
- Domaine personnalisé identique au domaine d'une intégration (sans `www.`) → confirmation, puis désactivation de l'intégration au passage du domaine en `active`.

### US-13.07 · Aider un pro à intégrer ses widgets (support)
**Statut** : ✅ Livré · **Persona** : Opérateur

> En tant qu'**opérateur support**, je veux voir les intégrations d'un tenant et suivre un guide afin de diagnostiquer un widget qui ne s'affiche pas.

**Critères d'acceptation**
- `GET /admin/tenants/{id}/integrations` ; onglet Intégration de la fiche tenant, trois guides (`INTEGRATION_METHODS` via `GuideTab`), `{slug}` / `{origin}` remplacés.

---

## Tickets

### KLT-1301 · Widget embarqué non fonctionnel
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-13.01 · **Réf.** : `de2313d` (2026-05-05)

**Correction** — Premier correctif du loader et de l'affichage des widgets.

### KLT-1302 · Type de widget « booking » ignoré sans erreur
**Type** : Documentation · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-13.01 · **Réf.** : CLAUDE.md « Embed & widgets »

**Problème** — Le type attendu est `book` ; `booking` est ignoré silencieusement.

**Correction** — Documenté ; les snippets générés utilisent `book`.

### KLT-1303 · Page Embed : requête Supabase directe sans filtre tenant
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-13.01 · **Réf.** : `9b6ccb8` (2026-05-26)

**Problème** — La page lisait les sites avec un filtre `status=published` sans `tenant_id`.

**Correction** — Remplacée par `api.getSites()`.

### KLT-1304 · Widgets réduits à une copie simplifiée du formulaire
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-13.02 · **Réf.** : `0e5935b` (2026-11-01)

**Problème** — Les widgets n'avaient ni questions personnalisées, ni acompte, ni consentement RGPD, et divergeaient à chaque évolution du formulaire.

**Correction** — Les widgets rendent `contact-form.tsx` lui-même ; textes dans `contact-form-i18n.ts`, couleurs dans `site-colors.ts`.

### KLT-1305 · Intégrations nommées et désactivation côté serveur
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-13.03, US-13.04 · **Réf.** : `e625116` (2026-10-31), migration `080`

**Contenu** — Tables `site_integration`, `site_integration_domain`, attribution des leads et RDV, `ping`, désactivation appliquée par le backend, guides support.

### KLT-1322 · Domaine non détecté pour les iframes en `no-referrer`
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-13.03 · **Réf.** : non commité (2026-11-03) · CLAUDE.md (« via `document.referrer`, sauf `Referrer-Policy: no-referrer` »)

**Réalisation** — Message « domaine non communiqué par le site hôte — le widget fonctionne » pour une intégration iframe vue sans domaine.

**Constat** — Une intégration `iframe` sur une page qui envoie `Referrer-Policy: no-referrer` ne remonte aucun domaine : le pro voit « jamais vue » alors qu'elle fonctionne, et peut la croire cassée.

**Proposition** — Distinguer dans l'interface « vue, domaine inconnu » (ping reçu sans referrer) de « jamais vue » ; expliquer la cause dans une infobulle.

**Critères de validation** — Une iframe chargée depuis une page `no-referrer` apparaît « active, domaine non communiqué ».

**Estimation** — S
