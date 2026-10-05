# Klientys Présence Digitale

Plateforme multi-tenant permettant aux indépendants et TPE de créer leur site vitrine, gérer leurs leads, prendre des rendez-vous, et intégrer des agents IA.

**Statut :** V1 en production — MVP déployé, agents IA opérationnels  
**Stack :** FastAPI (Python) · Next.js 15 · Supabase · Stripe · Resend · Gemini API  
**Déploiement :** Railway (backend) · Vercel (frontend) · Supabase (BDD + Auth)

---

## Documentation

| Document | Description |
|---|---|
| [`docs/site-internet.md`](docs/site-internet.md) | Périmètre site internet — création, intégration, personnalisation, API, flux de données |
| [`dossier-projet-saas.md`](dossier-projet-saas.md) | Document de référence complet — vision produit, architecture technique, UML, SQL |

---

## Structure du projet

```
SaaS/
├── docs/
│   └── site-internet.md          # Guide détaillé du périmètre site
├── dossier-projet-saas.md        # Doc de référence (vision + architecture)
├── backend/                      # FastAPI (Python)
│   ├── app/
│   │   ├── api/v1/               # Endpoints REST
│   │   │   ├── sites.py          # CRUD sites, offers, testimonials
│   │   │   ├── leads.py          # Leads + endpoint public (formulaire site)
│   │   │   ├── appointments.py   # Rendez-vous
│   │   │   ├── agents.py         # Configuration agents IA
│   │   │   └── subscriptions.py  # Stripe webhooks
│   │   ├── core/                 # Config, clients Supabase (anon + service_role)
│   │   ├── middleware/           # Extraction tenant_id depuis JWT
│   │   ├── models/               # Pydantic schemas (request/response)
│   │   └── services/             # Email (Resend), Scheduler (APScheduler)
│   ├── supabase/migrations/
│   │   ├── 001_mvp_schema.sql    # Schéma complet (toutes les tables)
│   │   ├── 002_seed.sql          # Données initiales (plans, templates)
│   │   ├── 003_agents.sql        # Tables agents IA (agent_config, agent_link…)
│   │   └── 004_fix_service_offer_columns.sql  # Renommage colonnes (à appliquer)
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
└── frontend/                     # Next.js 15 (React 19, App Router)
    ├── app/
    │   ├── page.tsx              # Landing page publique du SaaS
    │   ├── login/                # Authentification Supabase
    │   ├── onboarding/           # Création tenant + profil
    │   ├── dashboard/
    │   │   ├── page.tsx          # Tableau de bord (KPIs, leads, RDV)
    │   │   ├── site-builder/     # Wizard création site (9 étapes)
    │   │   ├── embed/            # Génération snippets chatbot + tracking
    │   │   ├── leads/            # Liste et gestion des leads
    │   │   ├── appointments/     # Liste et gestion des rendez-vous
    │   │   ├── agents/           # Configuration agents IA
    │   │   └── settings/         # Paramètres du compte
    │   └── [tenant]/
    │       ├── page.tsx          # Site public du tenant (rendu SSR)
    │       └── contact-form.tsx  # Formulaire de contact (→ lead)
    └── lib/api.ts                # Client HTTP + Supabase auth
```

---

## Démarrage rapide

### 1. Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Dans l'éditeur SQL, exécuter **tous** les fichiers de `backend/supabase/migrations/`
   dans l'ordre numérique, de `001` à `075`.

> **Attention.** Les migrations ne reconstituent pas exactement le schéma de production :
> la `001` n'a jamais été appliquée telle quelle, et une cinquantaine de colonnes ont été
> ajoutées à la main avant d'être déclarées par la `074`. La référence du schéma réel est
> [`data-catalogue.md`](data-catalogue.md), généré depuis la base. Pour un environnement
> identique à la production, partir d'un dump plutôt que des migrations :
> `supabase db dump --schema public`.

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # Remplir les valeurs

# --reload-dir app est important : le venv vit dans backend/, sans ce drapeau
# un pip install déclenche une tempête de rechargements
uvicorn app.main:app --reload --reload-dir app
```

Swagger : http://localhost:8000/docs

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local       # Remplir les valeurs
npm run dev
```

