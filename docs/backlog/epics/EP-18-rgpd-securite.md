# EP-18 · RGPD, sécurité & conformité

**Objectif** : que Klientys puisse être choisi par des professions soumises au secret (santé, juridique) et par des clients B2B qui auditent leurs sous-traitants : consentement, droits des personnes, minimisation, et une plateforme qui résiste aux attaques courantes.

**Périmètre code** : `frontend/components/CookieBanner.tsx`, `TrackingScripts.tsx`, `backend/app/api/v1/gdpr.py`, `users.py` (export, suppression de compte, journal), `backend/app/services/retention.py`, `html_sanitize.py`, rate limiter (`check_rate`, `check_rate_async`), `frontend/app/legal/`, migrations `026`, `071`, `079`, contact_consent / rétention (septembre 2026)

**Personas** : Visiteur, Client final, Pro, Opérateur (DPO : support@klientys.co)

> Les failles d'isolation multi-tenant sont suivies dans EP-02, celles des paiements dans EP-05 et EP-10. Cette epic regroupe le transverse.

---

## User stories

### US-18.01 · Choisir les cookies que j'accepte
**Statut** : ✅ Livré · **Persona** : Visiteur

> En tant que **visiteur**, je veux accepter, refuser ou personnaliser les cookies afin de garder le contrôle de mon suivi.

**Critères d'acceptation**
- Bannière : « Tout refuser », « Tout accepter », « Personnaliser » (fonctionnels verrouillés, analytiques, marketing).
- Refus = aucun script analytique chargé ; GA4 / GTM / tracker Klientys conditionnés à `analytics`, Meta Pixel à `marketing`.
- Choix persisté (`klientys_cookie_consent`, `klientys_cookie_detail`), événement `cookie-consent`.
- Landing et sites tenant couverts, clés indépendantes.

**Tickets** : KLT-1805

### US-18.02 · Exporter mes données
**Statut** : ✅ Livré · **Persona** : Pro, Client final

> En tant que **personne concernée**, je veux obtenir une copie de mes données afin d'exercer mon droit d'accès et de portabilité.

**Critères d'acceptation**
- Pro : export de son compte (`GET /users/export`).
- Contact d'un pro : export RGPD de la fiche (`gdpr.py`), champs custom inclus.

**Tickets** : KLT-0607

### US-18.03 · Faire effacer les données d'un client
**Statut** : ✅ Livré · **Persona** : Pro, Client final

> En tant que **pro**, je veux traiter une demande d'effacement en deux temps (demande puis confirmation) afin de respecter le droit à l'oubli sans erreur de manipulation.

**Critères d'acceptation**
- Boîte des suppressions en attente dans Paramètres → RGPD.
- Anonymisation de la fiche **et** de `contact_activity.content`, `contact_import_job.changes`, `contact.notes`.

**Tickets** : KLT-1801

### US-18.04 · Purger automatiquement les contacts inactifs
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux fixer une durée de conservation afin que les données de mes anciens clients ne soient pas gardées indéfiniment.

**Critères d'acceptation**
- Durée par tenant ; tâche planifiée qui anonymise les contacts inactifs, sauf RDV futur ou facture impayée.

### US-18.05 · Prouver le consentement de mes contacts
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux un historique des consentements afin de prouver la base légale de mes envois.

**Critères d'acceptation**
- Historique `contact_consent` ; consentement recueilli sur le formulaire du site et des widgets.
- Désabonnement des campagnes (EP-07).

### US-18.06 · Tracer les accès et modifications
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux un journal des connexions et des modifications afin de détecter un accès anormal.

**Critères d'acceptation**
- Journal d'activité (connexions email / Google, profil, photo, export), chargé par pages de 10.
- Historique des modifications par fiche contact.

### US-18.07 · Disposer des documents contractuels RGPD
**Statut** : ✅ Livré · **Persona** : Pro (B2B)

> En tant que **client B2B**, je veux un DPA et la liste des sous-traitants afin de documenter mon registre de traitements.

**Critères d'acceptation**
- `/legal/dpa`, `/legal/sous-traitants`.

