# CLAUDE.md — Klientys

## Vue d'ensemble

**Klientys** — SaaS tout-en-un pour indépendants et TPE (infirmières, kinés, artisans…). Chaque tenant obtient un site vitrine public, un système de réservation, un CRM léger, des agents IA de communication, et un tableau de bord analytics avec potentiel de demande locale.

**Stack** : Next.js 14 (App Router) · Tailwind CSS · FastAPI · Supabase (Postgres + Auth + Storage) · Resend (emails) · Google Gemini (IA) · pytrends (Google Trends) · react-leaflet (cartographie)

---

## Architecture

```
SaaS/
├── frontend/          # Next.js 14 App Router
│   ├── app/
│   │   ├── dashboard/ # Interface tenant (protégée)
│   │   ├── [slug]/    # Site public du tenant (vitrine)
│   │   └── login/
│   └── lib/api.ts     # Client API centralisé
├── backend/           # FastAPI
│   ├── app/
│   │   ├── api/v1/    # Endpoints REST
│   │   ├── models/    # Pydantic schemas
│   │   ├── services/  # email, whatsapp, telegram, ocr, lead, trends
│   │   ├── middleware/ # tenant.py (JWT → tenant_id)
│   │   └── core/      # config.py, supabase.py
│   ├── supabase/migrations/  # Fichiers SQL de migration (001→020)
│   └── main.py
└── docs/
```

---

## Multi-tenancy

- Chaque requête API authentifiée passe par `app/middleware/tenant.py` → `get_current_tenant()` → extrait `tenant_id` du JWT Supabase.
- Toutes les tables ont une colonne `tenant_id` (RLS activé côté Supabase).
- Le backend utilise `get_supabase_admin()` (service role key) pour contourner RLS là où c'est nécessaire.

---

## Endpoints clés

| Route | Description |
|-------|-------------|
| `GET/POST /api/v1/appointments/` | CRUD RDV (tenant) |
| `PATCH /api/v1/appointments/{id}` | Modifie un RDV existant (tenant) |
| `POST /api/v1/appointments/{id}/confirm` | Confirme + email client |
| `POST /api/v1/appointments/{id}/cancel` | Annule + email client (avec lien rebooking si RDV était pending) |
| `GET /api/v1/booking/{slug}/slots` | Créneaux libres (public) |
| `POST /api/v1/booking/{slug}/book` | Réservation publique → RDV pending + email tenant |
| `GET /api/v1/booking/{slug}/available-days` | Jours disponibles dans le mois (calendrier public) |
| `PATCH /api/v1/calendar/blocked/{period_id}` | Modifie une période bloquée existante |
| `GET/PATCH /api/v1/agents/config/{type}` | Config agents IA |
| `POST /api/v1/agents/telegram/setup` | Enregistre webhook Telegram |
| `GET /api/v1/sites/` | Sites du tenant |
| `PATCH /api/v1/sites/{id}` | Met à jour le site |
| `POST /api/v1/analytics/event` | Enregistre un événement comportemental (public, via slug) |
| `GET /api/v1/analytics/summary?days=30` | Résumé analytics agrégé (tenant authentifié) |
| `GET /api/v1/analytics/roi-potential?period=month` | Potentiel de demande locale via Google Trends (tenant authentifié, cache 24h) |
| `GET /api/v1/public/site/{slug}` | Données du site publié (public, sans auth) |
| `GET /api/v1/public/site/{slug}?preview=true` | Données du site en draft (public, sans auth) |
| `POST /api/v1/sites/{id}/publish` | Publie le site (set status=published) |
| `GET /api/v1/auth/me/tenant` | Slug + nom du tenant courant (tenant authentifié) |

---

## Base de données (tables principales)