App : http://localhost:3000

### 4. Tests

```bash
cd backend
python -m unittest discover -s tests -v     # aucune base requise
```

Couvre les fonctions pures de la chaîne de paiement : validation du montant d'acompte,
précédence des features de plan, URLs de redirection, marge sur les domaines. Les chemins
qui touchent Supabase, Stripe ou PayPal demandent un environnement de test réel — le
projet n'utilise pas de mock de base de données.

`pytest` est disponible via `requirements-dev.txt` mais n'est pas nécessaire.

---

## API — Référence complète

### Sites

| Méthode | URL | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/sites/` | JWT | Lister les sites du tenant |
| `POST` | `/api/v1/sites/` | JWT | Créer un site |
| `PATCH` | `/api/v1/sites/{id}` | JWT | Modifier un site (title, site_style…) |
| `POST` | `/api/v1/sites/{id}/publish` | JWT | Publier |
| `POST` | `/api/v1/sites/{id}/unpublish` | JWT | Dépublier |
| `GET` | `/api/v1/sites/{id}/offers` | JWT | Lister les prestations |
| `PUT` | `/api/v1/sites/{id}/offers` | JWT | Remplacer toutes les prestations |
| `GET` | `/api/v1/sites/{id}/testimonials` | JWT | Lister les témoignages |
| `PUT` | `/api/v1/sites/{id}/testimonials` | JWT | Remplacer tous les témoignages |

### Leads

| Méthode | URL | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/leads/` | JWT | Lister les leads du tenant |
| `POST` | `/api/v1/leads/public/{slug}` | Aucune | Créer un lead (formulaire site public) |
| `PATCH` | `/api/v1/leads/{id}` | JWT | Mettre à jour un lead |

### Rendez-vous

| Méthode | URL | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/appointments/` | JWT | Lister les RDV |
| `POST` | `/api/v1/appointments/` | JWT | Créer un RDV |
| `PATCH` | `/api/v1/appointments/{id}` | JWT | Modifier un RDV |

### Agents IA

| Méthode | URL | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/agents/` | JWT | Lister les configurations d'agents |
| `POST` | `/api/v1/agents/` | JWT | Créer une configuration d'agent |
| `PATCH` | `/api/v1/agents/{id}` | JWT | Modifier un agent (modèle, prompt, statut) |

### Abonnements

| Méthode | URL | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/subscriptions/checkout` | JWT | Créer une session Stripe Checkout |
| `POST` | `/api/v1/subscriptions/webhook` | Stripe sig | Webhook Stripe (activation abonnement) |

### Santé

| Méthode | URL | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | Aucune | État de l'API |

---

## Pages frontend

| URL | Description |
|---|---|
| `/` | Landing page publique du SaaS |
| `/login` | Connexion / inscription |
| `/onboarding` | Création du profil tenant après inscription |
| `/dashboard` | Tableau de bord (KPIs, leads récents, RDV à venir) |
| `/dashboard/site-builder` | Wizard de création de site (9 étapes) |
| `/dashboard/embed` | Génération des snippets chatbot + tracking pour site externe |
| `/dashboard/leads` | Liste et gestion des leads |
| `/dashboard/appointments` | Liste et gestion des rendez-vous |
| `/dashboard/agents` | Configuration des agents IA |
| `/dashboard/settings` | Paramètres du compte |
| `/[tenant-slug]` | Site public vitrine du tenant |

---

## Variables d'environnement

### Backend (`.env`)

**Obligatoires** — le backend refuse de démarrer sans elles :

| Variable | Description |
|---|---|
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_ANON_KEY` | Clé publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé admin Supabase (bypass RLS) |
| `RESEND_API_KEY` | Clé API Resend (emails transactionnels) |
| `EMAIL_FROM` | Adresse d'expédition des emails |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret de signature du webhook Stripe |
| `SECRET_KEY` | Secret applicatif |

**Principales optionnelles :**

