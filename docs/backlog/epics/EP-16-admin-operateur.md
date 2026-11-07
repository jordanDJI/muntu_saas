# EP-16 · Panel admin opérateur

**Objectif** : donner à l'équipe Klientys un cockpit pour piloter l'activité (MRR, conversion), assister les clients et intervenir sur un compte sans passer par l'éditeur SQL.

**Périmètre code** : `frontend/app/admin/` (métriques, tenants, tenants/[id], log, config, content, billing, analytics, campaigns, support, design-requests, logo-requests, relances), `backend/app/api/v1/admin.py`, `backend/app/middleware/admin.py`, migration `028`

**Accès** : `app_metadata.is_super_admin`, ou `app_metadata.support_role` ∈ `viewer` (L1, lecture) · `support` (L2) · `super_admin` (L3). Les requêtes admin ne portent pas de `X-Tenant-Id`.

**Personas** : Opérateur (super admin), Agent support

---

## User stories

### US-16.01 · Suivre les indicateurs du SaaS
**Statut** : ✅ Livré · **Persona** : Opérateur

> En tant qu'**opérateur**, je veux voir tenants par statut, MRR, inscriptions et conversion afin de piloter l'activité.

**Critères d'acceptation**
- `GET /admin/metrics`, `GET /admin/metrics/growth?days=30` (sparkline interactive, survol or).
- `computed_status` : suspended → active / trialing → trial → trial_expired.

**Tickets** : KLT-1012

### US-16.02 · Retrouver un tenant
**Statut** : ✅ Livré · **Persona** : Opérateur, Support

> En tant qu'**agent support**, je veux chercher un tenant par nom, email ou statut afin de répondre vite à une demande.

**Critères d'acceptation**
- Liste paginée, recherche, filtres statut et secteur, email du propriétaire, export CSV.
- Badge de dépassement de contacts.

**Tickets** : KLT-1603

### US-16.03 · Créer un tenant manuellement
**Statut** : ✅ Livré · **Persona** : Opérateur

> En tant qu'**opérateur**, je veux créer un compte pour un client accompagné afin de lui livrer un espace prêt.

**Critères d'acceptation**
- `POST /admin/tenants` : utilisateur Supabase + tenant + membership + calendrier.

### US-16.04 · Agir sur un compte client
**Statut** : ✅ Livré · **Persona** : Opérateur, Support

> En tant qu'**opérateur**, je veux prolonger un essai, activer gratuitement, suspendre, confirmer un email, réinitialiser un mot de passe ou changer l'email du propriétaire afin de régler un cas sans SQL.

**Critères d'acceptation**
- Fiche tenant : infos, abonnement, site, domaine, compteurs, score de complétion, rappels d'essai envoyés, relances en retard, overrides, log.
- Actions : extend-trial, force-activate, suspend / unsuspend, confirm-email, reset-password, owner-email, sync-stripe, reset-domain, clear-cache, suppression définitive.
- Chaque action est journalisée.

**Tickets** : KLT-1601

### US-16.05 · Se connecter en tant que client
**Statut** : ✅ Livré · **Persona** : Support

> En tant qu'**agent support**, je veux ouvrir l'espace d'un client afin de voir exactement ce qu'il voit.

**Critères d'acceptation**
- `POST /admin/tenants/{id}/impersonate` → magic link à ouvrir dans un nouvel onglet ; action journalisée.

**Tickets** : KLT-1620

### US-16.06 · Gérer les features et la configuration système
**Statut** : ✅ Livré · **Persona** : Opérateur

> En tant qu'**opérateur**, je veux activer des feature flags, passer en maintenance et éditer les mots-clés Trends afin de piloter la plateforme sans redéployer.

**Critères d'acceptation**
- Feature flags globaux (CRUD), overrides par tenant (EP-10).
- `system_config` : `maintenance_mode`, `maintenance_message`, `sector_keywords`, `sector_labels`, `custom_metiers`.

### US-16.07 · Tracer toutes les actions admin
**Statut** : ✅ Livré · **Persona** : Opérateur

> En tant qu'**opérateur**, je veux un journal de toutes les actions admin afin de savoir qui a fait quoi sur un compte.

**Critères d'acceptation**
- `admin_action_log` ; page Log filtrable par type et par admin, paginée ; log par tenant dans la fiche.

