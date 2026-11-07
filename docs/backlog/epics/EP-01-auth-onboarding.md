# EP-01 · Authentification, inscription & onboarding

**Objectif** : permettre à un indépendant non technicien de créer son espace en quelques minutes, de s'y reconnecter sans friction, et d'être guidé dans sa première utilisation.

**Périmètre code** : `frontend/proxy.ts`, `frontend/app/login/`, `frontend/app/onboarding/`, `frontend/app/auth/callback/page.tsx`, `frontend/app/dashboard/onboarding/tours.ts`, `frontend/components/OnboardingCard.tsx`, `backend/app/api/v1/onboarding.py`, `backend/app/api/v1/auth.py`, `backend/app/api/v1/profile.py`, `backend/app/services/tenant_setup.py`

**Personas** : Pro (futur tenant), Opérateur Klientys

---

## User stories

### US-01.01 · S'inscrire par email
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux créer un compte avec mon email et un mot de passe afin d'accéder à Klientys sans dépendre d'un compte tiers.

**Critères d'acceptation**
- `signUp` envoie un email de confirmation dont le lien pointe vers `/auth/callback` (`emailRedirectTo` obligatoire).
- Les données saisies avant confirmation (`klientys_pending_setup`, localStorage) sont reprises au retour pour créer le tenant.
- Après confirmation, l'utilisateur arrive sur `/dashboard` avec son espace créé.

**Tickets** : KLT-0107

### US-01.02 · Se connecter avec Google
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux me connecter avec mon compte Google afin de ne pas gérer un mot de passe de plus.

**Critères d'acceptation**
- Le callback échange le code PKCE contre une session.
- Sans membership : redirection `/onboarding?from=google` (session active, onboarding accessible connecté).
- Avec membership : redirection `/dashboard`.
- Les tokens Google sont sauvegardés pour GA4 (`POST /analytics/google/connect`).

**Tickets** : KLT-0103, KLT-0104

### US-01.03 · Se connecter avec LinkedIn ou Facebook
**Statut** : 🟡 Partiel · **Persona** : Pro

> En tant que **pro**, je veux utiliser LinkedIn ou Facebook pour me connecter afin de choisir le compte que j'utilise déjà.

**Critères d'acceptation**
- LinkedIn OIDC fonctionnel (livré en juin 2026, commit `d9e5303`).
- Facebook OAuth intégré, bouton **masqué** tant que l'application Meta n'est pas validée.

**Tickets** : KLT-0121

### US-01.04 · Réinitialiser mon mot de passe
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux recevoir un lien de réinitialisation afin de récupérer mon compte si j'ai oublié mon mot de passe.

**Critères d'acceptation**
- Le lien reçu ouvre une page de saisie du nouveau mot de passe, puis connecte l'utilisateur.
- Un compte OAuth (Google) ne voit pas le formulaire de mot de passe dans Sécurité.

**Tickets** : KLT-0108

### US-01.05 · Créer mon espace professionnel (onboarding)
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux renseigner mon activité, mon secteur et mon pays afin d'obtenir un espace et un site préconfigurés pour mon métier.

**Critères d'acceptation**
- Étapes : identité → secteur → pays (`frontend/lib/countries.ts`, défaut `BE`).
- Le tenant, sa membership `owner`, son calendrier (avec créneaux par défaut) et ses enregistrements de base sont créés (`provision_tenant`).
- Redirection vers `/dashboard/site-builder?template=auto` qui pré-remplit l'assistant selon le secteur.
- `?no_tenant=1` : l'onboarding re-vérifie l'existence du tenant avant d'afficher le formulaire.

**Tickets** : KLT-0102, KLT-0105, KLT-0106

### US-01.06 · Protéger l'accès au dashboard et à l'admin
**Statut** : ✅ Livré · **Persona** : Pro, Opérateur

> En tant que **pro**, je veux que mon espace ne soit accessible qu'une fois connecté afin que mes données restent privées.

**Critères d'acceptation**
- `proxy.ts` redirige vers `/login` sans cookie `sb-*-auth-token` sur `/dashboard/*` et `/admin/*`.
- Un utilisateur connecté sur `/login` est envoyé sur `/dashboard`.
- `/login?redirect=` renvoie à la page demandée après connexion.
- Une session expirée ne crée pas de boucle `/login` ↔ `/dashboard`.
- Les comptes support / super admin sont envoyés sur `/admin`, jamais sur l'onboarding.