| Table | Description |
|-------|-------------|
| `tenant` | Espace professionnel (slug, name, is_active, sector, country) |
| `site` | Site vitrine (title, tagline, description, address, site_style JSONB) |
| `service_offer` | Prestations (lié au site) |
| `contact` | CRM — clients/prospects |
| `lead` | Demandes entrantes (source, status, request_type) |
| `appointment` | RDV (calendar_id, contact_id, scheduled_at, end_at, status) |
| `calendar` | Calendrier du tenant (1 par tenant) |
| `availability_slot` | Plages horaires disponibles (day_of_week, start_time, end_time) — plusieurs lignes par jour supportées (pauses déjeuner) |
| `blocked_period` | Périodes bloquées (congés, fermeture) |
| `agent_config` | Config agents IA (vitrine, support_client, assistant_tenant) |
| `membership` | Lien user ↔ tenant (owner/admin/member) |
| `site_event` | Événements comportementaux du site public (session_id, event_type, section, data JSONB) |
| `tenant_roi_cache` | Cache 24h du potentiel de demande locale par tenant + période (data JSONB, computed_at) |

### Champ `site_style` (JSONB)

Stocke les préférences visuelles et structurelles sans migration. Sous-clés utiles :

```json
{
  "primary_color": "indigo",
  "font_style": "modern",
  "logo_option": "text_only",
  "logo_url": "",
  "pages_enabled": ["home", "about", "services", "contact"],
  "photos_option": "needs_stock",
  "photo_urls": {},
  "address_parts": { "street": "Rue ...", "postal_code": "1000", "city": "Bruxelles", "country": "BE" },
  "tracking": { "ga4_id": "", "meta_pixel_id": "", "gtm_id": "" }
}
```

L'adresse est stockée à la fois dans `site.address` (string consolidée, pour rétrocompatibilité) et dans `site_style.address_parts` (champs séparés, pour l'affichage dans le site-builder).

---

## Notifications

### Email (Resend)
- `services/email.py` — toutes les fonctions d'envoi
- `send_appointment_pending_tenant` — email tenant quand un nouveau RDV public arrive (statut pending)
- `send_appointment_confirmation` — email client quand un RDV est confirmé
- `send_appointment_cancellation(was_pending=True/False)` — email client sur annulation ou refus d'un RDV pending (propose un nouveau créneau si `was_pending=True`)
- `send_appointment_reminder` — rappel 24h avant

### WhatsApp / Telegram
- Config dans `agent_config` (agent_type = `assistant_tenant`)
- `telegram_bot_token` synchronisé entre `support_client` et `assistant_tenant`
- Webhook Telegram : `POST /api/v1/webhook/telegram/{bot_token}`
- En local, APP_URL doit être une URL HTTPS publique (ngrok)

---

## Site public (`/[slug]`)

- Les données du site sont récupérées via `GET /api/v1/public/site/{slug}` (backend, clé admin) — plus de dépendance à `SUPABASE_SERVICE_ROLE_KEY` côté frontend.
- Mode normal : requiert `status = "published"` (le tenant doit avoir cliqué "Publier" dans le site-builder).
- Mode preview (`?preview=true`) : affiche le brouillon sans filtre de statut + bannière `PreviewBanner`.

## Dashboard principal (`/dashboard`)

- Liens en haut (header) : `/{tenantSlug}` (site publié) et `/{tenantSlug}?preview=1` (preview draft)
- Boutons en bas : "Prévisualiser mon site" (`?preview=1`, toujours actif) et "Voir le site publié" (`/{slug}`)
- Affiche "Site non configuré" (grisé) si le slug n'est pas encore défini
- Le `tenantSlug` est récupéré via `api.getMyTenant()` → `GET /api/v1/auth/me/tenant` (contourne les RLS Supabase)

## Site-builder (`/dashboard/site-builder`)

Wizard 9 étapes :