**Tickets** : KLT-1601

### US-16.08 · Suivre les paiements Stripe
**Statut** : ✅ Livré · **Persona** : Opérateur

> En tant qu'**opérateur**, je veux voir et traiter les paiements depuis l'admin afin de gérer les impayés.

**Critères d'acceptation**
- `/admin/billing` : MRR / ARR, statistiques Stripe 30 jours, table unifiée abonnements + paiements ponctuels, actions (finaliser, envoyer, marquer payé, annuler, renvoyer le reçu, expirer la session), badge impayés.

### US-16.09 · Mesurer l'audience de klientys.co
**Statut** : ✅ Livré · **Persona** : Opérateur

> En tant qu'**opérateur**, je veux l'audience du site marketing, du blog et de l'annuaire afin de savoir quels contenus attirent.

**Critères d'acceptation**
- `/admin/analytics` : 13 rapports GA4 en 3 appels batch (appareils, nouveaux / récurrents, pays, villes, pages d'entrée, événements, UTM, blog, annuaire) ; temps réel toutes les 30 s.

**Tickets** : KLT-1604

### US-16.10 · Superviser les campagnes et les demandes de service
**Statut** : ✅ Livré · **Persona** : Opérateur

> En tant qu'**opérateur**, je veux voir les campagnes de tous les tenants et traiter les demandes de design et de logo afin de détecter les abus et livrer les prestations.

**Critères d'acceptation**
- `/admin/campaigns` (filtres, taux d'ouverture et de clic, désabonnements).
- `/admin/design-requests`, `/admin/logo-requests` (statuts).
- `/admin/relances`.

**Tickets** : KLT-1602

---

## Tickets

### KLT-1601 · Suppression de tenant impossible (clé étrangère du log)
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-16.04, US-16.07 · **Réf.** : `20cceff` (2026-06-14)

**Cause** — Le log était écrit après la suppression : `admin_action_log.target_tenant_id → tenant.id` → erreur 23503.

**Correction** — `_log()` appelé avant `delete()`.

### KLT-1602 · Endpoints admin des demandes de logo sans authentification
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-16.10 · **Réf.** : `7efba30` (2026-10-04)

**Problème** — `get_current_admin` était importé dans le corps de la fonction sans être utilisé comme dépendance : n'importe qui pouvait lister les briefs de tous les tenants et marquer des demandes terminées.

**Correction** — `admin=Depends(get_current_admin)` sur `/logo-requests/admin/*`.

### KLT-1603 · Signaler les dépassements de contacts dans l'admin
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-16.02 · **Réf.** : `6373abd` (2026-10-02)

**Contenu** — Badge de dépassement dans la liste et la fiche tenant, base de la restriction manuelle.

### KLT-1604 · Rapports GA4 trop nombreux et lents
**Type** : Performance · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-16.09 · **Réf.** : `aa59f5e` (2026-07-27)

**Correction** — 5 rapports individuels remplacés par 3 batches (13 rapports).

### KLT-1620 · Encadrer l'impersonation
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-16.05 · **Réf.** : non commité (2026-11-03) · `backend/app/api/v1/admin.py` (`impersonate`, log ligne 982)

**Réalisation** — Motif obligatoire (journalisé), notification in-app au tenant en plus de l'email existant, bandeau « Session support » dans l'onglet ouvert. L'impersonation était déjà réservée au niveau super admin.

**Constat** — Un magic link donne une session complète du propriétaire : l'agent peut tout faire, y compris supprimer des données, ouvrir le portail Stripe ou exporter les contacts, et les actions faites ensuite apparaissent comme celles du client. Seule la génération du lien est journalisée. Le DPA promet un accès limité au support.

**Proposition**
1. Réserver l'impersonation au niveau `super_admin` (vérifier le niveau actuellement exigé).
2. Demander un motif (texte libre) enregistré dans le log.
3. Bandeau visible « Session support — vous êtes connecté en tant que … » dans le dashboard pendant la session.
4. Notification au propriétaire (email ou in-app) après chaque impersonation.

**Critères de validation** — Un agent `viewer` reçoit 403 ; le log porte le motif ; le propriétaire est informé.

**Estimation** — M
