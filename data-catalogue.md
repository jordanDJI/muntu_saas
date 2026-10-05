# Data Catalogue — Klientys

**Version :** 2.0  
**Date :** 04/10/2026  
**Base de données :** PostgreSQL (Supabase) avec Row-Level Security  
**Portée :** les 64 tables réellement présentes dans le schéma `public`

---

## Comment lire ce document

Les **colonnes, types, contraintes et valeurs par défaut sont lus directement dans la base**
(schéma OpenAPI exposé par PostgREST), pas recopiés à la main. Le **rôle**, les
**utilisations** et les **règles métier** sont rédigés, car une base ne peut pas les dire.

> **Pourquoi une version 2.0.** La version 1.1 décrivait le modèle de conception, qui a
> divergé de la réalité : 15 des 40 tables documentées n'existent pas, et 39 tables réelles
> n'y figuraient pas. Les tables prévues puis abandonnées ou remplacées sont conservées en
> annexe, avec ce qui les remplace.

**Légende des contraintes :**

| Symbole | Signification |
|---|---|
| `PK` | Clé primaire |
| `FK → table.colonne` | Clé étrangère, cible lue dans la base |
| `NN` | Not Null — valeur obligatoire |
| `défaut ...` | Valeur par défaut appliquée par Postgres |

Les index ne sont pas listés ici ; ils se lisent dans les migrations et dans `pg_indexes`.

---

## Index des tables