**Tickets** : KLT-1509, KLT-1822

### US-18.08 · Protéger les endpoints publics contre les abus
**Statut** : ✅ Livré · **Persona** : Opérateur

> En tant qu'**opérateur**, je veux limiter le débit des endpoints publics afin d'éviter spam, scraping et coûts IA incontrôlés.

**Critères d'acceptation**
- Limites sur réservation, paiements, leads publics, site public, annuaire, résolution de domaine, chatbot, agent de contenu.
- IP lue sur le dernier saut de `X-Forwarded-For` (ajouté par le proxy de confiance).
- Redis partagé si `REDIS_URL`, repli mémoire sinon.

**Tickets** : KLT-1802, KLT-1803, KLT-1804

### US-18.09 · Protéger les secrets et données sensibles au repos
**Statut** : ✅ Livré · **Persona** : Pro, Opérateur

> En tant que **pro**, je veux que mes identifiants (PayPal, Google, Telegram) et les données de santé de mes patients soient chiffrés en base afin qu'une fuite de la base ne les expose pas.

**Critères d'acceptation**
- Chiffrement applicatif des secrets et des résumés OCR, clé hors base, rotation documentée.

**Tickets** : KLT-1820, KLT-0820

### US-18.10 · Héberger les données de santé de façon conforme
**Statut** : ⬜ À faire · **Persona** : Pro (santé, France)

> En tant qu'**infirmière libérale française**, je veux savoir si mes données patients sont hébergées conformément à la réglementation afin de pouvoir utiliser Klientys sans risque.

**Tickets** : KLT-1822

---

## Tickets

### KLT-1801 · Données personnelles reconstituables après un effacement
**Type** : Conformité · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-18.03 · **Réf.** : `5571b58` (2026-10-11)

**Problème** — L'anonymisation laissait intacts `contact_activity.content`, `contact_import_job.changes` et `contact.notes`.

**Correction** — Ces champs sont nettoyés à l'anonymisation.

### KLT-1802 · Limitation de débit contournable ou partagée
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-18.08 · **Réf.** : `7efba30` (2026-10-04), `5571b58` (2026-10-11)

**Problème** — Derrière le proxy, tous les visiteurs partageaient un quota ; la première correction lisait le **premier** saut de `X-Forwarded-For`, fixé par le client : n'importe quelle limite se contournait en usurpant l'en-tête.

**Correction** — Lecture du dernier saut, ajouté par le proxy de confiance.

### KLT-1803 · Endpoints publics sans limitation
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-18.08 · **Réf.** : `5571b58`

**Correction** — Limites ajoutées sur `leads.py` public, `public.py`, `directory.py`, `domains.py /resolve` (par domaine).

### KLT-1804 · Compteurs remis à zéro à chaque déploiement
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-18.08 · **Réf.** : `7efba30`

**Correction** — Backend Redis optionnel (`REDIS_URL`) pour les endpoints de paiement (`check_rate_async`), repli mémoire en cas de panne. Sans Redis, le quota est multiplié par le nombre de workers.

### KLT-1805 · Bannière cookies réaffichée et scripts chargés sans choix
**Type** : Conformité · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-18.01 · **Réf.** : `12febca` (2026-05-27), `0f6e6fd` (2026-06-04)

**Correction** — Consentement persisté ; `TrackingScripts` ne charge rien avant le choix ; refonte en deux vues.

### KLT-1806 · Messages d'erreur exposant l'URL du backend
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-18.08 · **Réf.** : `0f6e6fd`

**Correction** — Messages génériques côté client.

### KLT-1820 · Chiffrer les secrets des tenants en base
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-18.09 · **Réf.** : non commité (2026-11-03) · `site.paypal_client_secret`, `google_analytics_connection.access_token / refresh_token` (`analytics.py:574-598`), `agent_config` (`telegram_bot_token`, WhatsApp), `ocr_summary.summary_encrypted`