| Étape | Contenu | Validation |
|-------|---------|-----------|
| 0 | Logo, couleurs, police | — |
| 1 | Pages activées, photos | — |
| 2 | Titre *, tagline, description | `title` obligatoire |
| 3 | Téléphone, email, adresse (rue / CP / ville / **pays**), réseaux | format email |
| 4 | Zones d'intervention (autocomplete Nominatim) | — |
| 5 | Prestations (nom *, description, durée, prix) | nom obligatoire si autres champs remplis |
| 6 | Atouts (icône SVG, titre *, description) | titre obligatoire si description remplie |
| 7 | Témoignages (nom *, contenu *) | nom + contenu obligatoires si l'un est rempli |
| 8 | Analytics (GA4, Meta Pixel, GTM), CSS custom | — |

Les icônes des atouts sont des SVG inline (20 icônes disponibles dans `ATOUT_ICONS`). Les anciennes valeurs emoji restent affichées telles quelles (rétrocompatibilité).

---

## Calendrier dashboard (`/dashboard/appointments`)

- Vues : Jour / Semaine / Mois
- `AvailabilityPanel` : supporte **plusieurs plages horaires par jour** (jusqu'à 3) — permet de gérer les pauses déjeuner. Chaque plage est une ligne `availability_slot` distincte avec le même `day_of_week`.
- `BlockPanel` : périodes bloquées (congés, fermeture exceptionnelle) — modifiables via `PATCH /calendar/blocked/{period_id}`
- Bannière en haut listant les RDV en attente (confirm/refus rapide)
- **Édition RDV** : clic sur un RDV existant ouvre `ApptModal` en mode édition (`PATCH /appointments/{id}`)
- **Override période bloquée** : si le tenant clique sur une cellule pendant une période bloquée, `BlockedOverrideModal` s'affiche avec un avertissement ; il peut tout de même créer le RDV

## Leads (`/dashboard/leads`)

- **Multi-lead par client** : un même contact peut générer plusieurs leads (plusieurs RDV, plusieurs demandes). `ensure_lead()` insère toujours une nouvelle ligne — pas de contrainte d'unicité par contact.
- Les RDV en attente (pending) ont un pipeline restreint : uniquement `new → confirmed / refused`. Les autres sources ont le pipeline complet.
- Source `booking` = réservation publique ; source `contact_form` = formulaire de contact du site vitrine.

## Pays du tenant

- Stocké dans `tenant.country` (code ISO 2 lettres, défaut `"BE"`).
- Migration : `backend/supabase/migrations/017_tenant_country.sql`
- **Onboarding** (`/onboarding`) : sélecteur pays à l'étape 2 (entre secteur et bouton valider), liste complète dans `frontend/lib/countries.ts`.
- **Site-builder** (`/dashboard/site-builder`) : sélecteur pays à l'étape 3 après le champ ville, enregistré dans `site_style.address_parts.country`.
- Le backend (`onboarding.py`, `TenantSetupIn`) accepte `country: str = "BE"` et l'insère dans la table `tenant`.
- Utilisé par le service pytrends pour gérer les tendances locales (ex. recherches google par pays).

---

## Potentiel de demande locale (`/api/v1/analytics/roi-potential`)

Estime la demande pour le secteur du tenant en utilisant **pytrends** (API non officielle Google Trends), filtrée par pays et zones d'intervention.

### Service `backend/app/services/trends.py`

- `SECTOR_KEYWORDS` — dict secteur → liste de mots-clés Google Trends
- `TIMEFRAMES` — week / month / quarter / year → chaînes pytrends (`"now 7-d"`, `"today 1-m"`, etc.)
- `_semaphore = asyncio.Semaphore(3)` — max 3 appels pytrends simultanés (anti rate-limit Google)
- `_geocode(name, country_code)` — géocodage async via Nominatim (OpenStreetMap) pour obtenir lat/lng des zones
- `_run_pytrends(keywords, geo, timeframe, zones)` — exécuté dans un thread via `run_in_executor`
- `get_demand_data(sector, country, zones, period, offer_names)` — fonction principale async

### Endpoint `GET /api/v1/analytics/roi-potential`

- Auth : tenant authentifié
- Paramètre : `period` = `week | month | quarter | year` (défaut `month`)
- Cache 24h dans `tenant_roi_cache` (upsert sur `tenant_id, period`)
- Migration : `backend/supabase/migrations/018_roi_cache.sql`
- Retourne : `aggregate_score` (0-100), `keywords`, `interest_over_time` (série), `zones` (score + lat/lng par ville), `related_queries`, `period`, `cached_at`

### Composants frontend

- **`DemandPotentialCard`** (`frontend/app/dashboard/analytics/DemandPotentialCard.tsx`) — carte partagée : onglets période, score agrégé, mini-graphique SVG, barres par zone, carte heatmap, requêtes associées. Affiche un bandeau amber si le backend est inaccessible (local/prod).
- **`DemandMap`** (`frontend/app/dashboard/analytics/DemandMap.tsx`) — carte react-leaflet avec `CircleMarker` par zone (couleur selon score : vert ≥ 67, amber ≥ 34, rouge < 34). Importé avec `dynamic(..., { ssr: false })` pour éviter les erreurs SSR de Leaflet.

### Intégration dashboard / analytics

- **`/dashboard/analytics`** : `DemandPotentialCard` toujours affiché en bas de page.
- **`/dashboard`** : affiché uniquement si le KPI `demand_potential` est activé (`user_metadata.dashboard_kpis`).
- **`/dashboard/settings`** (section Métriques) : KPI `"Potentiel de demande locale"` ajouté à `METRIC_DEFS`, toggle pour l'activer sur le dashboard. Preview `DemandPotentialCard` affiché dans la section paramètres.

### Dépendances backend

```
pytrends==4.9.2   # pip install pytrends
```

---

## Analytics comportementaux (`/dashboard/analytics`)

Moteur de tracking propriétaire pour le site vitrine — **ne duplique pas GA4/GTM** (déjà configurés par tenant dans le site-builder).

### Tracking côté client (site public `app/[slug]/page.tsx`)

Script injecté via `<Script strategy="afterInteractive">` :
- **Session** : `sessionStorage._pp_sid` = UUID généré à la première visite par onglet
- **`pageview`** : fire immédiat au chargement
- **`section_view`** : IntersectionObserver sur `['hero','a-propos','prestations','contact']`
- **`cta_click`** : délégation sur `[data-track]` (tel, email, réseaux sociaux)
- **`form_open`** / **`form_submit`** : depuis `contact-form.tsx` (helper `_track()` + `data-track-form`)
- **`chatbot_open`** / **`chatbot_message`** : depuis `ChatbotWidget.tsx` (helper `_track()`, `openFired` ref pour unicité)

### Table `site_event`

```sql
create table site_event (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenant(id) on delete cascade,
  session_id text,
  event_type text not null,
  section text,
  data jsonb,
  created_at timestamptz default now()
);
create index on site_event (tenant_id, created_at desc);
create index on site_event (tenant_id, event_type);
```

### Endpoint `GET /api/v1/analytics/summary`

Retourne pour la période choisie (`?days=30`) :
- CRM : `contacts_total`, `leads_total`, `leads_by_source`, `leads_by_status`
- RDV : `appointments_total`, `appointments_by_status`
- Comportemental : `pageviews`, `unique_sessions`, `sections_viewed`, `cta_clicks`, `form_opens`, `form_submits`, `chatbot_conversations`, `chatbot_messages`
- Calculé : `conversion_lead_rate` (leads / sessions), `conversion_appt_rate` (RDV confirmés / leads, plafonné à 100%)

Dégrade gracieusement si la table `site_event` n'existe pas encore (retourne zéros).

---

## Variables d'environnement (backend)

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
GEMINI_API_KEY=
FRONTEND_URL=https://...
APP_URL=https://...          # doit être HTTPS (webhook Telegram)
AGENT_LINK_SECRET=
```

## Variables d'environnement (frontend Vercel)

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=https://...   # URL du backend FastAPI (obligatoire en prod)
```

> `SUPABASE_SERVICE_ROLE_KEY` n'est **pas** nécessaire côté frontend — le backend l'utilise via `GET /api/v1/public/site/{slug}`.

---

## Commandes utiles

```bash
# Backend
cd backend && uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev

# Tunnel local (Telegram webhook)
ngrok http 8000
# puis APP_URL=https://xxx.ngrok-free.app dans .env backend
```

---

## Onboarding guidé (Onborda)

Bibliothèque de tours interactifs intégrée dans le dashboard. Cible des utilisateurs non-techniques : explications en français très simple, zéro jargon.

### Fichiers clés

| Fichier | Rôle |
|---------|------|
| `frontend/app/dashboard/onboarding/tours.ts` | Définitions des 8 tours (`ALL_TOURS`, `TOUR_MENU`, `PAGE_TOUR`) |
| `frontend/components/OnboardingCard.tsx` | Card custom (thème sombre Klientys) |
| `frontend/app/dashboard/layout.tsx` | `OnbordaProvider` + `TourStarter` (auto-start) + `TourHelpMenu` (bouton ?) |

### Tours disponibles

| Tour | Déclencheur | Étapes |
|------|-------------|--------|
| `welcome` | Premier login (localStorage `klientys_welcomed`) | 8 étapes — barre nav |
| `dashboard` | Menu ? sur `/dashboard` | 5 étapes |
| `leads` | Menu ? sur `/dashboard/leads` | 2 étapes |
| `appointments` | Menu ? sur `/dashboard/appointments` | 5 étapes |
| `site-builder` | Menu ? sur `/dashboard/site-builder` | 3 étapes |
| `analytics` | Menu ? sur `/dashboard/analytics` | 3 étapes |
| `agents` | Menu ? sur `/dashboard/agents` | 2 étapes |
| `settings` | Menu ? sur `/dashboard/settings` | 5 étapes |

### IDs DOM requis par les tours

Chaque tour cible des éléments via leur `id` HTML. Les IDs doivent exister dans les pages correspondantes :

| ID | Page | Élément |
|----|------|---------|
| `nav-logo` | layout | Logo lien |
| `nav-dashboard`, `nav-leads`, etc. | layout | Liens de navigation |
| `tour-help` | layout | Bouton d'aide ? |
| `dash-kpis`, `dash-pending`, `dash-recent-leads`, `dash-upcoming-appts` | dashboard/page | Sections dashboard |
| `leads-filters`, `leads-list` | leads/page | Filtres + liste |
| `appts-view-toggle`, `appts-nav`, `appts-pending`, `appts-calendar`, `appts-availability-btn` | appointments/page | Contrôles agenda |
| `sb-progress`, `sb-content`, `sb-nav` | site-builder/page | Barre, contenu step 0, navigation |
| `analytics-kpis`, `analytics-behavioral`, `analytics-demand` | analytics/page | Sections analytics |
| `agents-list`, `agent-panel` | agents/page | Sidebar + panneau |
| `settings-nav`, `settings-profil-btn`, `settings-site-btn`, etc. | settings/page | Navigation paramètres |

### Déclenchement programmatique

```typescript
import { useOnborda } from "onborda";
const { startOnborda } = useOnborda();
startOnborda("welcome"); // démarre le tour nommé "welcome"
```

### Auto-start au premier login

`TourStarter` (dans `layout.tsx`) vérifie `localStorage.getItem("klientys_welcomed")`. Si absent, démarre le tour `welcome` après 800 ms et pose le flag.

---

## Conventions de code

- **Python** : FastAPI, Pydantic v2, `get_supabase_admin()` pour toutes les requêtes DB côté API
- **TypeScript** : composants fonctionnels, état local avec `useState`, pas de Redux
- **Styles** : Tailwind CSS — classes `.inp` et `.lbl` définies en `<style jsx global>` dans le site-builder
- **Emails** : HTML inline dans `email.py`, bouton CTA via la constante `_BTN`
- **Pas de mock DB** dans les tests — utiliser une vraie instance Supabase
