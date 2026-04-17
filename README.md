# SaaS Présence Digitale

Plateforme multi-tenant permettant aux indépendants et TPE de créer leur site vitrine, gérer leurs leads et prendre des rendez-vous.

## Structure

```
SaaS/
├── backend/                  # FastAPI (Python)
│   ├── app/
│   │   ├── api/v1/           # Endpoints REST
│   │   ├── core/             # Config, Supabase clients
│   │   ├── middleware/        # JWT / tenant extraction
│   │   ├── models/           # Pydantic schemas
│   │   └── services/         # Email (Resend), Scheduler (APScheduler)
│   ├── supabase/migrations/  # SQL — schema MVP + seed
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
└── frontend/                 # Next.js 15 (React 19)
    ├── app/
    │   ├── dashboard/        # Interface de gestion
    │   └── [tenant]/         # Site public par tenant
    └── lib/api.ts            # Client HTTP + Supabase auth
```

## Démarrage rapide

### 1. Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Dans l'éditeur SQL, exécuter dans l'ordre :
   - `backend/supabase/migrations/001_mvp_schema.sql`
   - `backend/supabase/migrations/002_seed.sql`

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

## Endpoints API

| Méthode | URL | Description |
|---------|-----|-------------|
| GET | /api/v1/sites/ | Lister les sites du tenant |
| POST | /api/v1/sites/ | Créer un site |
| PATCH | /api/v1/sites/{id} | Modifier un site |
| POST | /api/v1/sites/{id}/publish | Publier |
| GET | /api/v1/leads/ | Lister les leads |
| POST | /api/v1/leads/public/{slug} | Créer un lead (public) |
| PATCH | /api/v1/leads/{id} | Mettre à jour un lead |
| GET | /api/v1/appointments/ | Lister les RDV |
| POST | /api/v1/appointments/ | Créer un RDV |
| PATCH | /api/v1/appointments/{id} | Modifier un RDV |
| POST | /api/v1/subscriptions/checkout | Créer session Stripe |
| POST | /api/v1/subscriptions/webhook | Webhook Stripe |
| GET | /health | Santé de l'API |

## Variables d'environnement

### Backend (`.env`)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_ANON_KEY` | Clé publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé admin Supabase (bypass RLS) |
| `SUPABASE_JWT_SECRET` | Secret JWT Supabase |
| `RESEND_API_KEY` | Clé API Resend (emails) |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret webhook Stripe |
| `FRONTEND_URL` | URL du frontend (CORS) |

### Frontend (`.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique Supabase |
| `NEXT_PUBLIC_API_URL` | URL de l'API FastAPI |

## Déploiement

- **Backend** : Railway (free tier → 5€/mois) — pointer sur le `Dockerfile`
- **Frontend** : Vercel (free tier) — déploiement automatique depuis GitHub
- **Base de données** : Supabase (free tier → 25€/mois Pro)
