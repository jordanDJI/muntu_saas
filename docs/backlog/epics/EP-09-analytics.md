# EP-09 · Analytics & potentiel de demande locale

**Objectif** : rendre le ROI de Klientys visible : ce que le site attire, ce que les visiteurs font, et combien de demande existe autour du pro.

**Périmètre code** : `backend/app/api/v1/analytics.py`, `backend/app/services/trends.py`, `pdf.py`, `frontend/app/dashboard/analytics/` (`DemandPotentialCard`, `DemandMap`), `frontend/app/[tenant]/page.tsx` (script de tracking), `frontend/components/TrackingScripts.tsx`, migrations `018`, `025`, `059`, `074` (`site_event`)

**Personas** : Pro

---

## User stories

### US-09.01 · Mesurer le comportement des visiteurs de mon site
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux savoir combien de visiteurs viennent et ce qu'ils regardent afin de comprendre ce qui fonctionne sur mon site.

**Critères d'acceptation**
- Tracker propriétaire (ne remplace pas GA4) : `pageview`, `section_view` (IntersectionObserver), `cta_click` (`[data-track]`), `form_open`, `form_submit`, `chatbot_open`, `chatbot_message`.
- Session par onglet (`sessionStorage._pp_sid`).
- Chargé uniquement après consentement « analytiques ».
- Les widgets embarqués n'envoient pas d'événements (`track={false}`).

### US-09.02 · Consulter mon tableau de bord analytics
**Statut** : ✅ Livré · **Persona** : Pro (feature `analytics`)

> En tant que **pro**, je veux un résumé de mes visites, demandes et RDV sur une période afin de suivre ma conversion.

**Critères d'acceptation**
- `GET /analytics/summary?days=30` : CRM, RDV, comportemental, taux de conversion lead et RDV (plafonné à 100 %, RDV confirmés uniquement).
- Sections les plus consultées avec part des vues.
- Zéros renvoyés si `site_event` n'existe pas.

**Tickets** : KLT-0901, KLT-0904, KLT-0905

### US-09.03 · Estimer la demande autour de moi
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux voir l'intérêt des recherches Google pour mon métier dans mes zones afin de savoir si je peux attendre plus de clients.

**Critères d'acceptation**
- `GET /analytics/roi-potential?period=week|month|quarter|year`, pytrends filtré par pays et zones (`coverage_zones`).
- Score agrégé 0-100, courbe, score par zone, requêtes associées ; cache 24 h (`tenant_roi_cache`).
- Mots-clés par défaut par secteur (éditables par l'opérateur), affinables par le pro (`PATCH /analytics/trend-keywords`, invalide le cache).
- Bandeau ambre si le backend est injoignable.

**Tickets** : KLT-0902, KLT-0903, KLT-0921

### US-09.04 · Visualiser la demande sur une carte
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux une carte de mes zones colorées selon la demande afin de choisir où concentrer mes efforts.

**Critères d'acceptation**
- `DemandMap` (react-leaflet, `ssr: false`), un cercle par zone : vert ≥ 67, ambre ≥ 34, rouge < 34.
- Géocodage Nominatim.

### US-09.05 · Voir mes données Google Analytics dans Klientys
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux connecter ma propriété GA4 afin de voir mes statistiques au même endroit.

**Critères d'acceptation**
- OAuth Google → tokens enregistrés ; guide en 3 étapes pour trouver l'ID de propriété (préfixe `properties/` ajouté).
- `GET /analytics/google/data?days=30`.

**Tickets** : KLT-1820 (tokens en clair)

### US-09.06 · Télécharger un rapport PDF
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux télécharger un rapport de mon activité afin de le partager ou de l'archiver.

**Critères d'acceptation**
- `GET /analytics/report.pdf?days=N` (WeasyPrint en prod, xhtml2pdf en repli Windows).
- Envoi automatique mensuel (EP-07).

### US-09.07 · Choisir les indicateurs de mon dashboard
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux choisir les indicateurs affichés sur mon dashboard d'accueil afin de voir d'abord ce qui compte pour moi.

**Critères d'acceptation**
- `METRIC_DEFS` dans Paramètres → Métriques ; préférences dans `user_metadata.dashboard_kpis`.
- `DemandPotentialCard` sur le dashboard si le KPI `demand_potential` est activé.

---

## Tickets

### KLT-0901 · Taux de conversion RDV supérieur à 100 %
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-09.02 · **Réf.** : `0acc9ac` (2026-05-07)

**Cause** — Tous les RDV (y compris ceux pris hors lead) étaient divisés par le nombre de leads.

**Correction** — Seuls les RDV confirmés sont comptés, taux plafonné à 100 %.

### KLT-0902 · Zones de demande vides
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-09.03 · **Réf.** : `9b6ccb8`, `1364cc2` (2026-05-26)

**Cause** — L'analytics lisait `service_area`, alors que l'étape 4 du site-builder écrit `coverage_zones`.

**Correction** — Lecture de `coverage_zones`, suppression des replis morts sur `service_area` (backend et site public).

### KLT-0903 · Infobulle d'aide inaccessible sur mobile
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-09.03 · **Réf.** : `a24f6d9` (2026-07-27)

**Correction** — Survol remplacé par un clic, fermeture au clic extérieur (`mousedown` / `touchstart`).

### KLT-0904 · Erreur analytics avant création de la table d'événements
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-09.02 · **Réf.** : `7620f8e` (2026-05-07)

**Correction** — Dégradation gracieuse : zéros si `site_event` est absente.

### KLT-0905 · Table `site_event` jamais migrée
**Type** : Dette technique · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-09.01 · **Réf.** : migration `074_schema_reconciliation.sql`

**Problème** — La table avait été créée à la main ; un nouvel environnement n'avait pas d'analytics.

**Correction** — Création dans la migration de réconciliation.

### KLT-0921 · Fiabilité et observabilité de Google Trends
**Type** : Dette technique · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-09.03 · **Réf.** : non commité (2026-11-03) · `backend/app/services/trends.py:30, 53, 92, 108, 111`

**Réalisation** — Champ `degraded`, pas de mise en cache d'un résultat en erreur, dernier résultat valide servi, message dans `DemandPotentialCard`, erreurs journalisées.

**Constat** — pytrends est une API non officielle, sujette aux blocages (429) et aux changements côté Google. `trends.py` contient 5 blocs `except Exception: pass` : quand Google bloque, la carte affiche un score vide ou nul sans que ni le pro ni l'opérateur ne sachent pourquoi. Le cache 24 h fige ensuite ce résultat vide.

**Proposition**
1. Journaliser chaque échec (niveau warning, avec le mot-clé et le geo) et l'envoyer à Sentry.
2. Ne pas mettre en cache une réponse vide due à une erreur ; conserver le dernier résultat valide.
3. Renvoyer un champ `degraded: true` et l'afficher (« Données Google momentanément indisponibles »).
4. Compteur d'échecs visible dans l'admin.

**Critères de validation** — Avec pytrends forcé en erreur, la carte affiche le dernier résultat valide et le message de dégradation ; l'erreur apparaît dans les logs.

**Estimation** — S
