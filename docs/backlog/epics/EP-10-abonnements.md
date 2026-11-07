# EP-10 · Abonnements, essai & monétisation

**Objectif** : convertir l'essai gratuit en abonnement payant, facturer juste (ni plus ni moins que la grille tarifaire), et ne jamais couper un client qui finit par payer.

**Plans** : Essentiel (29,90 €/mois) · Pro (59,90 €/mois) · Business (99,90 €/mois). Essai de 14 jours sans carte.

**Périmètre code** : `backend/app/services/subscription.py` (`get_tenant_plan`, `merge_plan_features`, `_apply_overrides`), `backend/app/api/v1/subscriptions.py` (checkout, portail, webhook), `frontend/contexts/SubscriptionContext.tsx`, `TrialBanner` et `ContactLimitBanner` (`dashboard/layout.tsx`), `UpgradeGate`, Paramètres → Abonnement, migrations `019`, `024`, `031`, `045`, `057`, `071`→`073`

**Personas** : Pro (owner/admin), Opérateur Klientys

---

## User stories

### US-10.01 · Essayer Klientys gratuitement 14 jours
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux tester l'outil sans carte bancaire afin de juger sur pièce avant de payer.

**Critères d'acceptation**
- Sans abonnement Stripe : `trial` (features Essentiel) pendant 14 jours depuis `tenant.created_at` ou jusqu'à `trial_extended_until`.
- Au-delà : `trial_expired`, toutes les features à `false` / `0`.
- Bannière teal (> 3 jours), ambre / rouge (≤ 3 jours), overlay bloquant à l'expiration avec « Choisir un plan → ».

**Tickets** : KLT-1004

### US-10.02 · Souscrire un plan
**Statut** : ✅ Livré · **Persona** : Owner, Admin

> En tant qu'**owner**, je veux choisir un plan et payer par carte afin de continuer à utiliser Klientys.

**Critères d'acceptation**
- `POST /subscriptions/checkout` (owner/admin) → Stripe Checkout, carte uniquement.
- `success_url` / `cancel_url` validées contre les origines autorisées.
- 409 si un abonnement `active` / `trialing` / `past_due` existe déjà ; le customer Stripe existant est réutilisé.
- Le bouton « Choisir → » reste visible pendant l'essai (`hasRealStripeSub`).

**Tickets** : KLT-1001, KLT-1002, KLT-1003, KLT-1010, KLT-1013

### US-10.03 · Gérer mon abonnement
**Statut** : ✅ Livré · **Persona** : Owner, Admin

> En tant qu'**owner**, je veux accéder à mes factures, changer de carte ou résilier afin de gérer mon abonnement en autonomie.

**Critères d'acceptation**
- `POST /subscriptions/billing-portal` (owner/admin) → portail Stripe.
- 404 propre (pas 500) si aucun abonnement Stripe.

**Tickets** : KLT-1014

### US-10.04 · Accéder aux fonctionnalités de mon plan, et à elles seules
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro payant**, je veux disposer exactement de ce que promet la grille tarifaire afin d'en avoir pour mon argent.

**Critères d'acceptation**
- `PLAN_FEATURES` (code) est la source de vérité : `{**db, **hardcoded}` ; les clés présentes uniquement en base restent prises en compte.
- `hasFeature(key)` côté frontend, `UpgradeGate` sur les écrans gated.
- Limites numériques appliquées côté serveur (contacts, membres, espaces, photos, pièces jointes).

**Tickets** : KLT-1005

### US-10.05 · Garder l'accès pendant un incident de paiement
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro** dont la carte a été refusée, je veux une période de grâce afin de régulariser sans perdre mon service.

**Critères d'acceptation**
- `past_due` conserve les features du plan pendant 7 jours depuis `subscription.past_due_since` (`grace_days_left`).
- Barre rouge / or non bloquante avec jours restants et lien vers le portail.
- Ensuite : retour à la logique d'essai → `trial_expired`.

