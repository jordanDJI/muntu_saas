# EP-02 · Multi-tenant, équipe & permissions

**Objectif** : isoler strictement les données de chaque espace professionnel, et permettre au pro de travailler à plusieurs (associé, assistante, secrétaire) avec des droits adaptés.

**Périmètre code** : `backend/app/middleware/tenant.py`, `backend/app/middleware/roles.py`, `backend/app/api/v1/members.py`, `backend/app/api/v1/tenants.py`, `backend/app/api/v1/secretary.py`, `frontend/contexts/TenantContext.tsx`, `frontend/app/join/`, `frontend/app/dashboard/secretary/`, `frontend/app/dashboard/layout.tsx` (`PERM_PATHS`), migrations `015`, `026`, `046`, `071`

**Personas** : Pro (owner), Admin, Membre, Secrétaire

---

## User stories

### US-02.01 · Garantir l'isolation des données entre espaces
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux être certain qu'aucun autre client de Klientys ne peut lire ou modifier mes données afin de respecter le secret professionnel et le RGPD.

**Critères d'acceptation**
- Chaque requête authentifiée passe par `get_current_tenant()` (JWT → `tenant_id`, membership vérifiée).
- Toute écriture filtre à nouveau sur `tenant_id` (défense en profondeur), même après un contrôle de propriété préalable.
- Tout identifiant reçu du client (`contact_id`, `lead_id`, `appointment_id`…) est vérifié comme appartenant au tenant.
- RLS activée sur toutes les tables ; les tables internes n'ont aucune policy (service role uniquement).

**Tickets** : KLT-0201, KLT-0202, KLT-0203, KLT-0204, KLT-0206, KLT-0207, KLT-0210, KLT-0211

### US-02.02 · Inviter un membre dans mon espace
**Statut** : ✅ Livré · **Persona** : Owner, Admin

> En tant qu'**owner**, je veux inviter un collaborateur par email avec un rôle et des accès choisis afin de déléguer une partie du travail.

**Critères d'acceptation**
- Formulaire email + rôle + permissions (cases à cocher), puis modale de confirmation récapitulative.
- `POST /members/invite` crée un `team_invite` et envoie l'email.
- Le nombre de membres est plafonné par le plan (`max_team_members`).
- Une invitation en attente peut être annulée.

**Tickets** : KLT-0209

### US-02.03 · Rejoindre un espace sur invitation
**Statut** : ✅ Livré · **Persona** : Membre invité

> En tant que **personne invitée**, je veux accepter l'invitation, que j'aie déjà un compte ou non, afin d'accéder à l'espace de mon employeur.

**Critères d'acceptation**
- Page `/join` : connexion (compte existant) ou inscription (`signup_via_invite`).
- À l'acceptation, les permissions de `team_invite` sont copiées dans `membership`.
- Une invitation expirée est refusée.

### US-02.04 · Limiter les accès d'un membre
**Statut** : ✅ Livré · **Persona** : Owner, Admin

> En tant qu'**owner**, je veux choisir les sections accessibles à chaque membre (CRM, agenda, site, analytics, agents) afin de ne partager que le nécessaire.

**Critères d'acceptation**
- `membership.permissions` ∈ `crm | calendar | site_builder | analytics | agents` ; ignoré pour `owner` / `admin`.
- Navigation filtrée et redirection si la section courante est interdite (frontend).
- Facturation et Membres invisibles pour un `member` (`OWNER_ONLY_SECTIONS`).
- **Le backend refuse les appels d'une section non autorisée** — fait pour `crm` et `calendar`, **pas encore** pour `site_builder`, `analytics`, `agents`.

**Tickets** : KLT-0208, KLT-0220, KLT-0221

### US-02.05 · Gérer les membres existants
**Statut** : ✅ Livré · **Persona** : Owner, Admin

> En tant qu'**owner**, je veux modifier les permissions d'un membre ou le retirer afin d'adapter les accès quand l'équipe change.

**Critères d'acceptation**
- `PATCH /members/{user_id}/permissions` et `DELETE /members/{user_id}` réservés à owner/admin.
- Un membre retiré perd l'accès immédiatement, même avec un JWT encore valide.

**Tickets** : KLT-0207

### US-02.06 · Gérer plusieurs espaces avec un seul compte
**Statut** : ✅ Livré · **Persona** : Pro multi-activités

> En tant que **pro ayant plusieurs activités**, je veux basculer d'un espace à l'autre sans me déconnecter afin de tout gérer depuis un seul compte.