**Tickets** : KLT-0101, KLT-0109, KLT-0111

### US-01.07 · Être guidé par des visites interactives
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro non technicien**, je veux une visite guidée de chaque page afin de comprendre l'outil sans lire de documentation.

**Critères d'acceptation**
- 14 tours Onborda (welcome, dashboard, leads, contacts, rappels, agenda, site-builder, analytics, agents, factures, campagnes, widgets, secrétaire, settings).
- Le tour `welcome` démarre seul au premier login sur desktop (`user_metadata.onboarding_done`).
- Un tour lancé depuis une autre page navigue d'abord vers sa page (`klientys_pending_tour`).
- Les tours dont la feature n'est pas incluse dans le plan sont masqués (`TOUR_REQUIRED_FEATURE`).
- Les ids DOM ciblés sont toujours présents (jamais conditionnels).

**Tickets** : KLT-0110

### US-01.08 · Suivre la complétion de mon profil
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux voir ce qu'il me reste à configurer afin d'avoir un espace opérationnel rapidement.

**Critères d'acceptation**
- `GET /profile/completion` renvoie un score 0-100 (titre, photos, créneaux, prestations, publication).
- `CompletionCard` sur le dashboard liste les étapes manquantes.
- Le même score est visible par l'opérateur dans la fiche tenant.

### US-01.09 · Sécuriser mon compte par un second facteur
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux activer une authentification à deux facteurs afin que le vol de mon mot de passe ne suffise pas à accéder aux données de mes clients.

**Critères d'acceptation**
- Activation TOTP depuis Paramètres → Sécurité (Supabase Auth MFA).
- Connexion avec 2FA activée : saisie du code exigée.
- Codes de secours ou procédure de récupération documentée.
- Obligatoire pour les comptes super admin.

**Tickets** : KLT-0120

---

## Tickets

### KLT-0101 · Boucle de redirection entre /login et /dashboard
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-01.06 · **Réf.** : `7b87d70`, `22f4619` (2026-05-16)

**Problème** — Avec une session expirée, l'utilisateur rebondissait sans fin entre `/login` et `/dashboard`.

**Cause** — `proxy.ts` ne teste que la présence du cookie Supabase. Le cookie expiré restait présent : le proxy envoyait sur `/dashboard`, le layout constatait l'absence de session et renvoyait sur `/login`.

**Correction** — `dashboard/layout.tsx` appelle `supabase.auth.signOut({ scope: "local" })` avant toute redirection vers `/login`, ce qui vide le cookie et casse la boucle.

**Vérification** — Expirer manuellement la session (supprimer le refresh token), recharger `/dashboard` : une seule redirection vers `/login`.

### KLT-0102 · Chargement infini de l'onboarding en production
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-01.05 · **Réf.** : `a5091aa` (2026-05-16)

**Problème** — La page d'onboarding ne finissait jamais de charger en production.

**Cause** — Une fonction `pageWrap()` définie dans le composant et appelée dans le `return` : React perdait l'identité du sous-arbre et reconstruisait tout le DOM à chaque rendu.

**Correction** — `return` unique et inconditionnel, contenu conditionnel à l'intérieur. Règle ajoutée à CLAUDE.md (section « Pages login & onboarding »).

### KLT-0103 · Onboarding cassé après connexion Google
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-01.02 · **Réf.** : `a5091aa`, `bdc2297` (2026-05-16)

**Problème** — Un nouvel utilisateur Google n'arrivait pas à terminer son onboarding.

**Cause** — `/onboarding` était réservé aux visiteurs non connectés ; or le callback Google arrive avec une session active.

**Correction** — `/onboarding` accessible aux utilisateurs connectés ; le callback redirige vers `/onboarding?from=google` quand aucune membership n'existe.

### KLT-0104 · Série de corrections OAuth Google
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-01.02 · **Réf.** : `f22e8d1` → `e290a74` (6 commits, 2026-05-27)

**Problème** — Connexion Google instable après la mise en production du domaine `klientys.co`.

**Correction** — Alignement de la configuration Supabase (Site URL `https://klientys.co`, Redirect URL `https://klientys.co/auth/callback`) et du code du callback. Configuration documentée dans CLAUDE.md.

**À retenir** — Six commits successifs pour un problème de configuration : un ticket de recette « connexion OAuth sur preview Vercel et production » éviterait de déboguer directement en production.

