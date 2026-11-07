# EP-19 · Plateforme, qualité & documentation

**Objectif** : une base qui se déploie sans surprise, se teste automatiquement et se comprend en lisant sa documentation, pour que chaque évolution coûte moins cher que la précédente.

**Périmètre code** : `backend/Dockerfile`, `backend/main.py` / `app/main.py`, `backend/app/core/config.py`, `backend/app/services/scheduler.py`, `backend/supabase/migrations/`, `backend/tests/`, `frontend/package.json`, `frontend/next.config.ts`, `frontend/lib/i18n.ts`, `CLAUDE.md`, mémoire projet

**Hébergement** : backend FastAPI sur Railway (Docker), frontend Next.js 16 sur Vercel, Supabase Pro (sauvegarde quotidienne, rétention 7 jours, pas de PITR), Sentry côté backend.

**Personas** : Développeur, Opérateur

---

## User stories

### US-19.01 · Déployer le backend et le frontend en continu
**Statut** : ✅ Livré · **Persona** : Développeur

> En tant que **développeur**, je veux que chaque push sur `main` se déploie sans intervention afin de livrer souvent.

**Critères d'acceptation**
- Railway : image Docker avec Pango / Cairo (WeasyPrint), port dynamique `${PORT:-8000}`.
- Vercel : build Next.js, chemins relatifs (pas d'alias `@/`).

**Tickets** : KLT-1901, KLT-1902, KLT-1903, KLT-1904, KLT-1905

### US-19.02 · Faire évoluer le schéma de façon reproductible
**Statut** : 🟡 Partiel · **Persona** : Développeur

> En tant que **développeur**, je veux que les migrations décrivent exactement la base de production afin de recréer un environnement identique.

**Critères d'acceptation**
- Migrations numérotées et appliquées dans l'ordre.
- Réconciliation `074` / `075` : colonnes réelles déclarées, contraintes d'unicité des `on_conflict=`, divergences de nommage documentées (« le nom réel fait foi »).
- **Baseline exact (`supabase db dump`) non encore généré.**

**Tickets** : KLT-1906, KLT-1922, KLT-1927

### US-19.03 · Utiliser Klientys dans ma langue
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro belge néerlandophone**, je veux le dashboard en néerlandais afin de travailler dans ma langue.

**Critères d'acceptation**
- fr / en / de / nl : `frontend/lib/i18n.ts`, `useLanguage()`, agents IA multilingues, vocabulaire sectoriel.

### US-19.04 · Exécuter les tâches planifiées de façon fiable
**Statut** : ✅ Livré · **Persona** : Opérateur

> En tant qu'**opérateur**, je veux que rappels, purges et relances s'exécutent une fois et une seule afin de ne ni doubler ni oublier un envoi.

**Critères d'acceptation**
- APScheduler (`Europe/Brussels`) dans le process de l'API : rappels RDV, rappels d'essai, rapport mensuel, purge RGPD, acomptes abandonnés, relances, dépublication automatique.
- **Aucun verrou : chaque instance de l'API exécute toutes les tâches.**

**Tickets** : KLT-1923

### US-19.05 · Être averti des régressions avant la production
**Statut** : ✅ Livré · **Persona** : Développeur

> En tant que **développeur**, je veux que les tests et le build tournent à chaque push afin de ne pas découvrir une régression en production.

**Critères d'acceptation**
- Tests unitaires des fonctions pures : `test_payments.py`, `test_contact_import.py`, `test_invoice_fr.py`, `test_integrations.py` (`python -m unittest discover -s tests -v`).
- **Pas de CI, pas de tests frontend, lint inopérant.**

**Tickets** : KLT-1920, KLT-1921, KLT-1929

### US-19.06 · Diagnostiquer une erreur de production
**Statut** : ✅ Livré · **Persona** : Développeur

> En tant que **développeur**, je veux voir les erreurs de production avec leur contexte afin de corriger avant que le client ne se plaigne.

**Critères d'acceptation**
- Sentry backend (si `SENTRY_DSN`).
- **Erreurs avalées par des `except Exception: pass`, pas de Sentry côté frontend.**

**Tickets** : KLT-1924, KLT-1931

### US-19.07 · Comprendre le projet en lisant sa documentation
**Statut** : ✅ Livré · **Persona** : Développeur

> En tant que **développeur qui rejoint le projet**, je veux une documentation à jour afin de ne pas raisonner sur des informations fausses.

**Critères d'acceptation**
- `CLAUDE.md` : architecture, endpoints, tables, invariants, pièges.
- `docs/` : backlog (ce dossier), périmètre site, dossier investisseurs, SEO, légal.

**Tickets** : KLT-1928

---

## Tickets

### KLT-1901 · Backend non démarré sur Railway (port)
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-19.01 · **Réf.** : `34ef6af`, `b919668`, `1b7747f` (2026-04-23)

**Correction** — Port lu dans `PORT`, évalué par le shell (`sh -c`).

### KLT-1902 · Build Vercel cassé par les alias `@/`
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-19.01 · **Réf.** : `23001f3`, `bbbbd3e` (2026-04-19)

**Correction** — Imports relatifs.

### KLT-1903 · `lib/i18n.ts` exclu du dépôt par le .gitignore
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-19.01 · **Réf.** : `1673e7b`, `c4a5713` (2026-05-07)

**Cause** — Une règle `lib/` destinée au backend excluait aussi `frontend/lib/`.

**Correction** — Règle restreinte au backend, fichier commité.

### KLT-1904 · Dépendances implicites manquantes au build
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-19.01 · **Réf.** : `ef1be26` (2026-05-11), `951c2f4`, `b5d758e`, `c37a3ae`

**Correction** — `framer-motion`, `@radix-ui/react-portal`, `email-validator` déclarés ; versions eslint alignées sur Next 16.

### KLT-1905 · Génération PDF impossible en production
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-19.01 · **Réf.** : `f33d46d`, `44a9728` (2026-06-15)

**Correction** — Dockerfile avec les bibliothèques Pango / Cairo, `requirements.txt` complet.

### KLT-1906 · Base de production et migrations divergentes
**Type** : Dette technique · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-19.02 · **Réf.** : migrations `074`, `075`

**Problème** — `001` jamais appliquée telle quelle, une cinquantaine de colonnes ajoutées à la main, policies RLS hors migrations jusqu'à `071`.

**Correction** — Réconciliation : colonnes réelles, `site_event`, contraintes d'unicité, suppression d'index redondants, tableau des divergences de nommage dans CLAUDE.md.

### KLT-1907 · Environnement virtuel Python versionné
**Type** : Dette technique · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-19.01 · **Réf.** : `8d9a71c`, `2badfb0` (2026-04-17)

**Correction** — `.muntu_saas/`, `.env` et caches retirés et ignorés.

### KLT-1908 · Rechargements en boucle du serveur de développement
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-19.01 · **Réf.** : CLAUDE.md « Commandes utiles »

**Cause** — Le venv vit dans `backend/` : un `pip install` déclenchait une tempête de rechargements, jusqu'à tuer le process.

**Correction** — `--reload-dir app`.

### KLT-1920 · Mettre en place une intégration continue
**Type** : Qualité · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-19.05 · **Réf.** : non commité (2026-11-03) · absence de `.github/`

**Réalisation** — `.github/workflows/ci.yml` : imports backend, pyflakes (noms indéfinis), tests unitaires, lint, build frontend. Le contrôle pyflakes a trouvé un bug réel dès son ajout (KLT-0823).

**Constat** — Aucune CI. Des erreurs qu'un simple import aurait détectées sont arrivées en production (import `BaseModel` manquant → crash au démarrage, KLT-0407 ; fichier `i18n.ts` absent, KLT-1903), et les tests unitaires ne tournent que si quelqu'un y pense.

**Proposition** — Workflow GitHub Actions sur push et PR :
1. Backend : `pip install -r requirements.txt`, `python -c "import app.main"`, `python -m unittest discover -s tests`.
2. Frontend : `npm ci`, `tsc --noEmit`, `npm run build`, lint (KLT-1921).
3. Plus tard : tests sandbox Stripe / PayPal (KLT-1020, KLT-0520) sur déclenchement manuel.

**Critères de validation** — Un commit qui casse l'import du backend ou le build frontend est signalé rouge avant déploiement.

**Estimation** — S

### KLT-1921 · Script `lint` inopérant avec Next.js 16
**Type** : Qualité · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-19.05 · **Réf.** : non commité (2026-11-03) · `frontend/package.json` (`"lint": "next lint"`), aucun fichier de configuration ESLint

**Réalisation** — `eslint.config.mjs` (flat config) ; règles du compilateur React en avertissement (≈ 100 cas existants), apostrophes du JSX désactivées. `npm run lint` passe.

**Constat** — La commande `next lint` a été retirée de Next.js 16, et le frontend n'a pas de configuration ESLint : le lint ne s'exécute pas.

**Proposition** — `eslint.config.mjs` (flat config, `eslint-config-next`), script `"lint": "eslint ."`, correction ou désactivation ciblée des règles qui bloquent, puis ajout à la CI.

**Critères de validation** — `npm run lint` s'exécute et passe.

**Estimation** — S

### KLT-1922 · Générer le baseline exact du schéma de production
**Type** : Dette technique · **Statut** : 🟡 Partiel · **Priorité** : P1 · **US** : US-19.02 · **Réf.** : non commité (2026-11-03) · CLAUDE.md « Schéma de base : les migrations ne sont pas la source de vérité »

**Réalisation** — Script `backend/scripts/dump_schema_baseline.sh`. Reste : le lancer avec l'URL de la base (Supabase CLI requise) et commiter `supabase/baseline/schema.sql`.

**Constat** — Malgré `074` / `075`, rejouer les migrations ne garantit pas une base identique à la production. Un environnement de recette ou une restauration après incident reste approximatif.

**Proposition**
1. `supabase db dump --schema public` (+ policies, fonctions, triggers) → `backend/supabase/baseline/`.
2. Créer un projet Supabase de recette depuis ce baseline et y jouer les tests (sert aussi KLT-0520, KLT-1020).
3. Comparer régulièrement production et baseline (`supabase db diff`).

**Critères de validation** — Un projet neuf créé depuis le baseline passe la recette d'import de contacts (`docs/recette/`).

**Estimation** — M

### KLT-1923 · Tâches planifiées exécutées en double avec plusieurs instances
**Type** : Dette technique · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-19.04 · **Réf.** : non commité (2026-11-03) · `backend/app/services/scheduler.py:10, 561-623`, `backend/app/main.py:17`

**Réalisation** — Bail par tâche (`scheduler_lease` + `claim_scheduler_lease`, migration `082`) autour des 8 jobs ; exécution sans verrou si la fonction est absente.

**Constat** — `start_scheduler()` est appelé au démarrage de chaque process API. Aujourd'hui un seul process tourne (Dockerfile sans `--workers`), mais le jour où Railway passe à 2 réplicas, ou qu'on ajoute des workers pour tenir la charge, chaque rappel de RDV, rappel d'essai et rapport mensuel part en double ou en triple. Certaines tâches ont une déduplication (`trial_reminder_log`), pas toutes.

**Proposition** — Verrou par tâche avec `pg_try_advisory_lock` (via RPC) au début de chaque job, ou service scheduler séparé à instance unique. Commentaire explicite dans le Dockerfile en attendant.

**Critères de validation** — Avec deux instances lancées, un rappel de RDV n'est envoyé qu'une fois.

**Estimation** — S

### KLT-1924 · Erreurs avalées et `.single()` qui lèvent des exceptions
**Type** : Dette technique · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-19.06 · **Réf.** : non commité (2026-11-03) · 21 blocs `except Exception: pass` (`analytics.py`, `auth.py`, `campaigns.py`, `invoices.py`, `members.py`, `reminders.py`, `assistant.py`, `ovh_domains.py`, `trends.py`, `vercel_domains.py`), 84 appels `.single()`, 227 `except Exception`

**Réalisation** — Les 51 `except Exception: pass` du backend journalisent désormais l'erreur avec sa trace. Les `.single()` n'ont pas été passés en revue un par un.

**Constat** — Deux défauts déjà payés en production :
- Un `except` nu a fait disparaître pendant des mois le résumé IA de chaque réservation Telegram (KLT-0803).
- `.single()` lève une exception quand aucune ligne ne correspond, ce qui donne des 500 au lieu de 404 (KLT-0614, KLT-1702). 84 appels restent.

**Proposition**
1. Remplacer chaque `except Exception: pass` par un `logger.warning(..., exc_info=True)` (ou le supprimer s'il masque une vraie erreur).
2. Revoir les 84 `.single()` : `.maybe_single()` + garde `None` quand l'absence est un cas normal ; garder `.single()` seulement là où l'absence est un vrai bug.
3. Règle de revue : pas de `except` sans log.

**Critères de validation** — `grep -rnE "except.*:\s*$" -A1 | grep pass` ne renvoie plus rien ; aucun 500 sur un identifiant inexistant pour les endpoints testés.

**Estimation** — M

### KLT-1925 · Découper les fichiers géants
**Type** : Dette technique · **Statut** : ⬜ À faire · **Priorité** : P3 · **US** : US-19.07 · **Réf.** : `frontend/app/dashboard/settings/page.tsx` (4 150 lignes), `site-builder/page.tsx` (2 083), `appointments/page.tsx` (1 620), `contacts/[id]/page.tsx` (1 340), `dashboard/layout.tsx` (1 263), `lib/i18n.ts` (5 851) ; `backend/app/api/v1/admin.py` (2 917), `webhook.py` (1 854), `booking.py` (1 322)

**Constat** — Ces fichiers concentrent la majorité des corrections récentes ; leur taille rend les revues difficiles et multiplie les conflits.

**Proposition** — Découper au fil des évolutions, sans chantier dédié : une section de Paramètres = un composant (`settings/sections/*.tsx`) ; `admin.py` en sous-routeurs (tenants, billing, content, support) ; `webhook.py` en Telegram / WhatsApp / flux conversationnels ; `i18n.ts` en un fichier par langue.

**Critères de validation** — Aucun fichier au-delà de 1 000 lignes dans les zones modifiées.

**Estimation** — L (étalé)

### KLT-1926 · Réduire les `any` TypeScript
**Type** : Dette technique · **Statut** : ⬜ À faire · **Priorité** : P3 · **US** : US-19.05 · **Réf.** : 280 occurrences de `: any` dans `frontend/app`, `components`, `lib`

**Proposition** — Typer d'abord `lib/api.ts` (réponses des endpoints), ce qui propage les types dans les pages ; activer `noImplicitAny` par répertoire.

**Estimation** — M (étalé)

### KLT-1927 · Fichiers parasites et numéros de migration en double
**Type** : Dette technique · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-19.02 · **Réf.** : non commité (2026-11-03) · `backend/app/api/v1/sites.py:` (fichier vide), `backend/supabase/migrations/007_published_snapshot.sql:`, `008_offer_image_url.sql:` ; numéros en double : `002`, `027`, `055`

**Réalisation** — Fichiers vides supprimés ; `supabase/migrations/README.md` documente l'ordre des numéros en double et la règle pour les suivantes.

**Constat** — Trois fichiers dont le nom se termine par `:` (artefacts créés depuis Windows / OneDrive). Plusieurs migrations partagent un numéro (`002_agents_schema` / `002_seed`, `027_directory_metier_label` / `027_lead_appointment_notes`, `055_content` / `055_support_push`) : l'ordre d'application dépend du tri alphabétique, et un outil de migration peut les refuser.

**Proposition** — Supprimer les fichiers parasites après vérification (vides) ; ne pas renuméroter les migrations déjà appliquées, mais documenter l'ordre réel dans un `README` du dossier et numéroter strictement à partir de `081`.

**Estimation** — XS

### KLT-1928 · Mettre à jour CLAUDE.md et la mémoire projet
**Type** : Documentation · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-19.07 · **Réf.** : non commité (2026-11-03) · `CLAUDE.md:15, 29, 177`, mémoire `project_saas.md`

**Réalisation** — CLAUDE.md corrigé et complété (section « Sécurité transverse », variables d'environnement) ; mémoire projet corrigée.

**Constat** — Écarts relevés pendant la constitution de ce backlog :
- CLAUDE.md annonce « Next.js 14 App Router » et `middleware.ts` dans l'arborescence ; le projet est en Next.js 16 avec `proxy.ts` (la section Authentification est juste).
- « Fichiers SQL de migration (001→076) » : la dernière est `080`.
- `directory_listing` : « migration `026_directory.sql` » ; le fichier est `023_directory_listing.sql`.
- La mémoire projet décrit l'ancien ordre de merge des features (`{**hardcoded, **db}`), inversé depuis KLT-1005, et s'arrête à la migration `047`.

**Proposition** — Corriger ces lignes ; ajouter dans CLAUDE.md un lien vers `docs/backlog/` et la convention de tickets.

**Estimation** — XS

### KLT-1929 · Tests frontend des parcours critiques
**Type** : Qualité · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-19.05 · **Réf.** : non commité (2026-11-03) · aucun test frontend

**Réalisation** — Playwright installé, `playwright.config.ts`, `e2e/security-regressions.spec.ts` (sans base, 2 tests passés en local) et `e2e/booking.spec.ts` (tenant de recette via `E2E_TENANT_SLUG`). Le parcours inscription → publication n'est pas encore écrit.

**Proposition** — Playwright sur 3 parcours : inscription → onboarding → publication du site ; réservation publique sans acompte ; widget `book` dans une page externe. Sur la base de recette (KLT-1922).

**Estimation** — M

### KLT-1930 · Point-in-time recovery Supabase
**Type** : Infrastructure · **Statut** : ⬜ À faire · **Priorité** : P2 · **US** : US-19.02 · **Réf.** : mémoire projet (« PITR non souscrit : perte maximale de 24 h de saisie, assumée »)

**Constat** — Sauvegarde quotidienne seulement : un incident en fin de journée fait perdre les RDV, factures et contacts saisis depuis la veille. C'est assumé dans le dossier commercial, mais devient difficile à défendre avec la facturation (numérotation continue) et les acomptes encaissés.

**Proposition** — Réévaluer le coût du PITR quand le nombre de tenants payants le justifie ; en attendant, tester une restauration une fois par trimestre et noter la durée réelle.

**Estimation** — S (décision)

### KLT-1931 · Remontée des erreurs du frontend
**Type** : Qualité · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-19.06 · **Réf.** : non commité (2026-11-03) · `frontend/package.json` (pas de Sentry)

**Réalisation** — Sans SDK : `components/ErrorReporter.tsx` → `POST /api/v1/client-errors` → Sentry backend. Pas de cookie, chemin sans query string, 5 rapports max par page.

**Constat** — Une erreur JavaScript sur le site d'un tenant ou dans un widget hébergé chez un client n'est vue par personne.

**Proposition** — `@sentry/nextjs` avec échantillonnage, sans données personnelles (`sendDefaultPii: false`), activé seulement après consentement sur les sites publics ; ajouter Sentry à la liste des sous-traitants.

**Estimation** — S

### KLT-1932 · Optimiseur d'images ouvert à tous les domaines
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-19.01 · **Réf.** : non commité (2026-11-03) · `frontend/next.config.ts` (`remotePatterns: [{ protocol: "https", hostname: "**" }]`)

**Réalisation** — `remotePatterns` limité à `*.supabase.co` et `klientys.co` ; les URL libres des tenants passent en `unoptimized` (`lib/imageHost.ts`).

**Constat** — `/_next/image` accepte n'importe quelle image HTTPS : n'importe qui peut faire redimensionner et servir des images tierces par klientys.co, ce qui consomme le quota d'optimisation Vercel et associe le domaine à des contenus arbitraires.

**Proposition** — Restreindre aux domaines réellement utilisés (Supabase Storage du projet, et les quelques hôtes d'images connus) ; les URLs d'images libres des tenants passent par `<img>` ou par un upload dans le Storage.

**Critères de validation** — `/_next/image?url=https://exemple-tiers.com/x.jpg` renvoie 400 ; les images des sites tenant s'affichent toujours.

**Estimation** — S