**Tickets** : KLT-1011

### US-10.06 · Être facturé une seule fois par paiement réel
**Statut** : ✅ Livré · **Persona** : Pro, Opérateur

> En tant qu'**opérateur**, je veux que chaque événement Stripe soit traité une seule fois et seulement après encaissement afin de ne jamais livrer sans paiement ni doubler un reçu.

**Critères d'acceptation**
- Signature vérifiée ; idempotence par `stripe_event` (traitement maintenu si la table est inaccessible).
- `payment_status ∈ {paid, no_payment_required}` exigé.
- Statut relu via `stripe.Subscription.retrieve()`.
- Événements gérés : `checkout.session.completed`, `async_payment_failed`, `customer.subscription.*`, `charge.refunded`, `charge.dispute.created`.

**Tickets** : KLT-1006, KLT-1007, KLT-1008, KLT-1020

### US-10.07 · Ajouter l'option domaine personnalisé
**Statut** : ✅ Livré · **Persona** : Owner

> En tant qu'**owner**, je veux souscrire l'option domaine afin d'utiliser mon propre nom de domaine.

**Critères d'acceptation**
- `POST /domains/addon/checkout` ; `tenant.custom_domain_addon_sub_id` persisté.
- Résiliation → `custom_domain_addon = false`.

**Tickets** : KLT-1009

### US-10.08 · Offrir une fonctionnalité à un tenant (opérateur)
**Statut** : ✅ Livré · **Persona** : Opérateur

> En tant qu'**opérateur**, je veux activer une feature pour un tenant donné, pour une durée choisie, afin de gérer des gestes commerciaux et des bêta-testeurs.

**Critères d'acceptation**
- `tenant_feature_override` (valeur booléenne ou numérique), durée 7 j / 1 m / 3 m / 6 m / permanent (`expires_at`).
- Appliqué après le calcul du plan (`_apply_overrides`).
- Option « notifier le tenant » : email + notification in-app.

### US-10.09 · Lire un MRR juste
**Statut** : ✅ Livré · **Persona** : Opérateur

> En tant qu'**opérateur**, je veux un MRR unique et fiable afin de piloter l'activité.

**Critères d'acceptation**
- `plan_subscription.price_monthly` seule colonne de référence ; `price_eur` synchronisée par trigger.

**Tickets** : KLT-1012

---

## Tickets

### KLT-1001 · Parcours de souscription incomplet
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-10.02 · **Réf.** : `cced619` (2026-05-15)

**Correction** — Flux checkout et sélection du plan dans Paramètres.

### KLT-1002 · Exceptions Stripe non interceptées au checkout
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-10.02 · **Réf.** : `dc1382f` (2026-05-15)

**Correction** — Erreurs Stripe interceptées et renvoyées proprement au frontend.

### KLT-1003 · Bouton « Choisir » masqué pendant l'essai
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-10.02 · **Réf.** : `155be89` (2026-06-14)

**Cause** — `isCurrent` comparait au nom de plan courant, qui retombe sur « Essentiel » pendant l'essai : un utilisateur en essai ne pouvait pas souscrire Essentiel.

**Correction** — `isCurrent` exige `hasRealStripeSub`.

### KLT-1004 · Fin de période d'essai mal gérée
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-10.01 · **Réf.** : `c1fe36d` (2026-05-17)

**Correction** — Calcul de l'expiration et affichage de l'overlay bloquant.

### KLT-1005 · Clients payants moins bien servis que la grille tarifaire
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-10.04 · **Réf.** : `7efba30` (2026-10-04)

**Problème** — Des valeurs figées en base par la migration `019` gagnaient sur le code : Pro limité à 500 contacts au lieu de 1 000, `analytics_roi` désactivé, Essentiel sans `agent_vitrine` — un Essentiel payant avait moins qu'un compte en essai.

**Correction** — `merge_plan_features` : `{**db, **hardcoded}`.

