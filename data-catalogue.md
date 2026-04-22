# Data Catalogue — SaaS Présence Digitale

**Version :** 1.1  
**Date :** Avril 2026  
**Base de données :** PostgreSQL avec Row-Level Security (RLS)  
**Portée :** Toutes les tables du modèle physique

---

## Comment lire ce document

Chaque table est décrite avec :
- **Rôle** : ce que représente la table dans le métier
- **Utilisée par** : les fonctionnalités qui lisent ou écrivent dans cette table
- **Colonnes** : nom, type, nullable, description, exemple, contraintes

**Légende des types :**
| Symbole | Signification |
|---|---|
| `PK` | Clé primaire |
| `FK` | Clé étrangère (référence une autre table) |
| `UQ` | Valeur unique dans toute la table |
| `NN` | Not Null — valeur obligatoire |
| `IDX` | Colonne indexée pour la performance |

---

## Index des tables

| # | Table | Catégorie | Description courte |
|---|---|---|---|
| 1 | [tenant](#1-tenant) | Plateforme | Organisation cliente du SaaS |
| 2 | [app_user](#2-app_user) | Plateforme | Utilisateur humain du système |
| 3 | [membership](#3-membership) | Plateforme | Lien utilisateur ↔ tenant avec rôle |
| 4 | [permission](#4-permission) | Plateforme | Droit d'accès élémentaire |
| 5 | [membership_permission](#5-membership_permission) | Plateforme | Association membership ↔ permission |
| 6 | [plan_subscription](#6-plan_subscription) | Facturation | Formule tarifaire proposée |
| 7 | [subscription](#7-subscription) | Facturation | Abonnement actif d'un tenant |
| 8 | [invoice](#8-invoice) | Facturation | Facture générée pour un abonnement |
| 9 | [template](#9-template) | Site | Modèle de site pré-configuré par métier |
| 10 | [site](#10-site) | Site | Site web publié pour un tenant |
| 11 | [page](#11-page) | Site | Page composant un site |
| 12 | [service_offer](#12-service_offer) | Site | Service proposé par le tenant |
| 13 | [service_area](#13-service_area) | Site | Zone géographique d'intervention |
| 14 | [partner_account](#14-partner_account) | CRM | Organisation partenaire (B2B) |
| 15 | [contact](#15-contact) | CRM | Personne physique (patient, client, pro) |
| 16 | [pipeline_stage](#16-pipeline_stage) | CRM | Étape du pipeline commercial |
| 17 | [traffic_source](#17-traffic_source) | Analytique | Source d'acquisition d'un visiteur |
| 18 | [channel](#18-channel) | Messagerie | Canal de communication connecté |
| 19 | [conversation](#19-conversation) | Messagerie | Fil d'échanges avec un contact |
| 20 | [message](#20-message) | Messagerie | Message individuel dans une conversation |
| 21 | [chatbot](#21-chatbot) | IA | Agent conversationnel d'un tenant |
| 22 | [knowledge_base](#22-knowledge_base) | IA | Base documentaire du chatbot |
| 23 | [knowledge_document](#23-knowledge_document) | IA | Document indexé dans la base |
| 24 | [page_knowledge_document](#24-page_knowledge_document) | IA | Lien page ↔ document de connaissance |
| 25 | [lead](#25-lead) | Leads | Demande ou opportunité entrante |
| 26 | [calendar](#26-calendar) | Agenda | Agenda d'un tenant |
| 27 | [availability_slot](#27-availability_slot) | Agenda | Créneau horaire réservable |
| 28 | [appointment](#28-appointment) | Agenda | Rendez-vous ou coordination planifiée |
| 29 | [notification](#29-notification) | Notifications | Message de rappel ou confirmation |
| 30 | [visitor_session](#30-visitor_session) | Analytique | Session de navigation sur un site |
| 31 | [tracking_event](#31-tracking_event) | Analytique | Action tracée sur le site |
| 32 | [dashboard](#32-dashboard) | Pilotage | Tableau de bord d'un tenant |
| 33 | [kpi](#33-kpi) | Pilotage | Indicateur de performance calculé |
| 34 | [roi_model](#34-roi_model) | Pilotage | Modèle de calcul du ROI |
| 35 | [roi_model_kpi](#35-roi_model_kpi) | Pilotage | Association ROI model ↔ KPI |
| 36 | [recommendation](#36-recommendation) | Pilotage | Suggestion générée automatiquement |
| 37 | [agent_config](#37-agent_config) | Agents IA | Configuration d'un agent IA par tenant |
| 38 | [agent_link](#38-agent_link) | Agents IA | Token d'accès WhatsApp pour client converti |
| 39 | [ocr_summary](#39-ocr_summary) | Agents IA | Résumé chiffré extrait par OCR (document jamais persisté) |
| 40 | [agent_synthesis](#40-agent_synthesis) | Agents IA | Résumé consolidé des conversations produit par le Worker 4 |

---

# CATÉGORIE : PLATEFORME

---

## 1. `tenant`

**Rôle :** Représente une organisation cliente du SaaS — typiquement un indépendant, une TPE ou une structure locale ayant souscrit un abonnement. C'est l'entité centrale du système multi-tenant : toutes les données métier lui sont rattachées.

**Utilisée par :** Création de compte, connexion, génération de site, gestion des leads, facturation, tableau de bord.

**RLS activée :** Non (table de référence lue par le système).

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique du tenant | `a1b2c3d4-...` |
| `name` | VARCHAR(150) | NN | Nom affiché de l'organisation | `MUNTU CURA` |
| `slug` | VARCHAR(150) | NN, UQ | Identifiant URL de l'organisation (utilisé pour le sous-domaine) | `muntu-cura` |
| `status` | VARCHAR(30) | NN, défaut `active` | État du compte : `active`, `suspended`, `trial`, `churned` | `active` |
| `business_model` | VARCHAR(30) | NN, défaut `hybrid` | Mode d'activité : `b2c`, `b2b`, `hybrid` | `hybrid` |
| `created_at` | TIMESTAMP | NN, défaut `NOW()` | Date de création du compte | `2026-01-15 10:00:00` |
| `updated_at` | TIMESTAMP | NN, défaut `NOW()` | Date de dernière modification | `2026-04-01 09:30:00` |

**Règles métier :**
- Le `slug` génère le sous-domaine par défaut : `{slug}.plateforme.com`
- Un tenant `suspended` ne peut plus publier son site ni recevoir de leads
- Un tenant `churned` conserve ses données pendant 90 jours avant anonymisation (RGPD)

---

## 2. `app_user`

**Rôle :** Représente toute personne humaine pouvant se connecter à la plateforme : l'indépendant lui-même, un collaborateur, ou un administrateur SaaS. Un même utilisateur peut appartenir à plusieurs tenants via la table `membership`.

**Utilisée par :** Authentification, gestion des accès, historique des actions.

**Note technique :** Le nom `app_user` est utilisé à la place de `user` car `USER` est un mot réservé en PostgreSQL.

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `b2c3d4e5-...` |
| `first_name` | VARCHAR(100) | NN | Prénom | `Yolande` |
| `last_name` | VARCHAR(100) | NN | Nom de famille | `NYA` |
| `email` | VARCHAR(255) | NN, UQ | Adresse email — sert d'identifiant de connexion | `yolande@muntu-cura.be` |
| `password_hash` | VARCHAR(255) | NN | Mot de passe hashé (bcrypt ou Argon2) — jamais en clair | `$2b$12$...` |
| `phone` | VARCHAR(50) | nullable | Numéro de téléphone optionnel | `+32470852516` |
| `status` | VARCHAR(30) | NN, défaut `active` | État du compte : `active`, `inactive`, `banned` | `active` |
| `last_login_at` | TIMESTAMP | nullable | Dernière connexion — utile pour détecter les comptes inactifs | `2026-04-15 08:00:00` |
| `created_at` | TIMESTAMP | NN, défaut `NOW()` | Date de création | `2026-01-15 10:00:00` |
| `updated_at` | TIMESTAMP | NN, défaut `NOW()` | Date de dernière modification | `2026-04-01 09:30:00` |

**Règles métier :**
- L'email doit être vérifié avant activation (token de confirmation envoyé à l'inscription)
- Le `password_hash` n'est jamais exposé dans les réponses API
- Un utilisateur supprimé est anonymisé (email remplacé par `deleted_{uuid}@anon.local`)

---

## 3. `membership`

**Rôle :** Matérialise le lien entre un utilisateur et un tenant. Définit le rôle de cet utilisateur au sein de l'organisation. Un utilisateur peut avoir des rôles différents dans des tenants différents.

**Utilisée par :** Contrôle d'accès, gestion des collaborateurs.

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `c3d4e5f6-...` |
| `tenant_id` | UUID | FK → `tenant.id`, NN, IDX | Tenant auquel appartient ce membership | `a1b2c3d4-...` |
| `user_id` | UUID | FK → `app_user.id`, NN, IDX | Utilisateur concerné | `b2c3d4e5-...` |
| `role` | VARCHAR(50) | NN, défaut `owner` | Rôle dans le tenant : `owner`, `admin`, `collaborator`, `viewer` | `owner` |
| `joined_at` | TIMESTAMP | NN, défaut `NOW()` | Date d'ajout dans le tenant | `2026-01-15 10:00:00` |

**Contrainte :** `UNIQUE(tenant_id, user_id)` — un utilisateur ne peut avoir qu'un seul membership par tenant.

**Règles métier :**
- Le rôle `owner` est attribué automatiquement à la création du tenant
- Seul un `owner` ou `admin` peut inviter de nouveaux collaborateurs
- Seul un `owner` peut supprimer le tenant ou changer d'abonnement

---

## 4. `permission`

**Rôle :** Référentiel des droits d'accès disponibles dans la plateforme. Chaque permission correspond à une action précise (ex. : voir les leads, modifier le site, envoyer des notifications).

**Utilisée par :** Contrôle d'accès fin par feature.

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `d4e5f6g7-...` |
| `code` | VARCHAR(100) | NN, UQ | Code technique de la permission | `leads:read`, `site:publish`, `billing:manage` |
| `label` | VARCHAR(255) | NN | Description lisible par un humain | `Voir les demandes entrantes` |

**Exemples de permissions :**
| Code | Label |
|---|---|
| `site:read` | Consulter le site |
| `site:publish` | Publier / dépublier le site |
| `leads:read` | Voir les demandes |
| `leads:manage` | Gérer les demandes (statut, notes) |
| `appointments:manage` | Gérer le calendrier et les rendez-vous |
| `billing:manage` | Gérer l'abonnement et les factures |
| `users:invite` | Inviter des collaborateurs |

---

## 5. `membership_permission`

**Rôle :** Table de jointure qui associe des permissions spécifiques à un membership. Permet d'affiner les droits au-delà du rôle de base.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `membership_id` | UUID | FK → `membership.id`, PK partielle | Membership concerné |
| `permission_id` | UUID | FK → `permission.id`, PK partielle | Permission accordée |

**Clé primaire composite :** `(membership_id, permission_id)`

---

# CATÉGORIE : FACTURATION

---

## 6. `plan_subscription`

**Rôle :** Définit les formules tarifaires proposées aux tenants (Starter, Pro, Business). Chaque plan fixe les limites d'utilisation et les fonctionnalités accessibles.

**Utilisée par :** Inscription, upgrade, contrôle des quotas.

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `e5f6g7h8-...` |
| `name` | VARCHAR(100) | NN | Nom du plan | `Pro` |
| `price_monthly` | NUMERIC(10,2) | NN | Prix mensuel en euros | `59.00` |
| `max_sites` | INT | NN | Nombre maximum de sites créables | `1` |
| `max_users` | INT | NN | Nombre maximum de collaborateurs | `3` |
| `max_messages` | INT | NN | Nombre maximum de messages/mois (chatbot + canaux) | `1000` |
| `chatbot_enabled` | BOOLEAN | NN, défaut `false` | Accès au module chatbot | `true` |
| `roi_enabled` | BOOLEAN | NN, défaut `false` | Accès au module ROI prédictif | `false` |

**Plans actuels :**
| Plan | Prix | Sites | Users | Messages | Chatbot | ROI |
|---|---|---|---|---|---|---|
| Starter | 29€/mois | 1 | 1 | 200 | Non | Non |
| Pro | 59€/mois | 1 | 3 | illimité | Oui | Non |
| Business | 99€/mois | 3 | 10 | illimité | Oui | Oui |

---

## 7. `subscription`

**Rôle :** Représente l'abonnement actif d'un tenant à un plan donné. Un tenant ne peut avoir qu'un seul abonnement actif à la fois.

**Utilisée par :** Contrôle des accès aux fonctionnalités, renouvellement, résiliation.

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `f6g7h8i9-...` |
| `tenant_id` | UUID | FK → `tenant.id`, NN, UQ | Tenant abonné (unique : un seul abonnement par tenant) | `a1b2c3d4-...` |
| `plan_id` | UUID | FK → `plan_subscription.id`, NN | Plan souscrit | `e5f6g7h8-...` |
| `status` | VARCHAR(30) | NN, défaut `trialing` | État : `trialing`, `active`, `past_due`, `canceled`, `paused` | `active` |
| `start_date` | DATE | NN | Date de début d'abonnement | `2026-02-01` |
| `end_date` | DATE | nullable | Date de fin (null si actif indéfiniment) | `2026-03-01` |

**Règles métier :**
- À la création d'un compte → `trialing` pendant 30 jours, sans carte bancaire
- `past_due` : paiement échoué — accès restreint après 7 jours de grâce
- `canceled` : le site reste accessible en lecture seule pendant 30 jours

---

## 8. `invoice`

**Rôle :** Facture générée automatiquement à chaque cycle de facturation (mensuel). Sert de preuve comptable pour le tenant et pour le SaaS.

**Utilisée par :** Historique de facturation, export comptable.

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `g7h8i9j0-...` |
| `subscription_id` | UUID | FK → `subscription.id`, NN, IDX | Abonnement concerné | `f6g7h8i9-...` |
| `number` | VARCHAR(50) | NN, UQ | Numéro de facture (format séquentiel) | `INV-2026-00042` |
| `amount` | NUMERIC(10,2) | NN | Montant TTC en euros | `59.00` |
| `status` | VARCHAR(30) | NN, défaut `pending` | État : `pending`, `paid`, `void`, `uncollectible` | `paid` |
| `due_date` | DATE | NN | Date d'échéance | `2026-03-01` |
| `paid_at` | TIMESTAMP | nullable | Date et heure de paiement effectif | `2026-02-28 14:23:00` |

---

# CATÉGORIE : SITE

---

## 9. `template`

**Rôle :** Modèle de site pré-configuré par type de métier. Contient les textes par défaut, la structure de pages, les services pré-remplis et les mentions légales adaptées. Permet de créer un site complet en moins de 15 minutes.

**Utilisée par :** Générateur de site lors de la création d'un compte.

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `h8i9j0k1-...` |
| `name` | VARCHAR(150) | NN | Nom affiché | `Infirmière indépendante` |
| `business_type` | VARCHAR(50) | NN | Code métier | `nurse`, `plumber`, `coach`, `beautician` |
| `version` | VARCHAR(20) | NN, défaut `1.0` | Version du template (pour gestion des mises à jour) | `1.2` |
| `active` | BOOLEAN | NN, défaut `true` | Si `false`, le template n'est plus proposé aux nouveaux tenants | `true` |

---

## 10. `site`

**Rôle :** Site web publié pour un tenant. Un tenant peut avoir plusieurs sites (selon son plan). Le site contient des pages, des offres de services et couvre des zones géographiques.

**Utilisée par :** Génération du site, publication, mode absence, tracking des visites.

**RLS activée.**

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `i9j0k1l2-...` |
| `tenant_id` | UUID | FK → `tenant.id`, NN, IDX | Propriétaire du site | `a1b2c3d4-...` |
| `template_id` | UUID | FK → `template.id`, nullable | Template utilisé pour initialiser le site | `h8i9j0k1-...` |
| `domain` | VARCHAR(255) | nullable | Nom de domaine personnalisé (ex: muntu-cura.be). Si null, utilise le sous-domaine par défaut | `muntu-cura.be` |
| `title` | VARCHAR(255) | NN | Titre du site (affiché dans l'onglet navigateur) | `MUNTU CURA — Infirmière à domicile` |
| `status` | VARCHAR(30) | NN, défaut `draft` | État : `draft`, `published`, `unpublished` | `published` |
| `audience_mode` | VARCHAR(30) | NN, défaut `hybrid` | Public cible principal : `b2c`, `b2b`, `hybrid` | `hybrid` |
| `default_language` | VARCHAR(10) | NN, défaut `fr` | Langue par défaut du site | `fr` |
| `absence_mode` | BOOLEAN | NN, défaut `false` | Si `true` : calendrier bloqué + bandeau d'absence affiché | `false` |
| `absence_message` | TEXT | nullable | Message affiché pendant l'absence | `En congé du 10 au 20 août. Je reprends le 21 août.` |
| `created_at` | TIMESTAMP | NN, défaut `NOW()` | Date de création | `2026-01-15 10:00:00` |
| `updated_at` | TIMESTAMP | NN, défaut `NOW()` | Date de dernière modification | `2026-04-10 16:00:00` |

---

## 11. `page`

**Rôle :** Page individuelle composant un site. Chaque site a au minimum une page d'accueil. Les pages peuvent être orientées vers les particuliers (B2C) ou les partenaires professionnels (B2B).

**Utilisée par :** Rendu du site, SEO, alimentation de la base de connaissance du chatbot.

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `j0k1l2m3-...` |
| `site_id` | UUID | FK → `site.id`, NN, IDX | Site auquel appartient la page | `i9j0k1l2-...` |
| `title` | VARCHAR(255) | NN | Titre de la page | `Nos services` |
| `slug` | VARCHAR(255) | NN | Chemin URL de la page | `nos-services` |
| `type` | VARCHAR(50) | NN, défaut `content` | Type : `home`, `services`, `about`, `contact`, `b2b_partners`, `legal`, `content` | `services` |
| `audience_type` | VARCHAR(30) | NN, défaut `all` | Public de la page : `all`, `b2c`, `b2b` | `b2b` |
| `seo_title` | VARCHAR(255) | nullable | Titre SEO (balise `<title>`) — si null, utilise `title` | `Infirmière à domicile Halle — Soins sur mesure` |
| `seo_description` | TEXT | nullable | Meta description pour les moteurs de recherche | `Infirmière indépendante à Halle, Lembeek, Beersel...` |
| `status` | VARCHAR(30) | NN, défaut `draft` | État : `draft`, `published` | `published` |
| `updated_at` | TIMESTAMP | NN, défaut `NOW()` | Date de dernière modification | `2026-04-01 11:00:00` |

**Contrainte :** `UNIQUE(site_id, slug)` — deux pages du même site ne peuvent pas avoir le même chemin URL.

---

## 12. `service_offer`

**Rôle :** Service proposé par le tenant sur son site. Peut être réservable directement (si `bookable = true`) et cibler un public B2C, B2B ou les deux.

**Utilisée par :** Affichage sur le site, prise de rendez-vous, qualification des leads.

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `k1l2m3n4-...` |
| `site_id` | UUID | FK → `site.id`, NN, IDX | Site exposant ce service | `i9j0k1l2-...` |
| `name` | VARCHAR(255) | NN | Nom du service | `Prise de sang à domicile` |
| `description` | TEXT | nullable | Description détaillée | `Prélèvement sanguin à votre domicile, résultat sous 24h` |
| `target_audience` | VARCHAR(30) | NN, défaut `all` | Public visé : `all`, `b2c`, `b2b` | `b2c` |
| `price_from` | NUMERIC(10,2) | nullable | Prix indicatif à partir de (en euros). Null si non affiché | `25.00` |
| `bookable` | BOOLEAN | NN, défaut `true` | Si `true`, ce service apparaît dans le widget de réservation | `true` |
| `duration_minutes` | INT | nullable | Durée du service en minutes — utilisée pour bloquer le créneau | `30` |

---

## 13. `service_area`

**Rôle :** Zone géographique couverte par un tenant. Un site peut en avoir plusieurs. Utilisé pour le SEO local et pour filtrer les demandes hors zone.

**Utilisée par :** Affichage sur le site, SEO local, qualification des leads.

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `l2m3n4o5-...` |
| `site_id` | UUID | FK → `site.id`, NN | Site concerné | `i9j0k1l2-...` |
| `city` | VARCHAR(150) | nullable | Nom de la ville | `Halle` |
| `postal_code` | VARCHAR(20) | nullable | Code postal | `1500` |
| `region` | VARCHAR(150) | nullable | Région ou province | `Brabant flamand` |
| `country` | VARCHAR(50) | NN, défaut `BE` | Code pays ISO 3166-1 alpha-2 | `BE` |

---

# CATÉGORIE : CRM

---

## 14. `partner_account`

**Rôle :** Organisation externe avec laquelle le tenant collabore dans un cadre B2B — maison de repos, mutuelle, médecin référent, établissement de soins, etc. Un partenaire peut avoir plusieurs contacts individuels (`contact`).

**Utilisée par :** CRM B2B, qualification des leads, attribution des rendez-vous.

**RLS activée.**

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `m3n4o5p6-...` |
| `tenant_id` | UUID | FK → `tenant.id`, NN, IDX | Tenant propriétaire de ce partenaire | `a1b2c3d4-...` |
| `organization_name` | VARCHAR(255) | NN | Nom de l'organisation | `Résidence Les Quatre Saisons` |
| `type` | VARCHAR(50) | nullable | Type d'organisation : `maison_repos`, `mutuelle`, `medecin`, `hopital`, `autre` | `maison_repos` |
| `status` | VARCHAR(30) | NN, défaut `active` | État : `active`, `inactive`, `prospect` | `active` |
| `relationship_type` | VARCHAR(50) | nullable | Nature de la relation : `contract`, `referral`, `occasional` | `contract` |
| `created_at` | TIMESTAMP | NN, défaut `NOW()` | Date de création | `2026-02-01 09:00:00` |
| `updated_at` | TIMESTAMP | NN, défaut `NOW()` | Date de dernière modification | `2026-04-01 09:00:00` |
| `deleted_at` | TIMESTAMP | nullable | Soft delete — si renseigné, le partenaire est masqué mais conservé | `null` |

---

## 15. `contact`

**Rôle :** Personne physique ayant interagi avec le tenant — patient, client particulier, représentant d'un partenaire B2B. Un contact peut être rattaché à un `partner_account` s'il représente une organisation.

**Utilisée par :** Leads, rendez-vous, conversations, notifications.

**RLS activée. Données potentiellement médicales → chiffrement applicatif recommandé sur les champs sensibles.**

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `n4o5p6q7-...` |
| `tenant_id` | UUID | FK → `tenant.id`, NN, IDX | Tenant propriétaire | `a1b2c3d4-...` |
| `partner_account_id` | UUID | FK → `partner_account.id`, nullable, IDX | Organisation à laquelle appartient ce contact (si B2B) | `m3n4o5p6-...` |
| `first_name` | VARCHAR(100) | NN | Prénom | `Marie` |
| `last_name` | VARCHAR(100) | NN | Nom de famille | `Dupont` |
| `email` | VARCHAR(255) | nullable, IDX | Adresse email | `marie.dupont@email.com` |
| `phone` | VARCHAR(50) | nullable | Numéro de téléphone | `+32478123456` |
| `contact_type` | VARCHAR(30) | NN, défaut `individual` | Type : `individual` (B2C), `professional` (représentant B2B) | `individual` |
| `company_name` | VARCHAR(255) | nullable | Nom de la société si contact professionnel | `null` |
| `created_at` | TIMESTAMP | NN, défaut `NOW()` | Date de création | `2026-02-15 14:00:00` |
| `updated_at` | TIMESTAMP | NN, défaut `NOW()` | Date de dernière modification | `2026-04-01 10:00:00` |
| `deleted_at` | TIMESTAMP | nullable | Soft delete (droit à l'oubli RGPD) | `null` |

**Règles métier :**
- Un contact `deleted_at` non nul est masqué de tous les affichages
- Après 90 jours, une procédure d'anonymisation remplace les données personnelles par des valeurs génériques
- L'email et le téléphone ne sont jamais obligatoires (un contact peut être créé avec juste un prénom)

---

## 16. `pipeline_stage`

**Rôle :** Étape du pipeline commercial d'un tenant. Chaque tenant peut définir ses propres étapes dans l'ordre souhaité. Les leads progressent d'étape en étape.

**Utilisée par :** Gestion des leads, tableau de bord commercial.

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `o5p6q7r8-...` |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire | `a1b2c3d4-...` |
| `name` | VARCHAR(100) | NN | Nom de l'étape | `Nouveau`, `Contacté`, `Rendez-vous planifié`, `Converti` |
| `position` | INT | NN | Ordre d'affichage (de gauche à droite dans le kanban) | `1`, `2`, `3`, `4` |
| `is_final` | BOOLEAN | NN, défaut `false` | Si `true`, cette étape clôt le pipeline (converti ou perdu) | `true` |

**Étapes par défaut créées à la création d'un tenant :**
| Position | Nom | is_final |
|---|---|---|
| 1 | Nouveau | Non |
| 2 | En cours | Non |
| 3 | À rappeler | Non |
| 4 | Planifié | Non |
| 5 | Converti | Oui |
| 6 | Perdu | Oui |

---

# CATÉGORIE : ANALYTIQUE

---

## 17. `traffic_source`

**Rôle :** Origine d'une visite ou d'un lead. Permet d'identifier quel canal (Google, réseaux sociaux, bouche-à-oreille, etc.) génère le plus de valeur pour un tenant.

**Utilisée par :** Attribution des leads, tableau de bord, calcul du ROI.

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `p6q7r8s9-...` |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant concerné | `a1b2c3d4-...` |
| `channel` | VARCHAR(50) | nullable | Canal : `organic_search`, `direct`, `social`, `referral`, `email`, `whatsapp`, `telegram` | `organic_search` |
| `campaign` | VARCHAR(255) | nullable | Nom de campagne marketing (UTM) | `avril-promo-halle` |
| `medium` | VARCHAR(100) | nullable | Medium (UTM) | `cpc`, `email`, `social` |
| `keyword` | VARCHAR(255) | nullable | Mot-clé ayant généré la visite (si recherche payante) | `infirmière domicile Halle` |

---

# CATÉGORIE : MESSAGERIE

---

## 18. `channel`

**Rôle :** Canal de communication connecté à la plateforme pour un tenant donné. Chaque canal reçoit des messages entrants (formulaire site, WhatsApp, Telegram, email) qui sont centralisés dans la boîte unifiée.

**Utilisée par :** Boîte unifiée, routing des messages, conversations.

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `q7r8s9t0-...` |
| `tenant_id` | UUID | FK → `tenant.id`, NN, IDX | Tenant propriétaire | `a1b2c3d4-...` |
| `type` | VARCHAR(30) | NN | Type de canal : `site_form`, `email`, `whatsapp`, `telegram` | `whatsapp` |
| `external_identifier` | VARCHAR(255) | nullable | Identifiant dans le système externe (numéro WhatsApp, token Telegram) | `+32470852516` |
| `status` | VARCHAR(30) | NN, défaut `connected` | État : `connected`, `disconnected`, `error` | `connected` |
| `connected_at` | TIMESTAMP | NN, défaut `NOW()` | Date de connexion du canal | `2026-02-01 10:00:00` |

---

## 19. `conversation`

**Rôle :** Fil d'échanges entre le tenant (ou son chatbot) et un contact. Une conversation est associée à un canal et peut contenir plusieurs messages. Elle peut générer un lead si qualifiée.

**Utilisée par :** Boîte unifiée, chatbot, CRM.

**RLS activée.**

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `r8s9t0u1-...` |
| `tenant_id` | UUID | FK → `tenant.id`, NN, IDX | Tenant concerné | `a1b2c3d4-...` |
| `channel_id` | UUID | FK → `channel.id`, NN | Canal utilisé | `q7r8s9t0-...` |
| `contact_id` | UUID | FK → `contact.id`, nullable, IDX | Contact identifié (null si inconnu au départ) | `n4o5p6q7-...` |
| `status` | VARCHAR(30) | NN, défaut `open` | État : `open`, `pending`, `closed` | `open` |
| `started_at` | TIMESTAMP | NN, défaut `NOW()` | Date d'ouverture | `2026-04-10 09:00:00` |
| `closed_at` | TIMESTAMP | nullable | Date de clôture | `null` |

---

## 20. `message`

**Rôle :** Message individuel au sein d'une conversation. Un message peut être envoyé par un utilisateur humain (tenant), par un contact externe, ou généré automatiquement par le chatbot.

**Utilisée par :** Affichage de la conversation, chatbot, historique CRM.

**RLS activée. Données potentiellement sensibles → chiffrement recommandé sur `content`.**

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `s9t0u1v2-...` |
| `conversation_id` | UUID | FK → `conversation.id`, NN, IDX | Conversation parente | `r8s9t0u1-...` |
| `user_id` | UUID | FK → `app_user.id`, nullable | Utilisateur humain auteur (si côté tenant) | `b2c3d4e5-...` |
| `contact_id` | UUID | FK → `contact.id`, nullable | Contact auteur (si côté client) | `n4o5p6q7-...` |
| `chatbot_id` | UUID | FK → `chatbot.id`, nullable | Chatbot auteur (si réponse automatique) | `t0u1v2w3-...` |
| `sender_type` | VARCHAR(30) | NN | Type d'expéditeur : `user`, `contact`, `chatbot`, `system` | `contact` |
| `content` | TEXT | NN | Contenu textuel du message | `Bonjour, j'aurais besoin d'un pansement à domicile.` |
| `sent_at` | TIMESTAMP | NN, défaut `NOW()`, IDX | Date et heure d'envoi | `2026-04-10 09:05:00` |
| `is_automated` | BOOLEAN | NN, défaut `false` | `true` si généré automatiquement (chatbot ou rappel) | `false` |

**Règles métier :**
- Un seul des trois champs `user_id`, `contact_id`, `chatbot_id` doit être renseigné
- Le `sender_type` doit être cohérent avec le champ renseigné

---

# CATÉGORIE : IA / CHATBOT

---

## 21. `chatbot`

**Rôle :** Agent conversationnel configuré pour un tenant. Répond automatiquement aux questions fréquentes des visiteurs, les qualifie et les oriente. Utilise une base de connaissance et un modèle de langage (LLM) ou des règles statiques.

**Utilisée par :** Widget chatbot sur le site, module de réponse automatique.

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `t0u1v2w3-...` |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire | `a1b2c3d4-...` |
| `name` | VARCHAR(150) | NN | Nom affiché du chatbot | `Assistant MUNTU CURA` |
| `status` | VARCHAR(30) | NN, défaut `active` | État : `active`, `inactive`, `training` | `active` |
| `model` | VARCHAR(100) | NN, défaut `faq_static` | Modèle utilisé : `faq_static` (MVP), `mistral-small`, `gpt-4o-mini` | `faq_static` |
| `system_prompt` | TEXT | nullable | Prompt système envoyé au LLM pour contextualiser les réponses (MVP : null) | `Tu es l'assistant de Yolande, infirmière à Halle...` |

---

## 22. `knowledge_base`

**Rôle :** Base documentaire associée à un chatbot. Contient l'ensemble des documents et FAQ que le chatbot consulte pour répondre aux questions.

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `u1v2w3x4-...` |
| `chatbot_id` | UUID | FK → `chatbot.id`, NN | Chatbot utilisant cette base | `t0u1v2w3-...` |
| `name` | VARCHAR(150) | NN | Nom de la base | `FAQ MUNTU CURA` |
| `status` | VARCHAR(30) | NN, défaut `active` | État : `active`, `indexing`, `error` | `active` |
| `last_indexed_at` | TIMESTAMP | nullable | Dernière date d'indexation complète | `2026-04-01 02:00:00` |

---

## 23. `knowledge_document`

**Rôle :** Document individuel indexé dans une base de connaissance — peut être une entrée FAQ, une page du site, un PDF de tarifs, etc. Peut cibler un public B2C ou B2B.

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `v2w3x4y5-...` |
| `knowledge_base_id` | UUID | FK → `knowledge_base.id`, NN | Base parente | `u1v2w3x4-...` |
| `title` | VARCHAR(255) | NN | Titre du document | `Quels sont vos tarifs pour une prise de sang ?` |
| `type` | VARCHAR(50) | NN, défaut `faq` | Type : `faq`, `page`, `pdf`, `manual_entry` | `faq` |
| `source_url` | VARCHAR(500) | nullable | URL source si le document vient d'une page web | `/nos-services` |
| `audience_type` | VARCHAR(30) | NN, défaut `all` | Public ciblé : `all`, `b2c`, `b2b` | `b2c` |
| `synced_at` | TIMESTAMP | nullable | Dernière synchronisation depuis la source | `2026-04-01 02:05:00` |

---

## 24. `page_knowledge_document`

**Rôle :** Table de jointure indiquant qu'une page du site alimente un document de connaissance du chatbot. Quand la page est modifiée, le document peut être resynchronisé automatiquement.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `page_id` | UUID | FK → `page.id`, PK partielle | Page source |
| `knowledge_document_id` | UUID | FK → `knowledge_document.id`, PK partielle | Document alimenté |

**Clé primaire composite :** `(page_id, knowledge_document_id)`

---

# CATÉGORIE : LEADS

---

## 25. `lead`

**Rôle :** Demande ou opportunité commerciale entrante — qu'elle vienne d'un formulaire de contact, d'un message WhatsApp, d'un email ou d'une interaction chatbot. C'est l'entité centrale du pipeline commercial. Un lead est toujours lié à un contact et progresse à travers les étapes du pipeline.

**Utilisée par :** Boîte unifiée, pipeline CRM, calcul du ROI.

**RLS activée.**

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `w3x4y5z6-...` |
| `tenant_id` | UUID | FK → `tenant.id`, NN, IDX | Tenant propriétaire | `a1b2c3d4-...` |
| `contact_id` | UUID | FK → `contact.id`, NN, IDX | Contact à l'origine de la demande | `n4o5p6q7-...` |
| `partner_account_id` | UUID | FK → `partner_account.id`, nullable | Organisation partenaire si demande B2B | `m3n4o5p6-...` |
| `service_offer_id` | UUID | FK → `service_offer.id`, nullable | Service concerné par la demande | `k1l2m3n4-...` |
| `pipeline_stage_id` | UUID | FK → `pipeline_stage.id`, nullable | Étape actuelle dans le pipeline | `o5p6q7r8-...` |
| `traffic_source_id` | UUID | FK → `traffic_source.id`, nullable | Source d'acquisition | `p6q7r8s9-...` |
| `conversation_id` | UUID | FK → `conversation.id`, nullable | Conversation ayant généré ce lead | `r8s9t0u1-...` |
| `source` | VARCHAR(50) | nullable | Canal d'origine : `site_form`, `whatsapp`, `telegram`, `email`, `phone` | `site_form` |
| `status` | VARCHAR(30) | NN, défaut `new`, IDX | État : `new`, `in_progress`, `to_call`, `scheduled`, `converted`, `lost`, `archived` | `new` |
| `priority` | VARCHAR(30) | NN, défaut `normal` | Priorité : `low`, `normal`, `high`, `urgent` | `normal` |
| `audience_type` | VARCHAR(30) | NN, défaut `b2c` | Type de demande : `b2c`, `b2b` | `b2c` |
| `request_type` | VARCHAR(50) | NN | Nature de la demande : `appointment`, `information`, `quote`, `partnership`, `other` | `appointment` |
| `created_at` | TIMESTAMP | NN, défaut `NOW()`, IDX | Date de création | `2026-04-10 09:10:00` |
| `updated_at` | TIMESTAMP | NN, défaut `NOW()` | Date de dernière modification | `2026-04-10 15:00:00` |

---

# CATÉGORIE : AGENDA

---

## 26. `calendar`

**Rôle :** Agenda d'un tenant. Contient les créneaux disponibles et les rendez-vous planifiés. Peut être synchronisé avec Google Calendar ou Cal.com.

**RLS activée.**

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `x4y5z6a7-...` |
| `tenant_id` | UUID | FK → `tenant.id`, NN, IDX | Tenant propriétaire | `a1b2c3d4-...` |
| `name` | VARCHAR(150) | NN | Nom de l'agenda | `Agenda principal` |
| `timezone` | VARCHAR(50) | NN, défaut `Europe/Brussels` | Fuseau horaire (IANA) | `Europe/Brussels` |
| `external_calendar_id` | VARCHAR(255) | nullable | ID dans Google Calendar ou Cal.com si synchronisé | `yolande@gmail.com` |
| `last_synced_at` | TIMESTAMP | nullable | Dernière synchronisation avec le calendrier externe | `2026-04-15 06:00:00` |

---

## 27. `availability_slot`

**Rôle :** Créneau horaire déclaré disponible par le tenant. Quand un rendez-vous est pris, le créneau passe en statut `reserved`. Permet d'éviter les doubles réservations.

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `y5z6a7b8-...` |
| `calendar_id` | UUID | FK → `calendar.id`, NN, IDX | Agenda parent | `x4y5z6a7-...` |
| `start_at` | TIMESTAMP | NN, IDX | Début du créneau | `2026-04-20 09:00:00` |
| `end_at` | TIMESTAMP | NN | Fin du créneau | `2026-04-20 09:30:00` |
| `status` | VARCHAR(30) | NN, défaut `free` | État : `free`, `reserved`, `blocked` | `free` |

**Contrainte :** `CHECK (end_at > start_at)` — la fin doit être postérieure au début.

---

## 28. `appointment`

**Rôle :** Rendez-vous ou coordination planifiée entre le tenant et un contact ou partenaire. Peut être un soin à domicile (B2C), une réunion de coordination avec une maison de repos (B2B), ou un appel téléphonique.

**Utilisée par :** Calendrier, rappels automatiques, conversion des leads.

**RLS activée.**

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `z6a7b8c9-...` |
| `calendar_id` | UUID | FK → `calendar.id`, NN, IDX | Agenda dans lequel le rendez-vous est planifié | `x4y5z6a7-...` |
| `contact_id` | UUID | FK → `contact.id`, NN, IDX | Contact concerné | `n4o5p6q7-...` |
| `partner_account_id` | UUID | FK → `partner_account.id`, nullable, IDX | Partenaire concerné (si B2B) | `m3n4o5p6-...` |
| `lead_id` | UUID | FK → `lead.id`, nullable, IDX | Lead converti en rendez-vous | `w3x4y5z6-...` |
| `service_offer_id` | UUID | FK → `service_offer.id`, nullable | Service concerné | `k1l2m3n4-...` |
| `availability_slot_id` | UUID | FK → `availability_slot.id`, nullable | Créneau réservé | `y5z6a7b8-...` |
| `type` | VARCHAR(50) | NN, défaut `b2c_appointment` | Type : `b2c_appointment`, `b2b_coordination`, `phone_call`, `home_visit` | `home_visit` |
| `audience_type` | VARCHAR(30) | NN, défaut `b2c` | Nature : `b2c`, `b2b` | `b2c` |
| `status` | VARCHAR(30) | NN, défaut `pending` | État : `pending`, `confirmed`, `canceled`, `completed`, `no_show` | `confirmed` |
| `scheduled_at` | TIMESTAMP | NN, IDX | Début du rendez-vous | `2026-04-20 09:00:00` |
| `end_at` | TIMESTAMP | NN | Fin du rendez-vous | `2026-04-20 09:30:00` |
| `created_at` | TIMESTAMP | NN, défaut `NOW()` | Date de création | `2026-04-15 11:00:00` |
| `updated_at` | TIMESTAMP | NN, défaut `NOW()` | Date de dernière modification | `2026-04-18 08:00:00` |

**Contrainte :** `CHECK (end_at > scheduled_at)`

---

# CATÉGORIE : NOTIFICATIONS

---

## 29. `notification`

**Rôle :** Message de rappel ou de confirmation envoyé automatiquement à un contact (rappel de rendez-vous, confirmation de demande, accusé de réception). Géré par un worker asynchrone.

**RLS activée.**

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `a7b8c9d0-...` |
| `tenant_id` | UUID | FK → `tenant.id`, NN, IDX | Tenant émetteur | `a1b2c3d4-...` |
| `contact_id` | UUID | FK → `contact.id`, nullable | Destinataire contact | `n4o5p6q7-...` |
| `appointment_id` | UUID | FK → `appointment.id`, nullable, IDX | Rendez-vous concerné (rappels) | `z6a7b8c9-...` |
| `lead_id` | UUID | FK → `lead.id`, nullable | Lead concerné (accusés de réception) | `w3x4y5z6-...` |
| `type` | VARCHAR(50) | NN | Type : `appointment_reminder_24h`, `appointment_reminder_1h`, `lead_confirmation`, `appointment_confirmation` | `appointment_reminder_24h` |
| `channel` | VARCHAR(30) | NN | Canal d'envoi : `email`, `whatsapp`, `telegram`, `sms` | `email` |
| `status` | VARCHAR(30) | NN, défaut `pending` | État : `pending`, `sent`, `failed`, `canceled` | `sent` |
| `content` | TEXT | NN | Contenu du message envoyé (pour archivage) | `Rappel : rendez-vous demain à 9h00 avec Yolande NYA.` |
| `scheduled_at` | TIMESTAMP | nullable, IDX | Date d'envoi programmée | `2026-04-19 09:00:00` |
| `sent_at` | TIMESTAMP | nullable | Date d'envoi effectif | `2026-04-19 09:00:05` |

---

# CATÉGORIE : ANALYTIQUE

---

## 30. `visitor_session`

**Rôle :** Session de navigation d'un visiteur sur un site tenant. Le visiteur peut être anonyme (pas encore identifié) ou identifié ultérieurement comme contact. L'IP est stockée sous forme de hash (RGPD).

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `b8c9d0e1-...` |
| `site_id` | UUID | FK → `site.id`, NN, IDX | Site visité | `i9j0k1l2-...` |
| `anonymous_id` | VARCHAR(255) | nullable | Identifiant anonyme côté navigateur (cookie ou fingerprint) | `anon_abc123` |
| `device_type` | VARCHAR(30) | nullable | Type d'appareil : `mobile`, `desktop`, `tablet` | `mobile` |
| `referrer` | VARCHAR(500) | nullable | URL de provenance | `https://www.google.com/` |
| `ip_hash` | VARCHAR(64) | nullable | Hash SHA-256 de l'IP (jamais l'IP en clair — conformité RGPD) | `e3b0c44298fc...` |
| `started_at` | TIMESTAMP | NN, défaut `NOW()`, IDX | Début de la session | `2026-04-15 14:00:00` |
| `ended_at` | TIMESTAMP | nullable | Fin de la session (null si encore active) | `2026-04-15 14:08:00` |

---

## 31. `tracking_event`

**Rôle :** Action tracée durant une session visiteur — page vue, clic sur "Prendre rendez-vous", soumission d'un formulaire. Données à fort volume : prévoir une stratégie de purge au-delà de 6 mois.

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `c9d0e1f2-...` |
| `visitor_session_id` | UUID | FK → `visitor_session.id`, NN, IDX | Session parente | `b8c9d0e1-...` |
| `page_id` | UUID | FK → `page.id`, nullable | Page sur laquelle l'événement a eu lieu | `j0k1l2m3-...` |
| `traffic_source_id` | UUID | FK → `traffic_source.id`, nullable | Source attribuée à cet événement | `p6q7r8s9-...` |
| `event_type` | VARCHAR(50) | NN | Type : `page_view`, `form_submit`, `booking_click`, `chatbot_open`, `phone_click` | `form_submit` |
| `page_url` | VARCHAR(500) | nullable | URL complète de la page | `https://muntu-cura.be/contact` |
| `source` | VARCHAR(100) | nullable | Source simplifiée | `google` |
| `occurred_at` | TIMESTAMP | NN, défaut `NOW()`, IDX | Date et heure de l'événement | `2026-04-15 14:03:00` |

---

# CATÉGORIE : PILOTAGE

---

## 32. `dashboard`

**Rôle :** Tableau de bord généré pour un tenant. Contient un ensemble de KPI calculés à intervalles réguliers. Un tenant peut avoir plusieurs tableaux de bord (ex. : hebdomadaire, mensuel).

**RLS activée.**

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `d0e1f2g3-...` |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant propriétaire | `a1b2c3d4-...` |
| `name` | VARCHAR(150) | NN | Nom du tableau de bord | `Dashboard mensuel — Avril 2026` |
| `generated_at` | TIMESTAMP | NN, défaut `NOW()` | Date de génération | `2026-05-01 00:00:00` |

---

## 33. `kpi`

**Rôle :** Indicateur de performance calculé et stocké pour un tableau de bord. Peut être segmenté par audience (B2C vs B2B) ou par canal.

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `e1f2g3h4-...` |
| `dashboard_id` | UUID | FK → `dashboard.id`, NN, IDX | Dashboard parent | `d0e1f2g3-...` |
| `code` | VARCHAR(100) | NN | Code technique de l'indicateur | `leads_total`, `conversion_rate`, `avg_response_time` |
| `label` | VARCHAR(255) | NN | Libellé lisible | `Nombre de demandes reçues` |
| `segment` | VARCHAR(30) | nullable | Segment : `b2c`, `b2b`, `all`, `organic`, `whatsapp` | `b2c` |
| `value` | NUMERIC(15,4) | nullable | Valeur calculée | `42.0000` |
| `computed_at` | TIMESTAMP | NN, défaut `NOW()` | Date de calcul | `2026-05-01 00:05:00` |

**KPI standards calculés automatiquement :**
| Code | Label |
|---|---|
| `visits_total` | Nombre de visites |
| `leads_total` | Nombre de demandes reçues |
| `leads_b2c` | Demandes B2C |
| `leads_b2b` | Demandes B2B |
| `appointments_total` | Rendez-vous planifiés |
| `conversion_rate` | Taux de conversion visite → demande (%) |
| `avg_response_time_hours` | Temps moyen de réponse (heures) |
| `top_traffic_source` | Principale source de trafic |

---

## 34. `roi_model`

**Rôle :** Calcul du retour sur investissement estimé pour un tenant, basé sur les données réelles collectées (trafic, leads, taux de conversion) et la valeur client fournie par le tenant. Mis à jour périodiquement.

**RLS activée.**

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `f2g3h4i5-...` |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant concerné | `a1b2c3d4-...` |
| `version` | VARCHAR(20) | NN, défaut `1.0` | Version du modèle de calcul | `1.2` |
| `estimated_monthly_leads` | NUMERIC(10,2) | nullable | Nombre de leads estimés par mois | `12.00` |
| `estimated_conversion_rate` | NUMERIC(5,4) | nullable | Taux de conversion estimé (0–1) | `0.3500` (= 35%) |
| `average_client_value` | NUMERIC(10,2) | nullable | Valeur moyenne d'un client en euros (saisie par le tenant) | `80.00` |
| `estimated_value` | NUMERIC(10,2) | nullable | Chiffre d'affaires estimé généré par le site (€/mois) | `336.00` |
| `estimated_cost` | NUMERIC(10,2) | nullable | Coût mensuel du SaaS pour ce tenant | `59.00` |
| `estimated_roi` | NUMERIC(10,4) | nullable | ROI calculé : `(valeur - coût) / coût` | `4.6949` (= ~470%) |
| `computed_at` | TIMESTAMP | NN, défaut `NOW()` | Date de calcul | `2026-05-01 00:10:00` |

**Formule de calcul :**
```
estimated_value    = estimated_monthly_leads × estimated_conversion_rate × average_client_value
estimated_roi      = (estimated_value - estimated_cost) / estimated_cost
```

---

## 35. `roi_model_kpi`

**Rôle :** Table de jointure reliant un modèle ROI aux KPI qu'il a consommés pour son calcul. Permet de tracer la provenance des données utilisées.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `roi_model_id` | UUID | FK → `roi_model.id`, PK partielle | Modèle ROI |
| `kpi_id` | UUID | FK → `kpi.id`, PK partielle | KPI consommé |

**Clé primaire composite :** `(roi_model_id, kpi_id)`

---

## 36. `recommendation`

**Rôle :** Suggestion générée automatiquement à destination du tenant, basée sur l'analyse des KPI et du modèle ROI. Exemples : "Votre temps de réponse moyen est de 6h — réduire à 2h augmenterait votre taux de conversion de ~20%".

**RLS activée.**

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `g3h4i5j6-...` |
| `tenant_id` | UUID | FK → `tenant.id`, NN, IDX | Tenant destinataire | `a1b2c3d4-...` |
| `roi_model_id` | UUID | FK → `roi_model.id`, NN | Modèle ROI ayant généré cette suggestion | `f2g3h4i5-...` |
| `type` | VARCHAR(50) | NN | Type : `response_time`, `conversion_rate`, `content_gap`, `channel_add`, `absence_detected` | `response_time` |
| `priority` | VARCHAR(30) | NN, défaut `medium` | Priorité : `low`, `medium`, `high` | `high` |
| `message` | TEXT | NN | Texte de la recommandation affiché au tenant | `Votre délai de réponse moyen est de 6h. En répondant sous 2h, vous pourriez convertir ~20% de leads supplémentaires.` |
| `status` | VARCHAR(30) | NN, défaut `active` | État : `active`, `dismissed`, `applied` | `active` |
| `created_at` | TIMESTAMP | NN, défaut `NOW()` | Date de création | `2026-05-01 00:15:00` |

---

# CATÉGORIE : AGENTS IA

---

## 37. `agent_config`

**Rôle :** Configuration d'un agent IA pour un tenant donné. Chaque type d'agent (chatbot vitrine, support client, assistant tenant) a sa propre ligne de configuration. Permet au tenant de personnaliser le prompt système, le modèle LLM et la fréquence de synthèse.

**Utilisée par :** Instanciation des agents, Worker de synthèse, Dashboard de configuration.

**RLS activée.**

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `h4i5j6k7-...` |
| `tenant_id` | UUID | FK → `tenant.id`, NN, IDX | Tenant propriétaire | `a1b2c3d4-...` |
| `agent_type` | ENUM | NN | Type d'agent : `vitrine`, `support_client`, `assistant_tenant` | `vitrine` |
| `status` | VARCHAR(30) | NN, défaut `active` | État : `active`, `inactive`, `training` | `active` |
| `model` | VARCHAR(100) | NN, défaut `mistral-small` | Modèle LLM utilisé : `faq_static`, `mistral-small`, `mistral-large` | `mistral-small` |
| `system_prompt` | TEXT | nullable | Prompt système envoyé au LLM pour contextualiser les réponses | `Tu es l'assistant de Yolande, infirmière à Halle...` |
| `synthesis_schedule_minutes` | INT | NN, défaut `180` | Fréquence en minutes du Worker de synthèse (Agent 3 uniquement) | `180` |
| `created_at` | TIMESTAMP | NN, défaut `NOW()` | Date de création | `2026-02-01 10:00:00` |
| `updated_at` | TIMESTAMP | NN, défaut `NOW()` | Date de dernière modification | `2026-04-10 09:00:00` |

**Contrainte :** `UNIQUE(tenant_id, agent_type)` — un tenant ne peut avoir qu'une configuration par type d'agent.

**Règles métier :**
- `synthesis_schedule_minutes` n'est pertinent que pour le type `assistant_tenant`
- Un agent `inactive` ne répond plus mais sa configuration est conservée
- Le `system_prompt` doit être validé pour éviter tout contenu hors-sujet (injection de prompt)

---

## 38. `agent_link`

**Rôle :** Token d'accès sécurisé remis au client converti pour accéder à l'Agent 2 (Support & RDV) via WhatsApp. Chaque lien est unique, signé, expirant, et lié à un contact précis. Garantit qu'un numéro WhatsApp correspond bien à un contact identifié.

**Utilisée par :** Génération du lien/QR code post-conversion, authentification de l'Agent 2.

**RLS activée.**

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `i5j6k7l8-...` |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant émetteur | `a1b2c3d4-...` |
| `contact_id` | UUID | FK → `contact.id`, NN, IDX | Contact destinataire du lien | `n4o5p6q7-...` |
| `token` | VARCHAR(512) | NN, UQ | JWT signé (HS256) embarquant `contact_id`, `tenant_id`, `exp` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `channel` | VARCHAR(30) | NN, défaut `whatsapp` | Canal cible : `whatsapp`, `telegram` | `whatsapp` |
| `expires_at` | TIMESTAMP | NN | Date d'expiration du token | `2026-07-22 10:00:00` |
| `used_at` | TIMESTAMP | nullable | Date de première utilisation — token invalidé après usage | `2026-04-22 14:30:00` |
| `created_at` | TIMESTAMP | NN, défaut `NOW()` | Date de génération | `2026-04-22 10:00:00` |

**Règles métier :**
- Un token déjà utilisé (`used_at` non null) est rejeté — usage unique
- Un token expiré (`expires_at < NOW()`) est rejeté
- La durée d'expiration est configurable par le tenant (30, 60, 90 jours)
- Un contact peut avoir plusieurs liens (si le tenant en génère un nouveau), mais un seul actif à la fois

---

## 39. `ocr_summary`

**Rôle :** Résumé structuré extrait par OCR d'un document envoyé par un client à l'Agent 2 (ordonnance, dossier médical, image médicale). **Le document source n'est jamais persisté en base** — seul ce résumé chiffré est conservé pour préparer le rendez-vous.

**Utilisée par :** Agent 2 (Support & RDV), préparation des rendez-vous, historique contact.

**RLS activée. Données de santé (Article 9 RGPD) → `summary_encrypted` chiffré via `pgcrypto`.**

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `j6k7l8m9-...` |
| `tenant_id` | UUID | FK → `tenant.id`, NN | Tenant concerné | `a1b2c3d4-...` |
| `contact_id` | UUID | FK → `contact.id`, NN, IDX | Contact ayant envoyé le document | `n4o5p6q7-...` |
| `appointment_id` | UUID | FK → `appointment.id`, nullable, IDX | Rendez-vous préparé par ce document | `z6a7b8c9-...` |
| `summary_encrypted` | TEXT | NN | Résumé chiffré (pgcrypto) extrait par OCR | `[contenu chiffré]` |
| `document_type` | VARCHAR(100) | nullable | Type de document identifié : `ordonnance`, `analyse_sang`, `imagerie`, `autre` | `ordonnance` |
| `processed_at` | TIMESTAMP | NN, défaut `NOW()` | Date de traitement OCR | `2026-04-18 10:15:00` |
| `created_at` | TIMESTAMP | NN, défaut `NOW()` | Date de création | `2026-04-18 10:15:00` |

**Règles métier :**
- Le fichier original (image, PDF) est traité en mémoire puis immédiatement détruit — jamais stocké sur disque ou en base
- `summary_encrypted` doit être déchiffré au niveau applicatif, jamais exposé brut dans les logs
- Soumis au droit à l'oubli RGPD : supprimé lors de l'anonymisation du contact

---

## 40. `agent_synthesis`

**Rôle :** Résumé consolidé produit par le Worker 4 à intervalles réguliers. Agrège les conversations tenues par les agents 1 et 2 sur une période donnée et pousse le résultat à l'Agent 3 (Assistant Tenant) pour notification au professionnel.

**Utilisée par :** Worker de synthèse (Worker 4), Agent 3 (notification tenant), Dashboard back-office.

**RLS activée.**

| Colonne | Type | Contraintes | Description | Exemple |
|---|---|---|---|---|
| `id` | UUID | PK, NN | Identifiant unique | `k7l8m9n0-...` |
| `tenant_id` | UUID | FK → `tenant.id`, NN, IDX | Tenant concerné | `a1b2c3d4-...` |
| `agent_config_id` | UUID | FK → `agent_config.id`, NN | Configuration de l'agent ayant déclenché la synthèse | `h4i5j6k7-...` |
| `content` | TEXT | NN | Texte du résumé consolidé généré par le LLM | `Entre 07h00 et 10h00 : 3 nouvelles demandes de RDV...` |
| `period_start` | TIMESTAMP | NN, IDX | Début de la période couverte par la synthèse | `2026-04-22 07:00:00` |
| `period_end` | TIMESTAMP | NN, IDX | Fin de la période couverte | `2026-04-22 10:00:00` |
| `delivered_at` | TIMESTAMP | nullable | Date de livraison effective au tenant (null si en attente) | `2026-04-22 10:00:30` |
| `created_at` | TIMESTAMP | NN, défaut `NOW()` | Date de création | `2026-04-22 10:00:00` |

**Règles métier :**
- Une synthèse couvre exactement la période depuis la dernière synthèse (`period_start` = `period_end` de la précédente)
- `delivered_at` null = livraison en attente (retry possible en cas d'erreur WhatsApp/Dashboard)
- Conservé 90 jours puis supprimé (données opérationnelles non critiques)

---

## Récapitulatif des relations clés

```
tenant ──< membership >── app_user
tenant ──< site ──< page
tenant ──< subscription ──< invoice
tenant ──< partner_account ──< contact ──< lead ──< appointment
tenant ──< conversation ──< message
tenant ──< chatbot ──< knowledge_base ──< knowledge_document
tenant ──< calendar ──< availability_slot
tenant ──< dashboard ──< kpi
tenant ──< roi_model ──< recommendation
site ──< visitor_session ──< tracking_event

-- Agents IA
tenant ──< agent_config           (1 par type d'agent : vitrine / support_client / assistant_tenant)
tenant ──< agent_link >── contact (token WhatsApp remis au client converti)
tenant ──< ocr_summary >── contact, appointment (résumé chiffré, document jamais persisté)
tenant ──< agent_synthesis ──< agent_config (résumés Worker 4 → Agent 3)
```

---

## Glossaire des valeurs d'énumération

| Champ | Valeurs possibles |
|---|---|
| `tenant.status` | `active`, `suspended`, `trial`, `churned` |
| `tenant.business_model` | `b2c`, `b2b`, `hybrid` |
| `app_user.status` | `active`, `inactive`, `banned` |
| `membership.role` | `owner`, `admin`, `collaborator`, `viewer` |
| `subscription.status` | `trialing`, `active`, `past_due`, `canceled`, `paused` |
| `invoice.status` | `pending`, `paid`, `void`, `uncollectible` |
| `site.status` | `draft`, `published`, `unpublished` |
| `site.audience_mode` | `b2c`, `b2b`, `hybrid` |
| `page.type` | `home`, `services`, `about`, `contact`, `b2b_partners`, `legal`, `content` |
| `page.audience_type` | `all`, `b2c`, `b2b` |
| `channel.type` | `site_form`, `email`, `whatsapp`, `telegram` |
| `channel.status` | `connected`, `disconnected`, `error` |
| `conversation.status` | `open`, `pending`, `closed` |
| `message.sender_type` | `user`, `contact`, `chatbot`, `system` |
| `chatbot.model` | `faq_static`, `mistral-small`, `gpt-4o-mini` |
| `lead.status` | `new`, `in_progress`, `to_call`, `scheduled`, `converted`, `lost`, `archived` |
| `lead.priority` | `low`, `normal`, `high`, `urgent` |
| `lead.audience_type` | `b2c`, `b2b` |
| `lead.request_type` | `appointment`, `information`, `quote`, `partnership`, `other` |
| `appointment.type` | `b2c_appointment`, `b2b_coordination`, `phone_call`, `home_visit` |
| `appointment.status` | `pending`, `confirmed`, `canceled`, `completed`, `no_show` |
| `notification.type` | `appointment_reminder_24h`, `appointment_reminder_1h`, `lead_confirmation`, `appointment_confirmation` |
| `notification.status` | `pending`, `sent`, `failed`, `canceled` |
| `tracking_event.event_type` | `page_view`, `form_submit`, `booking_click`, `chatbot_open`, `phone_click` |
| `recommendation.type` | `response_time`, `conversion_rate`, `content_gap`, `channel_add`, `absence_detected` |
| `recommendation.priority` | `low`, `medium`, `high` |
| `agent_config.agent_type` | `vitrine`, `support_client`, `assistant_tenant` |
| `agent_config.status` | `active`, `inactive`, `training` |
| `agent_config.model` | `faq_static`, `mistral-small`, `mistral-large` |
| `agent_link.channel` | `whatsapp`, `telegram` |
| `ocr_summary.document_type` | `ordonnance`, `analyse_sang`, `imagerie`, `autre` |

---

*Document maintenu par Jordan — à synchroniser avec le MPD à chaque modification du schéma. Dernière mise à jour : avril 2026 (v1.1 — ajout catégorie Agents IA : tables 37–40).*