### KLT-0105 · Faux « pas d'espace » au démarrage à froid du backend
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-01.05 · **Réf.** : `0f6e6fd` (2026-06-04)

**Problème** — Des tenants existants étaient renvoyés vers l'onboarding.

**Cause** — Le callback interprétait un timeout de `GET /auth/me/tenants` (cold start Railway, JWKS lent) comme « aucun tenant ».

**Correction** — 3 tentatives avec backoff (800 ms × n° de tentative) ; un `401` interrompt immédiatement la boucle.

### KLT-0106 · Re-vérification du tenant dans l'onboarding
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-01.05 · **Réf.** : `0f6e6fd` (2026-06-04)

**Problème** — Même après KLT-0105, un échec réseau persistant pouvait forcer un tenant existant à refaire l'onboarding.

**Correction** — Avec `?no_tenant=1`, l'onboarding rappelle `GET /auth/me/tenants` avant d'afficher le formulaire et redirige vers `/dashboard` si le tenant existe.

### KLT-0107 · Le lien de confirmation d'email ne menait nulle part
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-01.01 · **Réf.** : `2766dac` (2026-05-16)

**Cause** — `signUp` sans `emailRedirectTo` : Supabase ne savait pas où renvoyer l'utilisateur.

**Correction** — `emailRedirectTo: ${origin}/auth/callback`.

### KLT-0108 · Mot de passe oublié non fonctionnel
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-01.04 · **Réf.** : `56fb165` → `7eaae70` (4 commits, 2026-06-09)

**Correction** — Flux de réinitialisation reconstruit (envoi du lien, page de saisie, échange de session).

### KLT-0109 · Le paramètre ?redirect= était ignoré après connexion
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-01.06 · **Réf.** : `9b6ccb8` (2026-05-26)

**Problème** — Depuis la bannière de prévisualisation, un utilisateur déconnecté qui se reconnectait atterrissait sur `/dashboard` au lieu de revenir publier son site.

**Correction** — `login` respecte `?redirect=`.

### KLT-0110 · Carte d'onboarding mal positionnée ou hors écran
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-01.07 · **Réf.** : `d382514`, `ffb475e`, `d6715e4` (2026-05-11)

**Correction** — Un `useEffect` corrige le `left` du conteneur Onborda quand la carte dépasse le viewport (`requestAnimationFrame` + `getBoundingClientRect`). `currentStep` traité comme 0-indexé.

### KLT-0111 · Comptes support envoyés vers l'onboarding
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-01.06 · **Réf.** : CLAUDE.md (section callback)

**Correction** — Si `app_metadata.support_role` ou `is_super_admin`, le callback redirige directement vers `/admin`.

### KLT-0120 · Ajouter l'authentification à deux facteurs
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-01.09 · **Réf.** : non commité (2026-11-03) · —

**Réalisation** — TOTP Supabase : `components/MfaSettingsCard.tsx` (Paramètres → Sécurité), page `/auth/mfa`, redirection depuis la connexion et les layouts (`lib/mfa.ts`). Côté admin, `ADMIN_REQUIRE_MFA=true` exige `aal2` — désactivé par défaut pour ne pas bloquer l'accès avant enrôlement.

**Contexte** — Aucune 2FA n'existe. Le dossier commercial Eukalypton l'assume explicitement (« pas de 2FA »), mais c'est une question récurrente des clients B2B, et un compte pro donne accès aux données personnelles de tous ses clients — voire à des données de santé (infirmières, kinés).

**Proposition**
1. Activer Supabase Auth MFA (TOTP).
2. Écran d'enrôlement dans Paramètres → Sécurité (QR code + vérification).
3. Étape de challenge au login quand un facteur est enrôlé (`aal2`).
4. Exiger `aal2` côté backend pour les routes `/admin/*` (`get_current_admin`).

**Critères de validation** — Un compte enrôlé ne peut pas accéder au dashboard avec le seul mot de passe ; un super admin sans 2FA est refusé sur `/admin`.

**Estimation** — M

### KLT-0121 · Activer la connexion Facebook après validation Meta
**Type** : Amélioration · **Statut** : ⬜ À faire · **Priorité** : P3 · **US** : US-01.03 · **Réf.** : `d9e5303`

**Contexte** — L'intégration Facebook OAuth est codée mais le bouton est masqué en attendant la validation de l'application par Meta.

**Proposition** — Suivre la validation Meta, puis démasquer le bouton et tester le flux complet (nouveau compte → onboarding, compte existant → dashboard).

**Estimation** — S