**À noter** — Une première correction de juin 2026 avait inversé le sens du merge ; la mémoire projet décrit encore l'ancien ordre (voir KLT-1928).

### KLT-1006 · Webhooks Stripe rejoués à chaque relivraison
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-10.06 · **Réf.** : `7efba30`, migration `072`

**Problème** — Stripe relivre jusqu'à 3 jours : un retry renvoyait un reçu au client et rejouait la logique métier.

**Correction** — `_claim_event()` sur la table `stripe_event`.

### KLT-1007 · Achat de domaine OVH déclenché avant l'encaissement
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-10.06 · **Réf.** : `7efba30`

**Problème** — `checkout.session.completed` précède l'encaissement avec un moyen asynchrone (SEPA, Bancontact différé) : le domaine était acheté sans argent reçu.

**Correction** — `_session_is_paid()` ; carte uniquement sur tous les Checkout.

### KLT-1008 · Statut d'abonnement écrit « active » en dur
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-10.06 · **Réf.** : `7efba30`

**Correction** — Statut relu chez Stripe (`trialing`, `incomplete` n'étaient plus visibles).

### KLT-1009 · Option domaine active à vie après résiliation
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-10.07 · **Réf.** : `7efba30`, migration `072`

**Cause** — L'id de l'abonnement addon n'était pas conservé (`subscription` porte un `UNIQUE(tenant_id)`).

**Correction** — `tenant.custom_domain_addon_sub_id` + traitement de `customer.subscription.deleted`.

### KLT-1010 · Double abonnement facturé en silence
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-10.02 · **Réf.** : `7efba30`

**Problème** — Un second Checkout écrasait la ligne `subscription` ; l'ancien abonnement Stripe continuait de facturer.

**Correction** — 409 si un abonnement actif existe ; réutilisation du customer.

### KLT-1011 · Accès coupé au premier échec de prélèvement
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-10.05 · **Réf.** : `7efba30`

**Correction** — Grâce de 7 jours (`PAST_DUE_GRACE_DAYS`), Stripe relançant la carte pendant deux à trois semaines.

### KLT-1012 · Deux MRR divergents dans l'admin
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-10.09 · **Réf.** : migration `073_single_plan_price.sql`

**Cause** — Deux colonnes de prix (`price_monthly`, `price_eur`) lues par deux écrans.

**Correction** — Colonne unique, trigger `sync_plan_price`.

### KLT-1013 · Redirection Stripe vers n'importe quelle URL
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-10.02 · **Réf.** : `7efba30`

**Correction** — `core/urls.safe_redirect_url()` valide l'origine (open redirect fermé).

### KLT-1014 · Portail de facturation en erreur 500 sans abonnement
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-10.03 · **Réf.** : `0f6e6fd` (2026-06-04)

**Correction** — Recherche par `stripe_customer_id`, repli sur l'abonnement ; 404 propre sinon. Requête `trialing` corrigée.

### KLT-1020 · Tests d'intégration sur le mode test Stripe
**Type** : Qualité · **Statut** : 🟡 Partiel · **Priorité** : P1 · **US** : US-10.06 · **Réf.** : non commité (2026-11-03) · `7efba30` (« Not covered »)

**Réalisation** — Script `backend/scripts/stripe_webhook_check.sh` (5 scénarios via Stripe CLI). Reste : l'exécuter sur une base de recette.

**Constat** — Le webhook est la pièce la plus critique du revenu et n'est testé que par ses fonctions pures.

**Proposition**
1. `stripe listen --forward-to` + `stripe trigger` sur un environnement de recette.
2. Scénarios : checkout carte réussi, SEPA asynchrone (succès puis échec), relivraison du même événement, résiliation de l'addon, litige.
3. Assertions sur `subscription`, `stripe_event`, `payment_incident`, `tenant.custom_domain_addon`.

**Critères de validation** — Les 5 scénarios passent ; une relivraison ne produit ni second email ni second traitement.

**Estimation** — M