**Critères d'acceptation**
- `GET /auth/me/tenants` liste les espaces ; `TenantContext` porte l'espace courant (header `X-Tenant-Id`).
- La création d'un espace supplémentaire est plafonnée par le plan (`max_tenants`).

**Tickets** : KLT-0209

### US-02.07 · Espace secrétaire multi-agendas
**Statut** : ✅ Livré · **Persona** : Secrétaire

> En tant que **secrétaire** travaillant pour plusieurs pros, je veux voir et gérer leurs rendez-vous dans une vue unique afin de ne pas jongler entre les espaces.

**Critères d'acceptation**
- `/dashboard/secretary` : vue consolidée des RDV de tous les espaces accessibles, journal d'activité, liste des sites.
- `PATCH /secretary/appointments/{id}` modifie un RDV d'un espace dont la secrétaire est membre, et uniquement celui-là.
- Réservé à la feature `multi_tenant` (plan Business).

### US-02.08 · Disposer d'une clé API pour mon espace
**Statut** : ✅ Livré · **Persona** : Owner

> En tant qu'**owner**, je veux une clé API régénérable afin de connecter des outils tiers à mon espace.

**Critères d'acceptation**
- `GET /tenants/api-key` et `POST /tenants/api-key/regenerate`.
- La régénération invalide l'ancienne clé.

---

## Tickets

### KLT-0201 · Un tenant pouvait créer un RDV sur le contact d'un autre tenant (IDOR)
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-02.01 · **Réf.** : `5571b58` (2026-10-11)

**Problème** — `contact_id` et `lead_id` reçus à la création d'un RDV n'étaient pas vérifiés : un tenant pouvait rattacher un RDV au contact d'un autre tenant et en lire les informations.

**Correction** — Vérification de propriété dans `appointments.py` et `calendar.py` avant création.

### KLT-0202 · Fuite de données contact d'un autre tenant dans une facture
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-02.01 · **Réf.** : `5571b58` (2026-10-11)

**Problème** — `_get_contact_snapshot` (invoices.py) ne filtrait pas sur `tenant_id` : nom, adresse, TVA et SIRET d'un contact d'un autre tenant pouvaient être copiés dans une facture. `create_invoice` ne vérifiait pas non plus `appointment_id`.

**Correction** — Snapshot filtré sur `tenant_id` ; `appointment_id` vérifié.

### KLT-0203 · Retrait d'un tag sans contrôle de tenant
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-02.01 · **Réf.** : `5571b58` (2026-10-11)

**Correction** — `remove_tag_from_contact` (tags.py) vérifie que le tag et le contact appartiennent au tenant.

### KLT-0204 · Écritures reposant sur un contrôle de propriété séparé
**Type** : Dette technique · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-02.01 · **Réf.** : `5571b58` (2026-10-11)

**Problème** — Plusieurs `update` / `delete` (relances, factures, RDV, fusion de contacts, upsert groupé) ne filtraient que sur l'`id` après un contrôle préalable. Non exploitable, mais fragile au moindre refactoring.

**Correction** — Filtres `tenant_id` / `calendar_id` réappliqués sur chaque écriture.

### KLT-0205 · N'importe quel membre pouvait agir sur la facturation
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-02.04 · **Réf.** : `7efba30` (2026-10-04)

**Problème** — `get_current_tenant()` ne vérifie que l'existence d'une membership. Un `member` pouvait ouvrir le portail Stripe du propriétaire, déclencher des achats ou remplacer les identifiants PayPal du site pour détourner les acomptes.

**Correction** — Nouvelle dépendance `require_owner_or_admin` sur checkout, portail, achats de domaine, logo, design, `booking-config` et remboursement d'acompte (liste dans CLAUDE.md).

### KLT-0206 · Policies RLS `FOR ALL` sans `WITH CHECK`
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-02.01 · **Réf.** : `7efba30`, migration `071_lock_billing_rls.sql`

**Problème** — Sur `subscription`, `membership` et `design_request`, la clause `USING` autorisait aussi les écritures. Un membre pouvait s'attribuer un plan payant, ou s'ajouter comme owner de n'importe quel tenant (la table `tenant` étant lisible publiquement, elle fournissait la liste des cibles).

**Correction** — Policies réécrites ; écritures réservées au service role.

### KLT-0207 · Repli `app_metadata.tenant_id` sans vérification de membership
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-02.05 · **Réf.** : `7efba30`

