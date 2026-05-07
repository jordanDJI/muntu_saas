# CLAUDE.md — SaaS Présence Digitale

## Vue d'ensemble

SaaS tout-en-un pour indépendants et TPE (infirmières, kinés, artisans…). Chaque tenant obtient un site vitrine public, un système de réservation, un CRM léger, et des agents IA de communication.

**Stack** : Next.js 14 (App Router) · Tailwind CSS · FastAPI · Supabase (Postgres + Auth + Storage) · Resend (emails) · Google Gemini (IA)

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
│   │   ├── services/  # email, whatsapp, telegram, ocr, lead
│   │   ├── middleware/ # tenant.py (JWT → tenant_id)
│   │   └── core/      # config.py, supabase.py
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

---

## Base de données (tables principales)

| Table | Description |
|-------|-------------|
| `tenant` | Espace professionnel (slug, name, is_active) |
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
  "address_parts": { "street": "Rue ...", "postal_code": "1000", "city": "Bruxelles" },
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

## Dashboard principal (`/dashboard`)

- Lien vers le site public du tenant en bas de page : `/{tenantSlug}` (target `_blank`)
- Affiche "Site non configuré" (grisé) si le slug n'est pas encore défini

## Site-builder (`/dashboard/site-builder`)

Wizard 9 étapes :

| Étape | Contenu | Validation |
|-------|---------|-----------|
| 0 | Logo, couleurs, police | — |
| 1 | Pages activées, photos | — |
| 2 | Titre *, tagline, description | `title` obligatoire |
| 3 | Téléphone, email, adresse (rue / CP / ville), réseaux | format email |
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
- Calculé : `conversion_lead_rate` (leads / sessions), `conversion_appt_rate` (RDV / leads)

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

## Conventions de code

- **Python** : FastAPI, Pydantic v2, `get_supabase_admin()` pour toutes les requêtes DB côté API
- **TypeScript** : composants fonctionnels, état local avec `useState`, pas de Redux
- **Styles** : Tailwind CSS — classes `.inp` et `.lbl` définies en `<style jsx global>` dans le site-builder
- **Emails** : HTML inline dans `email.py`, bouton CTA via la constante `_BTN`
- **Pas de mock DB** dans les tests — utiliser une vraie instance Supabase