| # | Table | Catégorie | Colonnes |
|---|---|---|---|
| 1 | [activity_log](#1-activity_log) | Plateforme | 8 |
| 2 | [app_user](#2-app_user) | Plateforme | 10 |
| 3 | [membership](#3-membership) | Plateforme | 6 |
| 4 | [team_invite](#4-team_invite) | Plateforme | 10 |
| 5 | [tenant](#5-tenant) | Plateforme | 24 |
| 6 | [design_request](#6-design_request) | Facturation SaaS | 12 |
| 7 | [logo_request](#7-logo_request) | Facturation SaaS | 14 |
| 8 | [payment_incident](#8-payment_incident) | Facturation SaaS | 10 |
| 9 | [plan_subscription](#9-plan_subscription) | Facturation SaaS | 11 |
| 10 | [stripe_event](#10-stripe_event) | Facturation SaaS | 3 |
| 11 | [subscription](#11-subscription) | Facturation SaaS | 8 |
| 12 | [trial_reminder_log](#12-trial_reminder_log) | Facturation SaaS | 4 |
| 13 | [admin_action_log](#13-admin_action_log) | Opérateur SaaS | 8 |
| 14 | [feature_flag](#14-feature_flag) | Opérateur SaaS | 7 |
| 15 | [support_message](#15-support_message) | Opérateur SaaS | 6 |
| 16 | [support_ticket](#16-support_ticket) | Opérateur SaaS | 9 |
| 17 | [system_config](#17-system_config) | Opérateur SaaS | 3 |
| 18 | [tenant_feature_override](#18-tenant_feature_override) | Opérateur SaaS | 8 |
| 19 | [blog_post](#19-blog_post) | Site vitrine | 15 |
| 20 | [custom_domain](#20-custom_domain) | Site vitrine | 12 |
| 21 | [landing_testimonial](#21-landing_testimonial) | Site vitrine | 10 |
| 22 | [page](#22-page) | Site vitrine | 10 |
| 23 | [service_area](#23-service_area) | Site vitrine | 6 |
| 24 | [service_offer](#24-service_offer) | Site vitrine | 10 |
| 25 | [site](#25-site) | Site vitrine | 23 |
| 26 | [template](#26-template) | Site vitrine | 5 |
| 27 | [testimonial](#27-testimonial) | Site vitrine | 7 |
| 28 | [contact](#28-contact) | CRM | 23 |
| 29 | [contact_activity](#29-contact_activity) | CRM | 6 |
| 30 | [contact_attachment](#30-contact_attachment) | CRM | 8 |
| 31 | [contact_consent](#31-contact_consent) | CRM | 8 |
| 32 | [contact_duplicate_ignore](#32-contact_duplicate_ignore) | CRM | 5 |
| 33 | [contact_field_def](#33-contact_field_def) | CRM | 12 |
| 34 | [contact_import_job](#34-contact_import_job) | CRM | 11 |
| 35 | [contact_reminder](#35-contact_reminder) | CRM | 10 |
| 36 | [contact_tag](#36-contact_tag) | CRM | 5 |
| 37 | [contact_tag_link](#37-contact_tag_link) | CRM | 2 |
| 38 | [pipeline_stage](#38-pipeline_stage) | CRM | 5 |
| 39 | [email_campaign](#39-email_campaign) | Leads & campagnes | 15 |
| 40 | [email_campaign_contact](#40-email_campaign_contact) | Leads & campagnes | 11 |
| 41 | [lead](#41-lead) | Leads & campagnes | 15 |
| 42 | [appointment](#42-appointment) | Agenda | 25 |
| 43 | [availability_slot](#43-availability_slot) | Agenda | 10 |
| 44 | [blocked_period](#44-blocked_period) | Agenda | 8 |
| 45 | [calendar](#45-calendar) | Agenda | 6 |
| 46 | [invoice](#46-invoice) | Facturation tenant | 28 |
| 47 | [invoice_line](#47-invoice_line) | Facturation tenant | 9 |
| 48 | [invoice_sequence](#48-invoice_sequence) | Facturation tenant | 3 |
| 49 | [agent_config](#49-agent_config) | Messagerie & agents IA | 26 |
| 50 | [agent_document](#50-agent_document) | Messagerie & agents IA | 8 |
| 51 | [agent_link](#51-agent_link) | Messagerie & agents IA | 8 |
| 52 | [agent_synthesis](#52-agent_synthesis) | Messagerie & agents IA | 8 |
| 53 | [channel](#53-channel) | Messagerie & agents IA | 6 |
| 54 | [conversation](#54-conversation) | Messagerie & agents IA | 9 |
| 55 | [message](#55-message) | Messagerie & agents IA | 6 |
| 56 | [ocr_summary](#56-ocr_summary) | Messagerie & agents IA | 8 |
| 57 | [google_analytics_connection](#57-google_analytics_connection) | Analytique | 6 |
| 58 | [site_event](#58-site_event) | Analytique | 7 |
| 59 | [tenant_roi_cache](#59-tenant_roi_cache) | Analytique | 5 |
| 60 | [contact_push_subscription](#60-contact_push_subscription) | Notifications | 5 |
| 61 | [notification](#61-notification) | Notifications | 11 |
| 62 | [push_subscription](#62-push_subscription) | Notifications | 5 |
| 63 | [tenant_notification](#63-tenant_notification) | Notifications | 8 |
| 64 | [directory_listing](#64-directory_listing) | Annuaire | 13 |

---

# CATÉGORIE : PLATEFORME

---

## 1. `activity_log`

**Rôle :** Journal des actions faites par les utilisateurs d'un tenant dans son propre espace (à ne pas confondre avec `admin_action_log`, réservé à l'opérateur SaaS).

**Utilisée par :** Fil d'activité du dashboard.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id` | Tenant propriétaire — porte l'isolation des données |
| `action` | TEXT | NN |  |
| `created_at` | TIMESTAMPTZ | défaut `now()` | Date de création |
| `detail` | TEXT | — |  |
| `target_id` | UUID | — |  |
| `target_type` | TEXT | — |  |
| `user_id` | UUID | — | Utilisateur concerné |

---

## 2. `app_user`

**Rôle :** Table utilisateur interne, gérée exclusivement par le backend en service role. L'authentification réelle vit dans Supabase Auth (`auth.users`) : c'est là que résident le mot de passe, l'email vérifié, `app_metadata.is_super_admin` et l'avatar.

**Utilisée par :** Jointures internes. Aucune écriture depuis le navigateur.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `created_at` | TIMESTAMP | NN, défaut `now()` | Date de création |
| `email` | VARCHAR | NN | Adresse email — sert d'identifiant de connexion |
| `first_name` | VARCHAR | NN | Prénom |
| `last_login_at` | TIMESTAMP | — | Dernière connexion — utile pour détecter les comptes inactifs |
| `last_name` | VARCHAR | NN | Nom de famille |
| `password_hash` | VARCHAR | — | Mot de passe hashé (bcrypt ou Argon2) — jamais en clair |
| `phone` | VARCHAR | — | Numéro de téléphone optionnel |
| `status` | VARCHAR | NN, défaut `active` | État du compte : `active`, `inactive`, `banned` |
| `updated_at` | TIMESTAMP | NN, défaut `now()` | Date de dernière modification |

**Règles métier :**

- Ne pas confondre avec `auth.users` : l'avatar, par exemple, est dans `user_metadata` de Supabase Auth, pas ici

---

## 3. `membership`

**Rôle :** Lien utilisateur ↔ tenant, porteur du rôle et des permissions. Un utilisateur peut appartenir à plusieurs espaces (plan Business : jusqu'à 3).

**Utilisée par :** Autorisation de toutes les requêtes API, bascule multi-espaces, gestion d'équipe.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant auquel appartient ce membership |
| `joined_at` | TIMESTAMP | NN, défaut `now()` | Date d'entrée dans l'espace |
| `permissions` | TEXT[] | NN | Sections autorisées — ne s'applique qu'au rôle `member` |
| `role` | VARCHAR | NN, défaut `owner` | `owner` \| `admin` \| `member` \| `secretary` |
| `user_id` | UUID | FK → `app_user.id`, NN | Utilisateur concerné |

**Règles métier :**

- Rôles : `owner` (un seul par tenant), `admin`, `member`, `secretary`
- `permissions text[]` ne s'applique qu'au rôle `member` — `owner` et `admin` ont tout
- Valeurs possibles : `crm`, `calendar`, `site_builder`, `analytics`, `agents`
- Unicité `(tenant_id, user_id)` : le code lit le rôle avec un `.limit(1)` et en dépend
- La colonne de date s'appelle `joined_at` (et non `created_at`)

---

## 4. `team_invite`

**Rôle :** Invitation d'un membre en attente d'acceptation. Les permissions choisies à l'invitation sont transférées vers `membership` à l'acceptation.

**Utilisée par :** Section Membres des paramètres, email d'invitation, inscription par invitation.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `accepted_at` | TIMESTAMPTZ | — | Renseigné = invitation consommée |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `email` | TEXT | NN |  |
| `expires_at` | TIMESTAMPTZ | NN, défaut `(now() + '7 days')` | Fin de validité du jeton |
| `invited_by` | UUID | — |  |
| `permissions` | TEXT[] | NN | Permissions transférées vers `membership` à l'acceptation |
| `role` | VARCHAR | NN, défaut `member` |  |
| `token` | TEXT | NN | Jeton d'invitation à usage unique |

**Règles métier :**

- `token` est à usage unique, `expires_at` borne sa validité
- `accepted_at` renseigné → invitation consommée

---

## 5. `tenant`

**Rôle :** Organisation cliente du SaaS — typiquement un indépendant, une TPE ou une structure locale. Racine de l'isolation des données : presque toutes les autres tables portent un `tenant_id`.

**Utilisée par :** Onboarding, résolution du slug public, panel admin, calcul du plan.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique du tenant |
| `api_key` | TEXT | — | Clé d'API du tenant |
| `business_model` | VARCHAR | NN, défaut `hybrid` | Mode d'activité : `b2c`, `b2b`, `hybrid` |
| `contact_overage_since` | TIMESTAMPTZ | — | Début du dépassement du quota de contacts |
| `contact_retention_months` | INT | — | Durée de conservation des contacts inactifs (RGPD) |
| `country` | VARCHAR | défaut `BE` |  |
| `created_at` | TIMESTAMP | NN, défaut `now()` | Date de création du compte |
| `custom_domain_addon` | BOOL | défaut `False` | Option domaine payée (+5 €/mois) |
| `custom_domain_addon_sub_id` | TEXT | — | Abonnement Stripe de l'option — permet de la désactiver |
| `invoice_settings` | JSONB | — | Paramètres de facturation du tenant vers ses clients |
| `is_active` | BOOL | défaut `True` |  |
| `locale` | VARCHAR | défaut `fr` |  |
| `name` | VARCHAR | NN | Nom affiché de l'organisation |
| `plan_id` | UUID | FK → `plan_subscription.id` |  |
| `sector` | VARCHAR | — |  |
| `slug` | VARCHAR | NN | Identifiant d'URL publique : `klientys.co/{slug}` |
| `status` | VARCHAR | NN, défaut `trial` | État du compte : `active`, `suspended`, `trial`, `churned` |
| `stripe_customer_id` | VARCHAR | — | Client Stripe, nécessaire au portail de facturation |
| `suspended_at` | TIMESTAMPTZ | — | Suspension par l'opérateur — prime sur l'abonnement |
| `suspended_reason` | TEXT | — | Motif de suspension |
| `timezone` | VARCHAR | défaut `Europe/Brussels` |  |
| `trend_keywords` | TEXT[] | — | Mots-clés Google Trends propres au tenant |
| `trial_extended_until` | TIMESTAMPTZ | — | Essai prolongé au-delà des 14 jours |
| `updated_at` | TIMESTAMP | NN, défaut `now()` | Date de dernière modification |

**Règles métier :**

- `slug` est unique et sert d'URL publique : `klientys.co/{slug}`
- `suspended_at` renseigné → le tenant est suspendu, quel que soit son abonnement
- `trial_extended_until` prolonge la période d'essai au-delà des 14 jours par défaut
- `custom_domain_addon` / `custom_domain_addon_sub_id` : option domaine à 5 €/mois, désactivée automatiquement à la résiliation de l'abonnement Stripe correspondant

---

# CATÉGORIE : FACTURATION SAAS

---

## 6. `design_request`

**Rôle :** Demande de refonte de design réalisée par l'équipe Klientys. Incluse au plan Business ; `is_additional` marque les demandes supplémentaires, facturées à l'unité.

**Utilisée par :** Paramètres (achats ponctuels), support, suivi par l'opérateur.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id` | Tenant propriétaire — porte l'isolation des données |
| `admin_notes` | TEXT | — |  |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `is_additional` | BOOL | NN, défaut `False` |  |
| `message` | TEXT | — |  |
| `site_id` | UUID | FK → `site.id` | Site concerné |
| `site_name` | TEXT | — |  |
| `status` | TEXT | NN, défaut `pending` |  |
| `support_ticket_id` | UUID | FK → `support_ticket.id` |  |
| `tenant_name` | TEXT | — |  |
| `updated_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de dernière modification |

---

## 7. `logo_request`

**Rôle :** Demande de création de logo, prestation ponctuelle payante. Le brief est collecté par une conversation IA avant paiement Stripe.

**Utilisée par :** Site-builder (tunnel de brief), paiement Stripe, suivi par l'opérateur.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id` | Tenant propriétaire — porte l'isolation des données |
| `admin_notes` | TEXT | — |  |
| `brief` | JSONB | NN | Brief structuré produit par la conversation IA |
| `chat_history` | JSONB | NN |  |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `delivered_at` | TIMESTAMPTZ | — |  |
| `price_eur` | NUMERIC | NN |  |
| `price_tier` | TEXT | NN, défaut `standard` | `essentiel` (149 €) \| `standard` (299 €) \| `premium` (499 €) |
| `status` | TEXT | NN, défaut `pending_payment` | `pending_payment` → `paid` → `in_progress` → `done` |
| `stripe_checkout_session_id` | TEXT | — |  |
| `stripe_payment_intent_id` | TEXT | — |  |
| `tenant_name` | TEXT | — |  |
| `updated_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de dernière modification |

**Règles métier :**

- Tarifs : Essentiel 149 € · Standard 299 € · Premium 499 €
- Statuts : `pending_payment` → `paid` → `in_progress` → `done`
- Le passage à `paid` est fait par le webhook Stripe, jamais par le client

---

## 8. `payment_incident`

**Rôle :** Trace d'un encaissement qui n'a pas abouti à une livraison : enregistrement de domaine OVH échoué après paiement, acompte à rembourser, remboursement raté, litige bancaire. Existe parce qu'un tel échec ne laissait avant qu'une ligne de log.

**Utilisée par :** Webhook Stripe, capture d'acompte PayPal, service de remboursement. Lecture par l'opérateur.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id` | Tenant propriétaire — porte l'isolation des données |
| `amount` | NUMERIC | — |  |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `currency` | TEXT | — |  |
| `detail` | TEXT | — | Message d'erreur ou contexte |
| `kind` | TEXT | NN | Nature de l'incident (`domain_purchase_failed`, `deposit_booking_failed`…) |
| `provider` | TEXT | NN | `stripe` ou `paypal` |
| `reference` | TEXT | — | Identifiant côté prestataire (session, order, payment intent) |
| `refunded` | BOOL | NN, défaut `False` | L'argent a-t-il été rendu automatiquement |

**Règles métier :**

- `kind` : `domain_purchase_failed`, `deposit_booking_failed`, `deposit_amount_mismatch`, `refund_failed`, `charge_disputed`…
- `refunded` indique si l'argent a été rendu automatiquement
- **Toute ligne ici mérite un examen** : elle signale un client qui a payé sans recevoir

---

## 9. `plan_subscription`

**Rôle :** Formules tarifaires proposées aux tenants : Essentiel, Pro, Business. Référence des prix et des quotas.

**Utilisée par :** Page Abonnement, création de session Stripe Checkout, calcul du plan et des features.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `chatbot_enabled` | BOOL | NN, défaut `False` | Hérité du modèle d'origine — non lu par le code actuel |
| `features` | JSONB | — | Quotas en JSONB, **surclassés par `PLAN_FEATURES` dans le code** |
| `max_messages` | INT | NN, défaut `200` | Hérité du modèle d'origine — non lu par le code actuel |
| `max_sites` | INT | NN, défaut `1` | Hérité du modèle d'origine — non lu par le code actuel |
| `max_users` | INT | NN, défaut `1` | Hérité du modèle d'origine — non lu par le code actuel |
| `name` | VARCHAR | NN | Nom du plan |
| `price_eur` | NUMERIC | NN, défaut `0` | LEGACY — synchronisée par trigger, ne plus lire |
| `price_monthly` | NUMERIC | NN | **Prix de référence** affiché au client |
| `roi_enabled` | BOOL | NN, défaut `False` | Hérité du modèle d'origine — non lu par le code actuel |
| `stripe_price_id` | VARCHAR | — | Prix Stripe réellement facturé (`price_...`) |

**Règles métier :**

- **`price_monthly` est la colonne de référence.** `price_eur` est conservée synchronisée par le trigger `sync_plan_price` (migration 073) pour les lectures historiques — ne plus la lire
- `stripe_price_id` relie le plan au prix Stripe réellement facturé
- `features` (JSONB) est **surclassé par le code** : `PLAN_FEATURES` dans `services/subscription.py` fait foi, les clés présentes seulement en base sont conservées. Les valeurs figées par la migration 019 étaient devenues fausses
- Tarifs : Essentiel 29,90 € · Pro 59,90 € · Business 99,90 €
- `max_sites`, `max_users`, `max_messages`, `chatbot_enabled`, `roi_enabled` sont des colonnes héritées du modèle d'origine, non lues par le code actuel

---

## 10. `stripe_event`

**Rôle :** Déduplication des webhooks Stripe. Stripe relivre un événement jusqu'à trois jours en cas d'erreur ; sans cette table, un retry renvoyait un reçu au client et rejouait la logique métier.

**Utilisée par :** Webhook Stripe uniquement. Table interne, service role exclusivement.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | TEXT | PK, NN | Identifiant Stripe de l'événement (`evt_...`) — c'est lui qui déduplique |
| `processed_at` | TIMESTAMPTZ | NN, défaut `now()` | Date du premier traitement |
| `type` | TEXT | NN | Type d'événement Stripe reçu |

**Règles métier :**

- `id` est l'identifiant Stripe (`evt_...`), clé primaire — c'est lui qui fait la dédup
- Si la table est inaccessible, le webhook traite l'événement quand même : perdre une souscription est plus grave qu'un doublon

---

## 11. `subscription`

**Rôle :** Abonnement Stripe d'un tenant. Une seule ligne par tenant, mise à jour par le webhook Stripe. Son absence ne signifie pas « pas de service » : la période d'essai de 14 jours est calculée depuis `tenant.created_at`, sans ligne ici.

**Utilisée par :** Calcul du plan et des features, portail de facturation, panel admin, MRR.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant abonné (unique : un seul abonnement par tenant) |
| `end_date` | DATE | — | Date de fin (null si actif indéfiniment) |
| `past_due_since` | TIMESTAMPTZ | — | Début de l'impayé — base du calcul des 7 jours de grâce |
| `plan_id` | UUID | FK → `plan_subscription.id`, NN | Plan souscrit |
| `start_date` | DATE | NN, défaut `CURRENT_DATE` | Date de début d'abonnement |
| `status` | VARCHAR | NN, défaut `trialing` | `trialing` \| `active` \| `past_due` \| `canceled` \| `incomplete` \| `paused` |
| `stripe_subscription_id` | VARCHAR | — | Abonnement Stripe (`sub_...`). NULL = activation manuelle |

**Règles métier :**

- Unicité sur `tenant_id` — l'upsert du webhook Stripe en dépend (`on_conflict`)
- Statuts : `trialing`, `active`, `past_due`, `canceled`, `incomplete`, `paused`
- `past_due` n'interrompt pas le service : **7 jours de grâce** calculés depuis `past_due_since`, puis bascule en essai expiré. Stripe relance la carte pendant deux à trois semaines
- `stripe_subscription_id` NULL = activation manuelle par l'opérateur (`force-activate`), pas un paiement
- Les colonnes de dates s'appellent `start_date` / `end_date`

---

## 12. `trial_reminder_log`

**Rôle :** Marque les rappels d'expiration d'essai déjà envoyés (J-7, J-3, J-1), pour qu'un tenant ne reçoive pas deux fois le même.

**Utilisée par :** Tâche planifiée quotidienne de rappel d'essai.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `days_before` | INT | NN | Jalon du rappel : 7, 3 ou 1 jour avant expiration |
| `sent_at` | TIMESTAMPTZ | défaut `now()` | Date d'envoi effectif |

---

# CATÉGORIE : OPÉRATEUR SAAS

---

## 13. `admin_action_log`

**Rôle :** Piste d'audit de toutes les actions de l'opérateur SaaS sur les tenants : suspension, activation gratuite, prolongation d'essai, impersonation, suppression.

**Utilisée par :** Panel admin (page Log), audit de sécurité.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `action_type` | TEXT | NN | Action réalisée (`force_activate`, `suspend`, `impersonate`…) |
| `admin_email` | TEXT | — |  |
| `admin_user_id` | UUID | NN |  |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `payload` | JSONB | — | Contexte de l'action, en JSONB |
| `target_tenant_id` | UUID | FK → `tenant.id` |  |
| `target_tenant_name` | TEXT | — |  |

**Règles métier :**

- Première entrée : juin 2026. Une action antérieure à cette date n'a donc **aucune trace** ici, ce qui n'est pas un signe d'anomalie
- `_log()` doit être appelé **avant** une suppression de tenant : la clé étrangère `target_tenant_id` interdit d'insérer après

---

## 14. `feature_flag`

**Rôle :** Interrupteurs globaux de fonctionnalités, appliqués à tous les tenants. Un flag désactivé agit comme coupe-circuit, y compris sur les quotas numériques (mis à 0).

**Utilisée par :** Calcul du plan, page Config du panel admin.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `description` | TEXT | — |  |
| `enabled` | BOOL | NN, défaut `False` |  |
| `key` | TEXT | NN |  |
| `name` | TEXT | NN |  |
| `updated_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de dernière modification |

---

## 15. `support_message`

**Rôle :** Message d'un fil de support, côté tenant ou côté opérateur.

**Utilisée par :** Espace support, notifications.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `body` | TEXT | NN |  |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `sender` | TEXT | NN |  |
| `ticket_id` | UUID | FK → `support_ticket.id`, NN |  |

---

## 16. `support_ticket`

**Rôle :** Demande d'assistance ouverte par un tenant.

**Utilisée par :** Espace support du dashboard, panel admin.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `priority` | TEXT | NN, défaut `normal` |  |
| `resolved_at` | TIMESTAMPTZ | — |  |
| `status` | TEXT | NN, défaut `open` |  |
| `subject` | TEXT | NN |  |
| `ticket_type` | TEXT | NN, défaut `general` |  |
| `updated_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de dernière modification |

---

## 17. `system_config`

**Rôle :** Configuration système en clé/valeur JSONB : mode maintenance, message de maintenance, mots-clés Google Trends par secteur, libellés de secteurs.

**Utilisée par :** Service Trends, page Config du panel admin.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `key` | TEXT | PK, NN | Clé de configuration (`maintenance_mode`, `sector_keywords`…) |
| `updated_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de dernière modification |
| `value` | JSONB | NN | Valeur en JSONB |

**Règles métier :**

- Les mots-clés secteurs sont éditables sans redéploiement, avec repli sur les valeurs codées en dur

---

## 18. `tenant_feature_override`

**Rôle :** Dérogation par tenant sur une fonctionnalité, indépendamment de son plan. Priorité maximale : écrase le plan et les flags globaux.

**Utilisée par :** Calcul du plan, détail tenant du panel admin.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `enabled` | BOOL | NN |  |
| `expires_at` | TIMESTAMPTZ | — |  |
| `feature_key` | TEXT | NN | Clé de la fonctionnalité dérogée |
| `note` | TEXT | — |  |
| `value_int` | INT | — | Quota précis, au lieu d'un simple on/off |

**Règles métier :**

- Usage typique : activer `analytics` pour un bêta-testeur en essai expiré
- `value_int` permet de fixer un quota précis plutôt qu'un simple on/off

---

# CATÉGORIE : SITE VITRINE

---

## 19. `blog_post`

**Rôle :** Article du blog marketing de Klientys (et non du site d'un tenant). Multilingue.

**Utilisée par :** Pages `/blog`, sitemap, panel admin (page Contenu), agent de contenu automatisé.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `body_html` | TEXT | — |  |
| `category` | TEXT | — |  |
| `created_at` | TIMESTAMPTZ | défaut `now()` | Date de création |
| `description` | TEXT | — |  |
| `lang` | TEXT | NN, défaut `fr` | `fr` \| `en` \| `de` \| `nl` |
| `metier` | TEXT | — |  |
| `published_at` | DATE | — |  |
| `reading_minutes` | INT | NN, défaut `5` |  |
| `slug` | TEXT | NN |  |
| `status` | TEXT | NN, défaut `draft` | `draft` ou `published` |
| `title` | TEXT | NN |  |
| `translated_from` | UUID | FK → `blog_post.id` | Article source, si généré par traduction |
| `translation_group_id` | UUID | NN, défaut `gen_random_uuid()` | Relie les versions linguistiques d'un même article |
| `updated_at` | TIMESTAMPTZ | défaut `now()` | Date de dernière modification |

**Règles métier :**

- Unicité sur `(slug, lang)`, pas sur `slug` seul
- `translation_group_id` relie les versions linguistiques d'un même article
- Toute traduction est créée en `draft` : une traduction IA est relue avant publication

---

## 20. `custom_domain`

**Rôle :** Domaine personnalisé d'un tenant, connecté depuis l'extérieur ou acheté via OVH.

**Utilisée par :** Paramètres (domaine), routage du middleware frontend, webhook Stripe.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `auto_renew` | BOOL | défaut `True` | Renouvellement automatique OVH |
| `created_at` | TIMESTAMPTZ | défaut `now()` | Date de création |
| `dns_record_name` | TEXT | défaut `www` |  |
| `dns_record_type` | TEXT | défaut `CNAME` |  |
| `dns_record_value` | TEXT | défaut `cname.vercel-dns.com` |  |
| `domain` | TEXT | NN |  |
| `source` | TEXT | NN, défaut `external` | `external` ou `ovh_purchased` |
| `status` | TEXT | NN, défaut `pending` | `pending` \| `active` \| `error` |
| `vercel_status` | TEXT | — | État de configuration rapporté par Vercel |
| `verified_at` | TIMESTAMPTZ | — | Date de validation DNS + SSL |

**Règles métier :**

- `status` : `pending` → `active` quand le DNS est propagé **et** le SSL valide
- `source` : `external` (le tenant possède le domaine) ou `ovh_purchased`
- Unicité sur `tenant_id` **et** sur `domain` : un domaine ne peut pointer qu'un espace
- L'achat OVH n'est déclenché qu'après confirmation du paiement Stripe

---

## 21. `landing_testimonial`

**Rôle :** Témoignage affiché sur la landing page de Klientys.

**Utilisée par :** Landing page, panel admin (page Contenu).

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `active` | BOOL | NN, défaut `True` |  |
| `bg_color` | TEXT | NN, défaut `rgba(13,75,88,.4)` |  |
| `created_at` | TIMESTAMPTZ | défaut `now()` | Date de création |
| `initials` | TEXT | — |  |
| `name` | TEXT | NN |  |
| `role` | TEXT | — |  |
| `sort_order` | INT | NN, défaut `0` |  |
| `text` | TEXT | NN |  |
| `text_color` | TEXT | NN, défaut `var(--l-teal-xl)` |  |

---

## 22. `page`

**Rôle :** Page d'un site. Table héritée du modèle d'origine : le site-builder actuel gère les pages via `site_style.pages_enabled`, pas par des lignes ici.

**Utilisée par :** Aucun usage dans le code actuel.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `audience_type` | VARCHAR | NN, défaut `all` | Public de la page : `all`, `b2c`, `b2b` |
| `seo_description` | TEXT | — | Meta description pour les moteurs de recherche |
| `seo_title` | VARCHAR | — | Titre SEO (balise `<title>`) — si null, utilise `title` |
| `site_id` | UUID | FK → `site.id`, NN | Site auquel appartient la page |
| `slug` | VARCHAR | NN | Chemin URL de la page |
| `status` | VARCHAR | NN, défaut `draft` | État : `draft`, `published` |
| `title` | VARCHAR | NN | Titre de la page |
| `type` | VARCHAR | NN, défaut `content` | Type : `home`, `services`, `about`, `contact`, `b2b_partners`, `legal`, `content` |
| `updated_at` | TIMESTAMP | NN, défaut `now()` | Date de dernière modification |

---

## 23. `service_area`

**Rôle :** Zone géographique d'intervention du tenant.

**Utilisée par :** Site-builder, site public, annuaire, potentiel de demande locale.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `city` | VARCHAR | — | Nom de la ville |
| `country` | VARCHAR | NN, défaut `BE` | Code pays ISO 3166-1 alpha-2 |
| `postal_code` | VARCHAR | — | Code postal |
| `region` | VARCHAR | — | Région ou province |
| `site_id` | UUID | FK → `site.id`, NN | Site concerné |

**Règles métier :**

- Lisible publiquement uniquement pour les sites publiés (migration 069)

---

## 24. `service_offer`

**Rôle :** Prestation proposée par le tenant : nom, description, durée, prix, photos.

**Utilisée par :** Site-builder, site public, choix de prestation à la réservation, facturation.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `category` | TEXT | — |  |
| `description` | TEXT | — | Description détaillée |
| `duration_min` | INT | — |  |
| `image_url` | TEXT | — |  |
| `name` | VARCHAR | NN | Nom du service |
| `photos` | TEXT[] | — |  |
| `price_eur` | NUMERIC | — |  |
| `service_type` | TEXT | NN, défaut `service` |  |
| `site_id` | UUID | FK → `site.id`, NN | Site exposant ce service |

---

## 25. `site`

**Rôle :** Site vitrine d'un tenant : contenu, coordonnées, préférences visuelles et config de réservation. Une ligne par tenant en pratique.

**Utilisée par :** Site-builder, site public, formulaire de réservation, acompte PayPal.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Propriétaire du site |
| `absence_message` | TEXT | — | Message affiché pendant l'absence |
| `absence_mode` | BOOL | NN, défaut `False` | Si `true` : calendrier bloqué + bandeau d'absence affiché |
| `address` | TEXT | — |  |
| `audience_mode` | VARCHAR | NN, défaut `hybrid` | Public cible principal : `b2c`, `b2b`, `hybrid` |
| `coverage_zones` | JSONB | — |  |
| `created_at` | TIMESTAMP | NN, défaut `now()` | Date de création |
| `default_language` | VARCHAR | NN, défaut `fr` | Langue par défaut du site |
| `description` | TEXT | — |  |
| `domain` | VARCHAR | — | Nom de domaine personnalisé (ex: muntu-cura.be). Si null, utilise le sous-domaine par défaut |
| `email_contact` | VARCHAR | — |  |
| `paypal_client_secret` | TEXT | — | **Jamais exposé par l'API publique** |
| `phone` | VARCHAR | — |  |
| `published_snapshot` | JSONB | — |  |
| `site_style` | JSONB | — | Préférences visuelles et structurelles, sans migration |
| `social_links` | JSONB | — |  |
| `status` | VARCHAR | NN, défaut `draft` | `draft` ou `published` |
| `tagline` | VARCHAR | — |  |
| `template_id` | UUID | FK → `template.id` | Template utilisé pour initialiser le site |
| `title` | VARCHAR | NN | Titre du site (affiché dans l'onglet navigateur) |
| `updated_at` | TIMESTAMP | NN, défaut `now()` | Date de dernière modification |
| `values_list` | JSONB | — |  |

**Règles métier :**

- `status` : `draft` ou `published`. Le site public exige `published`, sauf en mode preview (`?preview=true`)
- `site_style` (JSONB) porte sans migration : couleurs, police, pages activées, photos, adresse détaillée, tracking, questions de réservation, config d'acompte
- **`paypal_client_secret` ne doit jamais sortir de l'API publique.** `public.py` le retire explicitement, et `SiteOut` ne le déclare pas

---

## 26. `template`

**Rôle :** Modèle de site pré-configuré par type d'activité, proposé à la création.

**Utilisée par :** Création de site.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `active` | BOOL | NN, défaut `True` | Si `false`, le template n'est plus proposé aux nouveaux tenants |
| `business_type` | VARCHAR | NN | Code métier |
| `name` | VARCHAR | NN | Nom affiché |
| `version` | VARCHAR | NN, défaut `1.0` | Version du template (pour gestion des mises à jour) |

---

## 27. `testimonial`

**Rôle :** Témoignage client affiché sur le site vitrine du tenant.

**Utilisée par :** Site-builder, site public.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique |
| `author_name` | VARCHAR | NN |  |
| `author_role` | VARCHAR | — |  |
| `content` | TEXT | NN |  |
| `created_at` | TIMESTAMP | défaut `now()` | Date de création |
| `rating` | SMALLINT | défaut `5` |  |
| `site_id` | UUID | FK → `site.id`, NN | Site concerné |

---

# CATÉGORIE : CRM

---

## 28. `contact`

**Rôle :** Personne physique ayant interagi avec le tenant : patient, client, prospect. Cœur du CRM.

**Utilisée par :** CRM, réservation publique, campagnes, relances, agents IA, facturation.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire |
| `agent_memory` | TEXT | — |  |
| `anonymized_at` | TIMESTAMPTZ | — |  |
| `category` | TEXT | — |  |
| `company_name` | VARCHAR | — | Nom de la société si contact professionnel |
| `contact_type` | VARCHAR | NN, défaut `individual` | Type : `individual` (B2C), `professional` (représentant B2B) |
| `created_at` | TIMESTAMP | NN, défaut `now()` | Date de création |
| `custom_fields` | JSONB | NN | Champs configurables, **map plate** `{field_key: value}` |
| `deleted_at` | TIMESTAMP | — | Soft delete (droit à l'oubli RGPD) |
| `deletion_requested_at` | TIMESTAMPTZ | — |  |
| `email` | VARCHAR | — | Adresse email |
| `first_name` | VARCHAR | — | Prénom |
| `last_interaction_at` | TIMESTAMPTZ | défaut `now()` |  |
| `last_name` | VARCHAR | — | Nom de famille |
| `marketing_opt_out` | BOOL | NN, défaut `False` |  |
| `notes` | TEXT | — |  |
| `phone` | VARCHAR | — | Numéro de téléphone |
| `segment` | TEXT | — |  |
| `source` | VARCHAR | — |  |
| `telegram_chat_id` | BIGINT | — |  |
| `unsubscribe_token` | UUID | défaut `gen_random_uuid()` |  |
| `updated_at` | TIMESTAMP | NN, défaut `now()` | Date de dernière modification |

**Règles métier :**

- Seuls `first_name`, `last_name`, `email`, `phone` sont de vraies colonnes indispensables ; le reste de la fiche est configurable par tenant
- `custom_fields` (JSONB) est une **map plate** `{field_key: value}`, sans sous-objets
- `custom_fields.photo_path` est un chemin dans un bucket privé, jamais une URL publique

---

## 29. `contact_activity`

**Rôle :** Événements de la vie d'un contact, pour alimenter sa chronologie.

**Utilisée par :** Fiche contact (onglet activité).

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `contact_id` | UUID | FK → `contact.id`, NN | Contact concerné |
| `content` | TEXT | NN |  |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `type` | TEXT | NN, défaut `note` |  |

---

## 30. `contact_attachment`

**Rôle :** Pièce jointe d'une fiche contact, stockée dans un bucket privé.

**Utilisée par :** Fiche contact. Quota par plan.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `contact_id` | UUID | FK → `contact.id`, NN | Contact concerné |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `file_name` | TEXT | NN |  |
| `file_size` | INT | NN |  |
| `mime_type` | TEXT | — |  |
| `storage_path` | TEXT | NN |  |

---

## 31. `contact_consent`

**Rôle :** Consentement RGPD d'un contact, par canal de communication, avec son origine.

**Utilisée par :** Formulaire public, campagnes email, relances, export RGPD.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `channel` | TEXT | NN | Canal concerné (`email`, `telephone`, `sms`…) |
| `consent_text` | TEXT | — |  |
| `contact_id` | UUID | FK → `contact.id`, NN | Contact concerné |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `granted` | BOOL | NN | Consentement accordé ou refusé |
| `source` | TEXT | NN | Origine du consentement (`public_form`, `import`…) |

**Règles métier :**

- Un consentement refusé ou révoqué bloque l'envoi sur ce canal

---

## 32. `contact_duplicate_ignore`

**Rôle :** Paires de contacts que le tenant a explicitement déclarées comme non doublons, pour que la détection cesse de les proposer.

**Utilisée par :** Détection de doublons du CRM.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `match_type` | TEXT | NN |  |
| `match_value` | TEXT | NN |  |

---

## 33. `contact_field_def`

**Rôle :** Définition des champs de la fiche contact, configurable par tenant : champs de base fournis par Klientys et champs personnalisés créés par le tenant.

**Utilisée par :** Paramètres (champs contact), fiche contact, import/export CSV et Excel.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `enabled` | BOOL | NN, défaut `True` |  |
| `field_key` | TEXT | NN | Clé technique — `cf_<8 hex>` pour un champ personnalisé |
| `field_type` | TEXT | NN | `text` \| `phone` \| `email` \| `date` \| `number` \| `select` |
| `is_base` | BOOL | NN, défaut `False` | Champ prédéfini par Klientys — affichage seulement |
| `label` | TEXT | NN |  |
| `options` | JSONB | — | Valeurs proposées pour un champ `select` |
| `position` | INT | NN, défaut `0` | Ordre d'affichage |
| `required` | BOOL | NN, défaut `False` |  |
| `storage_mode` | TEXT | NN | `column` (colonne de `contact`) ou `jsonb` (`custom_fields`) |

**Règles métier :**

- `storage_mode` : `column` (vraie colonne de `contact`) ou `jsonb` (`custom_fields`)
- `first_name`, `last_name`, `email`, `phone` sont verrouillés : ni désactivables, ni supprimables
- Le catalogue de champs de base est créé paresseusement au premier appel de l'API, sans migration de backfill
- Les champs personnalisés ont un `field_key` généré serveur (`cf_<8 hex>`)

---

## 34. `contact_import_job`

**Rôle :** Suivi d'un import de contacts par fichier : avancement, lignes traitées, erreurs.

**Utilisée par :** Import CSV/Excel, bandeau de progression du dashboard.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `created_count` | INT | — |  |
| `error_message` | TEXT | — |  |
| `errors` | JSONB | — |  |
| `filename` | TEXT | — |  |
| `finished_at` | TIMESTAMPTZ | — |  |
| `notice` | TEXT | — |  |
| `skipped_count` | INT | — |  |
| `status` | TEXT | NN, défaut `processing` |  |

---

## 35. `contact_reminder`

**Rôle :** Relance programmée sur un contact, manuelle ou automatique.

**Utilisée par :** Page Rappels, tâche planifiée d'envoi quotidien.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `auto_send` | BOOL | NN, défaut `False` |  |
| `contact_id` | UUID | FK → `contact.id`, NN | Contact concerné |
| `created_at` | TIMESTAMPTZ | défaut `now()` | Date de création |
| `done` | BOOL | NN, défaut `False` |  |
| `due_date` | DATE | NN |  |
| `note` | TEXT | — |  |
| `reminder_type` | TEXT | NN, défaut `custom` |  |
| `sent_at` | TIMESTAMPTZ | — | Date d'envoi effectif |

---

## 36. `contact_tag`

**Rôle :** Étiquette de segmentation définie par le tenant.

**Utilisée par :** CRM, campagnes.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `color` | VARCHAR | NN, défaut `blue` |  |
| `created_at` | TIMESTAMPTZ | défaut `now()` | Date de création |
| `name` | VARCHAR | NN |  |

---

## 37. `contact_tag_link`

**Rôle :** Association contact ↔ étiquette.

**Utilisée par :** CRM, campagnes.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `contact_id` | UUID | PK, FK → `contact.id`, NN | Contact concerné |
| `tag_id` | UUID | PK, FK → `contact_tag.id`, NN |  |

---

## 38. `pipeline_stage`

**Rôle :** Étape du pipeline commercial du tenant.

**Utilisée par :** Vue pipeline des leads.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire |
| `is_final` | BOOL | NN, défaut `False` | Si `true`, cette étape clôt le pipeline (converti ou perdu) |
| `name` | VARCHAR | NN | Nom de l'étape |
| `position` | INT | NN | Ordre d'affichage (de gauche à droite dans le kanban) |

---

# CATÉGORIE : LEADS & CAMPAGNES

---

## 39. `email_campaign`

**Rôle :** Campagne email adressée à une sélection de contacts.

**Utilisée par :** Page Campagnes. Réservée aux plans Pro et Business.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `body` | TEXT | NN |  |
| `click_count` | INT | NN, défaut `0` |  |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `failed_count` | INT | NN, défaut `0` |  |
| `name` | TEXT | NN |  |
| `open_count` | INT | NN, défaut `0` |  |
| `segment` | TEXT | NN, défaut `all` |  |
| `sent_at` | TIMESTAMPTZ | NN, défaut `now()` | Date d'envoi effectif |
| `sent_count` | INT | NN, défaut `0` |  |
| `status` | TEXT | NN, défaut `sent` |  |
| `subject` | TEXT | NN |  |
| `tag_id` | UUID | FK → `contact_tag.id` |  |
| `unsubscribed_count` | INT | NN, défaut `0` |  |

---

## 40. `email_campaign_contact`

**Rôle :** Destinataire d'une campagne et suivi de son état : envoyé, ouvert, cliqué, désabonné, en erreur.

**Utilisée par :** Campagnes, statistiques, lien de désabonnement.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `campaign_id` | UUID | FK → `email_campaign.id`, NN |  |
| `click_count` | INT | NN, défaut `0` |  |
| `clicked_at` | TIMESTAMPTZ | — |  |
| `contact_id` | UUID | FK → `contact.id`, NN | Contact concerné |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `open_count` | INT | NN, défaut `0` |  |
| `opened_at` | TIMESTAMPTZ | — |  |
| `token` | UUID | NN, défaut `gen_random_uuid()` |  |
| `unsubscribed_at` | TIMESTAMPTZ | — |  |

---

## 41. `lead`

**Rôle :** Demande entrante : formulaire de contact, réservation publique, message d'un agent IA.

**Utilisée par :** Page Leads, notifications, statistiques de conversion.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire |
| `audience_type` | VARCHAR | NN, défaut `b2c` | Type de demande : `b2c`, `b2b` |
| `channel_id` | UUID | FK → `channel.id` |  |
| `contact_id` | UUID | FK → `contact.id`, NN | Contact à l'origine de la demande |
| `created_at` | TIMESTAMP | NN, défaut `now()` | Date de création |
| `internal_note` | TEXT | — |  |
| `notes` | TEXT | — |  |
| `pipeline_stage_id` | UUID | FK → `pipeline_stage.id` | Étape actuelle dans le pipeline |
| `priority` | VARCHAR | NN, défaut `normal` | Priorité : `low`, `normal`, `high`, `urgent` |
| `request_type` | VARCHAR | NN, défaut `appointment` | Nature de la demande : `appointment`, `information`, `quote`, `partnership`, `other` |
| `service_offer_id` | UUID | FK → `service_offer.id` | Service concerné par la demande |
| `source` | VARCHAR | NN, défaut `site_form` | Canal d'origine : `site_form`, `whatsapp`, `telegram`, `email`, `phone` |
| `status` | VARCHAR | NN, défaut `new` | État : `new`, `in_progress`, `to_call`, `scheduled`, `converted`, `lost`, `archived` |
| `updated_at` | TIMESTAMP | NN, défaut `now()` | Date de dernière modification |

**Règles métier :**

- **Plusieurs leads par contact** : aucune contrainte d'unicité, chaque demande crée une ligne
- Un lead issu d'un RDV en attente a un pipeline restreint : `new` → `confirmed` / `refused`

---

# CATÉGORIE : AGENDA

---

## 42. `appointment`

**Rôle :** Rendez-vous entre le tenant et un contact, créé depuis le dashboard, le site public ou un agent conversationnel.

**Utilisée par :** Calendrier, emails de confirmation et de rappel, facturation, acomptes.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `audience_type` | VARCHAR | NN, défaut `b2c` | Nature : `b2c`, `b2b` |
| `cal_booking_id` | VARCHAR | — |  |
| `calendar_id` | UUID | FK → `calendar.id`, NN | Agenda dans lequel le rendez-vous est planifié |
| `contact_id` | UUID | FK → `contact.id`, NN | Contact concerné |
| `conversation_summary` | TEXT | — | Résumé IA de la conversation ayant mené au RDV (agent Telegram) |
| `created_at` | TIMESTAMP | NN, défaut `now()` | Date de création |
| `custom_answers` | JSONB | — | Réponses aux questions du formulaire de réservation |
| `deposit_amount` | NUMERIC | — | Montant de l'acompte encaissé |
| `deposit_capture_id` | TEXT | — | Capture PayPal — requise pour rembourser |
| `deposit_currency` | TEXT | — | Devise de l'acompte |
| `deposit_paypal_order_id` | TEXT | — | Order PayPal — **unique**, un order ne finance qu'un RDV |
| `deposit_refund_id` | TEXT | — | Remboursement PayPal émis |
| `deposit_refunded_at` | TIMESTAMPTZ | — | Date du remboursement |
| `deposit_status` | TEXT | défaut `none` | `none` \| `pending_payment` \| `paid` \| `refunded` \| `refund_failed` |
| `end_at` | TIMESTAMP | NN | Fin — **heure locale naïve du tenant** |
| `lead_id` | UUID | FK → `lead.id` | Lead converti en rendez-vous |
| `notes` | TEXT | — |  |
| `party_size` | INT | NN, défaut `1` | Nombre de personnes dans la réservation |
| `reminder_sent_at` | TIMESTAMPTZ | — | Date d'envoi du rappel 24 h |
| `scheduled_at` | TIMESTAMP | NN | Début — **heure locale naïve du tenant** |
| `service_offer_id` | UUID | FK → `service_offer.id` | Service concerné |
| `status` | VARCHAR | NN, défaut `pending` | `pending` \| `pending_payment` \| `confirmed` \| `cancelled` |
| `type` | VARCHAR | NN, défaut `b2c_appointment` | Type : `b2c_appointment`, `b2b_coordination`, `phone_call`, `home_visit` |
| `updated_at` | TIMESTAMP | NN, défaut `now()` | Date de dernière modification |

**Règles métier :**

- **Invariant de stockage : heure locale naïve du tenant** (`YYYY-MM-DDTHH:MM:SS`, sans fuseau). La réservation publique convertit avant écriture
- Statuts : `pending`, `pending_payment`, `confirmed`, `cancelled`
- `pending_payment` : acompte attendu. Au-delà de 30 minutes le créneau redevient réservable, et une tâche planifiée annule la ligne
- `deposit_status` : `none` | `pending_payment` | `paid` | `refunded` | `refund_failed`
- `deposit_capture_id` est requis pour rembourser : l'API Refunds de PayPal s'applique à la capture, pas à l'order
- `deposit_paypal_order_id` est unique : un order ne peut pas financer deux rendez-vous
- `custom_answers` porte les réponses aux questions du formulaire de réservation

---

## 43. `availability_slot`

**Rôle :** Plage horaire réservable, par jour de la semaine. Plusieurs lignes par jour sont possibles, ce qui permet de gérer une pause déjeuner.

**Utilisée par :** Génération des créneaux publics, validation de réservation, panneau Disponibilités.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique |
| `calendar_id` | UUID | FK → `calendar.id`, NN | Agenda parent |
| `capacity` | INT | NN, défaut `1` | Réservations simultanées acceptées sur le créneau |
| `created_at` | TIMESTAMP | défaut `now()` | Date de création |
| `day_of_week` | SMALLINT | NN | 0 = lundi … 6 = dimanche |
| `end_time` | TIME WITHOUT TIME ZONE | NN |  |
| `is_active` | BOOL | NN, défaut `True` |  |
| `max_party_size` | INT | — | Personnes maximum par réservation (1 = solo) |
| `slot_duration_min` | INT | NN, défaut `30` | Durée d'un créneau, en minutes |
| `start_time` | TIME WITHOUT TIME ZONE | NN |  |

**Règles métier :**

- `capacity` : nombre de réservations simultanées acceptées sur un même créneau
- `max_party_size` : nombre de personnes maximum par réservation (1 = solo)
- La validation lit ces deux valeurs sur la plage **contenant** le créneau demandé, et non le maximum de la journée

---

## 44. `blocked_period`

**Rôle :** Période d'indisponibilité : congés, fermeture exceptionnelle.

**Utilisée par :** Génération des créneaux publics, validation de réservation, panneau Bloquer.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique |
| `calendar_id` | UUID | FK → `calendar.id`, NN | Agenda concerné |
| `color` | TEXT | — |  |
| `created_at` | TIMESTAMP | défaut `now()` | Date de création |
| `created_by` | VARCHAR | défaut `user` |  |
| `end_at` | TIMESTAMPTZ | NN |  |
| `reason` | TEXT | — |  |
| `start_at` | TIMESTAMPTZ | NN |  |

**Règles métier :**

- Une réservation chevauchant une période bloquée est refusée côté public ; le tenant peut forcer depuis son dashboard

---

## 45. `calendar`

**Rôle :** Agenda d'un tenant. Un seul par tenant en pratique.

**Utilisée par :** Réservation publique, calendrier du dashboard, rappels.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire |
| `external_calendar_id` | VARCHAR | — | ID dans Google Calendar ou Cal.com si synchronisé |
| `last_synced_at` | TIMESTAMP | — | Dernière synchronisation avec le calendrier externe |
| `name` | VARCHAR | NN, défaut `Agenda principal` | Nom de l'agenda |
| `timezone` | VARCHAR | NN, défaut `Europe/Brussels` | Fuseau horaire (IANA) |

---

# CATÉGORIE : FACTURATION TENANT

---

## 46. `invoice`

**Rôle :** Facture émise par **le tenant à ses propres clients** — et non par Klientys au tenant. La facturation de l'abonnement Klientys vit chez Stripe, pas en base.

**Utilisée par :** Module de facturation du dashboard, génération PDF et UBL.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `appointment_id` | UUID | FK → `appointment.id` | Rendez-vous concerné |
| `client_address` | TEXT | — |  |
| `client_email` | TEXT | — |  |
| `client_name` | TEXT | — |  |
| `client_vat` | TEXT | — | TVA du client, **recopiée** à l'émission |
| `contact_id` | UUID | FK → `contact.id` | Contact concerné |
| `created_at` | TIMESTAMPTZ | défaut `now()` | Date de création |
| `currency` | TEXT | NN, défaut `EUR` |  |
| `due_date` | DATE | — | Date d'échéance |
| `issue_date` | DATE | NN, défaut `CURRENT_DATE` |  |
| `notes` | TEXT | — |  |
| `number` | TEXT | NN | Numéro séquentiel sans trou, exigence comptable |
| `paid_at` | TIMESTAMPTZ | — | Date et heure de paiement effectif |
| `payment_terms` | TEXT | — |  |
| `pdf_url` | TEXT | — | PDF généré, stocké dans un bucket privé |
| `sent_at` | TIMESTAMPTZ | — | Date d'envoi effectif |
| `status` | TEXT | NN, défaut `draft` | État : `pending`, `paid`, `void`, `uncollectible` |
| `subtotal` | NUMERIC | NN, défaut `0` |  |
| `tax_amount` | NUMERIC | NN, défaut `0` |  |
| `tax_rate` | NUMERIC | NN, défaut `0` | Taux de TVA appliqué, en pourcentage |
| `tenant_address` | TEXT | — |  |
| `tenant_name` | TEXT | — |  |
| `tenant_vat` | TEXT | — | TVA du tenant, **recopiée** à l'émission |
| `total` | NUMERIC | NN, défaut `0` |  |
| `ubl_url` | TEXT | — | XML conforme à la facturation électronique européenne |
| `updated_at` | TIMESTAMPTZ | défaut `now()` | Date de dernière modification |

**Règles métier :**

- Les coordonnées du tenant et du client sont **recopiées** sur la facture à l'émission : une facture ne doit pas changer si la fiche contact est modifiée ensuite
- `ubl_url` : version XML conforme à la facturation électronique européenne
- Peut être rattachée à un rendez-vous (`appointment_id`)

---

## 47. `invoice_line`

**Rôle :** Ligne d'une facture : désignation, quantité, prix unitaire, total.

**Utilisée par :** Module de facturation, PDF, UBL.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `created_at` | TIMESTAMPTZ | défaut `now()` | Date de création |
| `description` | TEXT | NN |  |
| `invoice_id` | UUID | FK → `invoice.id`, NN | Facture concernée |
| `position` | INT | NN, défaut `0` | Ordre d'affichage |
| `quantity` | NUMERIC | NN, défaut `1` |  |
| `tax_rate` | NUMERIC | NN, défaut `0` |  |
| `total` | NUMERIC | NN, défaut `0` |  |
| `unit_price` | NUMERIC | NN, défaut `0` |  |

---

## 48. `invoice_sequence`

**Rôle :** Compteur de numérotation des factures par tenant, pour garantir une séquence continue sans trou, exigée comptablement.

**Utilisée par :** Attribution du numéro à l'émission.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `tenant_id` | UUID | PK, FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `last_number` | INT | NN, défaut `0` |  |
| `year` | INT | PK, NN |  |

---

# CATÉGORIE : MESSAGERIE & AGENTS IA

---

## 49. `agent_config`

**Rôle :** Configuration d'un agent IA pour un tenant : persona, canaux, jetons.

**Utilisée par :** Page Agents IA, chatbot public, webhooks Telegram et WhatsApp, notifications.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire |
| `agent_type` | PUBLIC.AGENT_TYPE_ENUM | NN | Type d'agent : `vitrine`, `support_client`, `assistant_tenant` |
| `created_at` | TIMESTAMP | défaut `now()` | Date de création |
| `diagnostic_mode_enabled` | BOOL | défaut `False` |  |
| `escalation_triggers` | TEXT[] | — |  |
| `faq_pairs` | JSONB | — |  |
| `followup_delay_hours` | INT | défaut `24` |  |
| `followup_enabled` | BOOL | défaut `False` |  |
| `followup_message` | TEXT | — |  |
| `knowledge_base` | TEXT | — |  |
| `memory_enabled` | BOOL | défaut `True` |  |
| `model` | VARCHAR | NN, défaut `mistral-small-latest` | Modèle LLM utilisé : `faq_static`, `mistral-small`, `mistral-large` |
| `persona_name` | TEXT | — |  |
| `persona_tone` | TEXT | défaut `friendly` |  |
| `photo_diagnosis_enabled` | BOOL | défaut `False` |  |
| `quote_enabled` | BOOL | défaut `False` |  |
| `quote_variables` | JSONB | — |  |
| `status` | VARCHAR | NN, défaut `active` | État : `active`, `inactive`, `training` |
| `synthesis_schedule_minutes` | INT | NN, défaut `180` | Fréquence en minutes du Worker de synthèse (Agent 3 uniquement) |
| `system_prompt` | TEXT | — | Prompt système envoyé au LLM pour contextualiser les réponses |
| `telegram_bot_token` | VARCHAR | — |  |
| `telegram_notify_chat_id` | BIGINT | — |  |
| `updated_at` | TIMESTAMP | défaut `now()` | Date de dernière modification |
| `urgent_keywords` | TEXT[] | — |  |
| `whatsapp_number` | VARCHAR | — |  |

**Règles métier :**

- Trois types : `vitrine` (gratuit, tous les plans), `support_client`, `assistant_tenant`
- `telegram_bot_token` est synchronisé entre `support_client` et `assistant_tenant`

---

## 50. `agent_document`

**Rôle :** Document fourni à un agent IA comme source de connaissance, découpé et vectorisé pour la recherche sémantique.

**Utilisée par :** Agents IA (réponses documentées).

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `agent_type` | TEXT | NN, défaut `support_client` |  |
| `content` | TEXT | — |  |
| `created_at` | TIMESTAMPTZ | défaut `now()` | Date de création |
| `embedding` | PUBLIC.VECTOR(768) | — |  |
| `filename` | TEXT | — |  |
| `metadata` | JSONB | — |  |

---

## 51. `agent_link`

**Rôle :** Jeton d'accès permettant de relier un interlocuteur externe à un tenant sur WhatsApp.

**Utilisée par :** Agents IA.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant émetteur |
| `channel` | VARCHAR | NN, défaut `whatsapp` | Canal cible : `whatsapp`, `telegram` |
| `contact_id` | UUID | FK → `contact.id`, NN | Contact destinataire du lien |
| `created_at` | TIMESTAMP | défaut `now()` | Date de génération |
| `expires_at` | TIMESTAMP | NN | Date d'expiration du token |
| `token` | VARCHAR | NN | JWT signé (HS256) embarquant `contact_id`, `tenant_id`, `exp` |
| `used_at` | TIMESTAMP | — | Date de première utilisation — token invalidé après usage |

---

## 52. `agent_synthesis`

**Rôle :** Synthèse consolidée des conversations d'une période, produite par une tâche de fond.

**Utilisée par :** Page Agents IA (onglet Synthèses).

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant concerné |
| `agent_config_id` | UUID | FK → `agent_config.id`, NN | Configuration de l'agent ayant déclenché la synthèse |
| `content` | TEXT | NN | Texte du résumé consolidé généré par le LLM |
| `created_at` | TIMESTAMP | défaut `now()` | Date de création |
| `delivered_at` | TIMESTAMP | — | Date de livraison effective au tenant (null si en attente) |
| `period_end` | TIMESTAMP | NN | Fin de la période couverte |
| `period_start` | TIMESTAMP | NN | Début de la période couverte par la synthèse |

---

## 53. `channel`

**Rôle :** Canal de communication connecté à un tenant. Table héritée : la configuration des canaux se fait en pratique dans `agent_config`.

**Utilisée par :** Aucun usage dans le code actuel.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire |
| `connected_at` | TIMESTAMP | NN, défaut `now()` | Date de connexion du canal |
| `external_identifier` | VARCHAR | — | Identifiant dans le système externe (numéro WhatsApp, token Telegram) |
| `status` | VARCHAR | NN, défaut `connected` | État : `connected`, `disconnected`, `error` |
| `type` | VARCHAR | NN, défaut `site_form` | Type de canal : `site_form`, `email`, `whatsapp`, `telegram` |

---

## 54. `conversation`

**Rôle :** Fil d'échanges entre un agent IA et un interlocuteur, sur un canal donné.

**Utilisée par :** Agents IA, synthèses, chronologie du contact.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant concerné |
| `agent_type` | VARCHAR | NN |  |
| `channel` | VARCHAR | NN, défaut `whatsapp` |  |
| `contact_id` | UUID | FK → `contact.id` | Contact identifié (null si inconnu au départ) |
| `deleted_at` | TIMESTAMPTZ | — |  |
| `ended_at` | TIMESTAMPTZ | — |  |
| `metadata` | JSONB | NN |  |
| `started_at` | TIMESTAMPTZ | NN, défaut `now()` | Date d'ouverture |

---

## 55. `message`

**Rôle :** Message individuel d'une conversation, côté visiteur ou côté agent.

**Utilisée par :** Agents IA, synthèses.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique |
| `content` | TEXT | NN | Contenu textuel du message |
| `conversation_id` | UUID | FK → `conversation.id`, NN | Conversation parente |
| `metadata` | JSONB | NN |  |
| `sender_type` | VARCHAR | NN | Type d'expéditeur : `user`, `contact`, `chatbot`, `system` |
| `sent_at` | TIMESTAMPTZ | NN, défaut `now()` | Date et heure d'envoi |

---

## 56. `ocr_summary`

**Rôle :** Résumé chiffré extrait d'un document par OCR. Le document source n'est jamais conservé.

**Utilisée par :** Agents IA.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant concerné |
| `appointment_id` | UUID | FK → `appointment.id` | Rendez-vous préparé par ce document |
| `contact_id` | UUID | FK → `contact.id`, NN | Contact ayant envoyé le document |
| `created_at` | TIMESTAMP | défaut `now()` | Date de création |
| `document_type` | VARCHAR | — | Type de document identifié : `ordonnance`, `analyse_sang`, `imagerie`, `autre` |
| `processed_at` | TIMESTAMP | NN, défaut `now()` | Date de traitement OCR |
| `summary_encrypted` | TEXT | NN | Résumé chiffré (pgcrypto) extrait par OCR |

---

# CATÉGORIE : ANALYTIQUE

---

## 57. `google_analytics_connection`

**Rôle :** Connexion OAuth d'un tenant à sa propriété Google Analytics 4.

**Utilisée par :** Paramètres (intégrations), page Analytics.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `access_token` | TEXT | NN |  |
| `connected_at` | TIMESTAMPTZ | NN, défaut `now()` |  |
| `ga4_property_id` | TEXT | — |  |
| `refresh_token` | TEXT | — |  |

**Règles métier :**

- `ga4_property_id` est stocké au format `properties/123456789`

---

## 58. `site_event`

**Rôle :** Événement comportemental sur le site vitrine d'un tenant : page vue, section lue, clic sur un appel à l'action, ouverture de formulaire, message au chatbot. Moteur propriétaire, distinct de GA4.

**Utilisée par :** Script de tracking du site public, page Analytics.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `data` | JSONB | NN |  |
| `event_type` | TEXT | NN | `pageview`, `section_view`, `cta_click`, `form_open`… |
| `section` | TEXT | — | Section du site concernée |
| `session_id` | TEXT | NN | Identifiant d'onglet (sessionStorage), non nominatif |

**Règles métier :**

- Soumis au consentement cookies : le tracker ne se charge que si la catégorie analytique est acceptée
- `session_id` est un identifiant d'onglet, conservé en `sessionStorage`

---

## 59. `tenant_roi_cache`

**Rôle :** Cache 24 h du potentiel de demande locale calculé via Google Trends, par tenant et par période. Évite de dépasser les limites de l'API.

**Utilisée par :** Carte Potentiel de demande locale.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `computed_at` | TIMESTAMPTZ | NN, défaut `now()` | Date du calcul — cache de 24 h |
| `data` | JSONB | NN |  |
| `period` | TEXT | NN | `week` \| `month` \| `quarter` \| `year` |

**Règles métier :**

- Unicité sur `(tenant_id, period)`

---

# CATÉGORIE : NOTIFICATIONS

---

## 60. `contact_push_subscription`

**Rôle :** Abonnement Web Push d'un contact, pour recevoir confirmations et rappels.

**Utilisée par :** Notifications push côté client.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `contact_id` | UUID | FK → `contact.id`, NN | Contact concerné |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `subscription` | JSONB | NN |  |

---

## 61. `notification`

**Rôle :** Notification programmée ou envoyée à un contact. Table héritée du modèle d'origine, dont la forme en base diffère de celle décrite par la migration 001.

**Utilisée par :** Aucun usage dans le code actuel.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant émetteur |
| `appointment_id` | UUID | FK → `appointment.id` | Rendez-vous concerné (rappels) |
| `channel` | VARCHAR | NN, défaut `email` | Canal d'envoi : `email`, `whatsapp`, `telegram`, `sms` |
| `contact_id` | UUID | FK → `contact.id` | Destinataire contact |
| `content` | TEXT | NN | Contenu du message envoyé (pour archivage) |
| `lead_id` | UUID | FK → `lead.id` | Lead concerné (accusés de réception) |
| `scheduled_at` | TIMESTAMP | — | Date d'envoi programmée |
| `sent_at` | TIMESTAMP | — | Date d'envoi effectif |
| `status` | VARCHAR | NN, défaut `pending` | État : `pending`, `sent`, `failed`, `canceled` |
| `type` | VARCHAR | NN | Type : `appointment_reminder_24h`, `appointment_reminder_1h`, `lead_confirmation`, `appointment_confirmation` |

---

## 62. `push_subscription`

**Rôle :** Abonnement Web Push d'un utilisateur du dashboard, pour un espace donné.

**Utilisée par :** Notifications push (nouveau RDV, nouveau lead).

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `subscription` | JSONB | NN |  |
| `user_id` | UUID | NN | Utilisateur concerné |

**Règles métier :**

- Unicité sur `(user_id, tenant_id)`

---

## 63. `tenant_notification`

**Rôle :** Notification interne destinée au tenant dans son dashboard.

**Utilisée par :** Cloche de notifications du dashboard.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire — porte l'isolation des données |
| `body` | TEXT | NN |  |
| `created_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de création |
| `data` | JSONB | — |  |
| `read_at` | TIMESTAMPTZ | — |  |
| `title` | TEXT | NN |  |
| `type` | TEXT | NN, défaut `feature_override` |  |

---

# CATÉGORIE : ANNUAIRE

---

## 64. `directory_listing`

**Rôle :** Fiche d'un tenant dans l'annuaire public multi-secteurs, indexable par les moteurs de recherche. Sur opt-in explicite.

**Utilisée par :** Pages `/annuaire`, paramètres (annuaire).

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | UUID | PK, NN, défaut `gen_random_uuid()` | Identifiant unique |
| `tenant_id` | UUID | FK → `tenant.id` | Tenant propriétaire — porte l'isolation des données |
| `accepts_booking` | BOOL | NN, défaut `True` |  |
| `display_name` | TEXT | NN |  |
| `is_listed` | BOOL | NN, défaut `False` | Visibilité dans l'annuaire public |
| `listed_at` | TIMESTAMPTZ | — |  |
| `metier_label` | TEXT | — |  |
| `metier_slug` | TEXT | NN | Slug du métier dans l'URL de l'annuaire |
| `primary_zone` | TEXT | NN | Zone principale affichée |
| `profile_photo_url` | TEXT | — |  |
| `tagline` | TEXT | — |  |
| `updated_at` | TIMESTAMPTZ | NN, défaut `now()` | Date de dernière modification |
| `zones` | TEXT[] | NN | Zones d'intervention — **toujours en Title Case** |

**Règles métier :**

- `is_listed` pilote la visibilité ; l'opt-out le passe à `false` sans supprimer la fiche
- **Les zones sont toujours stockées en Title Case** (`Rennes`, `Saint-Brieuc`) : les requêtes `contains` de Postgres sont sensibles à la casse sur les tableaux

---

# ANNEXE — Tables prévues, jamais implémentées

Décrites par la version 1.1 du catalogue, absentes de la base. Elles sont conservées ici
parce qu'elles documentent une intention de conception, et parce que savoir ce qui les
remplace évite de les recréer.

| Table prévue | Ce qui la remplace |
|---|---|
| `chatbot` | Agent conversationnel — remplacé par `agent_config` |
| `dashboard` | Tableau de bord configurable — les KPI affichés vivent dans `user_metadata` |
| `knowledge_base` | Base documentaire du chatbot — remplacée par `agent_document` |
| `knowledge_document` | Document indexé — remplacé par `agent_document` |
| `kpi` | Indicateur calculé — calculé à la volée par l'API analytics |
| `membership_permission` | Association membership ↔ permission — remplacée par le même tableau |
| `page_knowledge_document` | Lien page ↔ document — abandonné |
| `partner_account` | Organisation partenaire B2B — le modèle B2B passe par `contact.contact_type` |
| `permission` | Droit d'accès élémentaire — remplacé par `membership.permissions text[]` |
| `recommendation` | Suggestion automatique — non implémentée |
| `roi_model` | Modèle de calcul du ROI — remplacé par le service Trends et `tenant_roi_cache` |
| `roi_model_kpi` | Association ROI ↔ KPI — abandonnée |
| `tracking_event` | Action tracée — remplacé par `site_event` |
| `traffic_source` | Source d'acquisition — couvert par `site_event` et GA4 |
| `visitor_session` | Session de navigation — couvert par `site_event.session_id` |

---

## Régénérer ce document

Les colonnes viennent de l'OpenAPI de PostgREST :

```bash
curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Accept: application/openapi+json" \
     "$SUPABASE_URL/rest/v1/" > openapi.json
```

La prose métier (rôle, utilisations, règles) est rédigée à la main et doit être reprise
depuis la version précédente lors d'une régénération.