**Réalisation** — `core/crypto.py` (Fernet, préfixe `enc:v1:`, rotation par `DATA_ENCRYPTION_KEY_PREVIOUS`) sur le secret PayPal, les tokens Google et le jeton Telegram (+ empreinte de recherche). 13 tests unitaires. Refus d'écrire en clair en production.

**Constat** — Tous ces secrets sont stockés en clair. Toute personne qui lit la base (service role key divulguée, dump, sauvegarde, accès à l'éditeur Supabase) peut : encaisser ou rembourser sur le compte PayPal de chaque pro, lire leurs données Google Analytics, et prendre le contrôle de leurs bots Telegram — pour tous les tenants à la fois.

**Proposition**
1. Module `core/crypto.py` : AES-GCM (ou Fernet), clé `DATA_ENCRYPTION_KEY` en variable d'environnement Railway, préfixe de version (`v1:`) pour permettre la rotation.
2. Chiffrer à l'écriture, déchiffrer au seul moment de l'appel au fournisseur.
3. Script de migration des valeurs existantes ; lecture tolérante (clair ou chiffré) pendant la transition.
4. Traiter `ocr_summary` dans le même chantier (KLT-0820).
5. Documenter la procédure de rotation dans CLAUDE.md.

**Critères de validation** — Aucune de ces colonnes ne contient de valeur lisible en base ; acompte PayPal, données GA4 et bot Telegram fonctionnent toujours.

**Estimation** — M

### KLT-1822 · Décider de l'hébergement des données de santé (HDS)
**Type** : Conformité · **Statut** : ⬜ À faire · **Priorité** : P1 · **US** : US-18.10 · **Réf.** : mémoire projet « Dossier commercial Eukalypton » (décision HDS ouverte)

**Constat** — Klientys cible explicitement infirmières et kinés, et stocke des données de santé : résumés d'ordonnances (OCR), motifs de consultation (questions personnalisées), pré-diagnostics photo, conversations. En France, l'hébergement de données de santé pour le compte d'un professionnel exige un hébergeur certifié HDS. La décision est ouverte et conditionne le discours commercial auprès des professions de santé.

**Options à instruire**
1. **Exclure** les données de santé : CGU qui l'interdisent, désactivation de l'OCR et du pré-diagnostic pour le secteur `health`, avertissement sur les questions personnalisées.
2. **Héberger en HDS** : vérifier les offres HDS des fournisseurs actuels (Supabase, Railway, sous-traitants IA) ou migrer les tables concernées vers un hébergeur certifié.
3. Cas belge à documenter à part (pas de certification HDS, mais obligations RGPD art. 9 et déontologiques).

**Livrable** — Note de décision (option retenue, coût, calendrier), mise à jour du DPA et de la liste des sous-traitants.

**Estimation** — M (décision) ; L si l'option 2 est retenue

### KLT-1823 · Traceurs de Klientys chargés sans consentement, y compris sur les sites des tenants
**Type** : Conformité · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-18.01 · **Réf.** : non commité (2026-11-03), `components/KlientysTracking.tsx`

**Problème** — GA4 et le Meta Pixel de Klientys étaient dans le layout racine, sans condition : chargés avant tout choix de l'internaute, sur toutes les pages — sites des tenants, widgets embarqués et dashboard compris. Le bandeau annonçait « Refus = zéro script analytique », et les visites des clients des pros (dont des patients) partaient vers Meta.

**Correction** — Chargement réservé au site marketing (hôte Klientys, hors `/{slug}`, `/embed`, `/dashboard`, `/admin`) et au consentement (analytiques → GA4, marketing → Pixel). Bandeau ajouté aux pages marketing qui n'en avaient pas. Test Playwright : aucune requête vers Google ou Meta avant consentement.

### KLT-1824 · Choix de cookies d'un site tenant écrasant celui du site Klientys
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-18.01 · **Réf.** : non commité (2026-11-03), `components/CookieBanner.tsx`

**Problème** — Le détail par catégorie était stocké sous une clé unique : sur klientys.co, choisir sur `/{slug}` réécrivait le choix fait sur la landing, et inversement.

**Correction** — Une clé de détail par bannière ; sans décision pour une bannière, rien n'est consenti.
