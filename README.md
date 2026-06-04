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
2. Dans l'éditeur SQL, exécuter dans l'ordre :
   ```
   backend/supabase/migrations/001_mvp_schema.sql
   backend/supabase/migrations/002_seed.sql
   backend/supabase/migrations/003_agents.sql
   ```
3. Migration optionnelle (renommage colonnes service_offer) :
   ```
   backend/supabase/migrations/004_fix_service_offer_columns.sql
   ```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # Remplir les valeurs
uvicorn app.main:app --reload
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

| Variable | Description |
|---|---|
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_ANON_KEY` | Clé publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé admin Supabase (bypass RLS) |
| `SUPABASE_JWT_SECRET` | Secret JWT Supabase |
| `RESEND_API_KEY` | Clé API Resend (emails transactionnels) |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret webhook Stripe |
| `FRONTEND_URL` | URL du frontend (CORS) |
| `GEMINI_API_KEY` | Clé API Google Gemini (chatbot IA) |

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

- **RLS PostgreSQL** activée sur toutes les tables métier — chaque requête ne peut lire que les données du tenant courant
- Le `tenant_id` est extrait du JWT Supabase (`app_metadata.tenant_id`) par le middleware backend
- Le backend utilise le **service_role** pour bypass RLS quand nécessaire (opérations cross-tenant)

### Mapping colonnes service_offer

La table `service_offer` en base a des noms de colonnes qui diffèrent du modèle applicatif. Un mapping est maintenu dans `backend/app/api/v1/sites.py` (`_offer_from_db` / `_offer_to_db`) en attendant que la migration 004 soit appliquée.

| Colonne DB | Alias API |
|---|---|
| `duration_minutes` | `duration_min` |
| `price_from` | `price_eur` |

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