| Variable | Description |
|---|---|
| `APP_URL` | URL publique du backend — doit être HTTPS pour les webhooks Telegram et PayPal |
| `FRONTEND_URL` / `FRONTEND_URL_PROD` | Origines autorisées (CORS et redirections de paiement) |
| `GEMINI_API_KEY` | Clé API Google Gemini (agents IA) |
| `REDIS_URL` | Rate limiter partagé entre instances. Sans elle, le compteur est local au process et le quota est multiplié par le nombre de workers |
| `STRIPE_DOMAIN_ADDON_PRICE_ID` | Prix Stripe de l'option domaine |
| `DOMAIN_MARKUP_PERCENT` | Marge appliquée au prix OVH (défaut 25) |
| `AGENT_LINK_SECRET` | Signature des liens d'agent |
| `CONTENT_AGENT_SECRET` | Secret partagé de l'agent de contenu (articles en brouillon) |
| `REVALIDATE_SECRET` | Revalidation du cache Next.js — même valeur côté frontend |
| `OVH_*`, `VERCEL_*`, `GOOGLE_*`, `VAPID_*` | Achat de domaines, domaines custom, Analytics, Web Push |

> `SUPABASE_JWT_SECRET` figure encore dans `.env.example` mais n'est plus lue : les JWT sont
> vérifiés via le JWKS de Supabase (`middleware/tenant.py`).

La liste complète et à jour est dans `backend/app/core/config.py`.

### Frontend (`.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique Supabase |
| `NEXT_PUBLIC_API_URL` | URL de l'API FastAPI |

---

## Points techniques notables

### Colonne `site_style` (JSONB)

Toute la configuration visuelle et de tracking d'un site est stockée dans la colonne `site_style` de la table `site` :

```json
{
  "logo_option": "has_logo",
  "primary_color": "#4F46E5",
  "font_style": "modern",
  "pages_enabled": ["home", "about", "services", "contact"],
  "photos_option": "has_photos",
  "photo_urls": { "hero": "...", "about": "...", "services": "", "contact": "" },
  "social_links": { "facebook": "...", "instagram": "", "linkedin": "" },
  "values_list": [{ "icon": "🏥", "title": "...", "description": "..." }],
  "tracking": { "ga4_id": "G-...", "meta_pixel_id": "", "gtm_id": "" },
  "custom_css": ""
}
```

### Isolation multi-tenant

- Le `tenant_id` vient du header **`X-Tenant-Id`**, validé contre la table `membership`
  (bascule multi-espaces). Replis successifs : `app_metadata.tenant_id` du JWT, puis le
  premier membership trouvé. Voir `backend/app/middleware/tenant.py`.
- **Le rôle n'est pas vérifié par ce middleware** — il ne contrôle que l'appartenance. Les
  opérations sensibles (facturation, moyens de paiement) passent par
  `require_owner_or_admin` dans `backend/app/middleware/roles.py`.
- Le backend travaille **systématiquement en service_role**, donc hors RLS : l'isolation
  côté API repose sur les filtres `tenant_id` du code, pas sur Postgres.
- La RLS protège les lectures faites **depuis le navigateur** avec la clé anon. Elle est
  restreinte en `SELECT` seul sur les tables sensibles depuis la migration `071` — les
  policies précédentes, en `FOR ALL` sans `WITH CHECK`, autorisaient aussi l'écriture.

### Normalisation service_offer

La migration `004` est appliquée : la base expose directement `duration_min` et `price_eur`,
il n'y a plus de renommage de colonnes.

`_offer_from_db` / `_offer_to_db` dans `backend/app/api/v1/sites.py` restent utiles pour une
autre raison : ils maintiennent la cohérence entre `image_url` (champ historique, une seule
image) et `photos` (tableau). Une écriture renseigne les deux, une lecture expose `image_url`
comme première photo s'il n'y a pas de tableau.

---

## Déploiement

| Composant | Service | Tier |
|---|---|---|
| Backend FastAPI | Railway | Hobby 5€/mois |
| Frontend Next.js | Vercel | Free |
| Base de données + Auth | Supabase | Free → Pro 25€/mois |
| Emails | Resend | Free (100/jour) |
| Paiements | Stripe | Free + % transaction |
| LLM chatbot | Google Gemini API | Pay-per-use |