**Problème** — Un membre retiré conservait l'accès tant que son JWT restait valide, via le repli sur `app_metadata.tenant_id`.

**Correction** — `require_owner_or_admin` refait la requête membership. Pour les routes protégées par `get_current_tenant` seul, voir KLT-0221.

### KLT-0208 · Permissions CRM et agenda appliquées côté serveur
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-02.04 · **Réf.** : `5571b58` (2026-10-11)

**Problème** — `membership.permissions` n'était appliqué que par le masquage de la navigation.

**Correction** — Dépendances `require_crm_access` (38 usages) et `require_calendar_access` (13 usages) sur les endpoints exclusifs à ces sections. Les lectures partagées avec des widgets toujours visibles (dashboard d'accueil, bannières) ont été laissées ouvertes volontairement.

### KLT-0209 · Plafonds du plan non appliqués (membres, espaces)
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-02.02, US-02.06 · **Réf.** : `6373abd` (2026-10-02)

**Problème** — Les limites `max_team_members` et `max_tenants` étaient décoratives.

**Correction** — Plafonds durs à l'invitation et à la création d'un espace supplémentaire.

### KLT-0210 · Tables sans RLS
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-02.01 · **Réf.** : `e4d7f2b`, migration `026_rls_missing_tables.sql` (2026-05-27)

**Correction** — RLS activée sur `plan_subscription`, `template` (lecture publique) et `app_user` (service role uniquement).

### KLT-0211 · Slug du tenant introuvable à cause de la RLS
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-02.01 · **Réf.** : `6ae048b` (2026-05-09)

**Problème** — Le frontend lisait le slug via une jointure Supabase bloquée par la RLS.

**Correction** — `GET /auth/me/tenant` (backend, service role).

### KLT-0220 · Permissions site, analytics et agents non vérifiées côté serveur
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-02.04 · **Réf.** : non commité (2026-11-03) · `backend/app/middleware/roles.py:131-133`

**Réalisation** — Gardes appliquées sur `sites.py` (écritures + témoignages), `analytics.py` (hors `roi-potential`, lecture des mots-clés et `google/connect`, partagés), `agents.py` et `assistant.py` ; suivi post-RDV sous `calendar`, OCR sous `crm`.

**Constat** — `require_site_builder_access`, `require_analytics_access` et `require_agents_access` sont **définies mais utilisées nulle part**. Un `member` sans la permission `site_builder` peut donc modifier ou dépublier le site, et un membre sans `agents` peut lire et modifier la configuration des agents IA (prompts, tokens Telegram) en appelant directement l'API. Seul le masquage frontend le protège.

**Proposition**
1. Recenser les endpoints exclusifs à chaque section : `sites.py` (sauf lectures utilisées par le dashboard d'accueil), `analytics.py`, `agents.py`, `assistant.py`.
2. Remplacer `get_current_tenant` par la dépendance correspondante.
3. Pour chaque lecture partagée avec un widget global, documenter l'exception dans le code (même règle que KLT-0208).

**Critères de validation** — Un membre avec `permissions = ["crm"]` reçoit 403 sur `PATCH /sites/{id}`, `GET /analytics/summary` et `PATCH /agents/config/{type}` ; le dashboard d'accueil s'affiche toujours pour lui.

**Estimation** — S

### KLT-0221 · Un membre retiré garde l'accès via le repli `app_metadata.tenant_id`
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-02.05 · **Réf.** : non commité (2026-11-03) · `backend/app/middleware/tenant.py:97-100`

**Réalisation** — `get_current_tenant()` vérifie la membership pour le repli `app_metadata.tenant_id` (`middleware/tenant.py`).

**Constat** — Quand la requête ne porte pas de header `X-Tenant-Id`, `get_current_tenant()` renvoie directement `app_metadata.tenant_id` du JWT, **sans requête membership** (« Fallback 1 »). KLT-0207 n'a corrigé que les routes protégées par `require_owner_or_admin`. Sur toutes les autres, un membre retiré, dont l'`app_metadata` porte encore le tenant, garde l'accès en omettant simplement le header.

**Proposition** — Vérifier la membership dans le Fallback 1 (même requête que la branche header), ou supprimer ce repli et ne garder que le Fallback 2 (première membership en base).

**Critères de validation** — Retirer un membre, rejouer son JWT sur `GET /contacts/` sans `X-Tenant-Id` : 403. Un utilisateur légitime sans header continue d'accéder à son espace.

**Estimation** — S
