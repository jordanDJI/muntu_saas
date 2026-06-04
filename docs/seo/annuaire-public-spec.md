# Spec produit — Annuaire public Klientys

> Levier SEO #1 : chaque user Klientys devient une page indexée sur "kiné Lyon" ou "plombier Bruxelles".
> Modèle : Treatwell, Doctolib listing, PagesJaunes — mais gratuit et auto-alimenté.

> **État d'implémentation (juin 2026)** : Sections 3, 4, 5 (pages hub + liste métier×ville + ville multi-métiers) et 6 (opt-in settings) sont **implémentées et en production**. Les sections 7 (sitemap/schema.org) et 8 (monétisation) restent en roadmap.

---

## 1. Concept & valeur

### Pour les utilisateurs Klientys
- Être listé gratuitement dans un annuaire visible sur Google
- Apparaître sur "kiné + ville" sans faire de SEO soi-même
- Recevoir des leads via l'annuaire (en plus de leur site)

### Pour Klientys
- Des milliers de pages SEO locales indexées automatiquement
- Chaque user = 1 backlink naturel vers l'annuaire + 1 page ciblée
- Effet réseau : un kiné trouve Klientys via l'annuaire, s'inscrit, génère sa propre page
- Signal d'autorité pour Google : contenu utile, frais, local

### Pour les visiteurs (futurs clients des pros)
- Trouver un professionnel par métier + zone
- Voir disponibilités et réserver directement

---

## 2. Architecture des URLs

```
/annuaire/                              → Hub annuaire (index par famille)         ✅ implémenté
/annuaire/[metier]/[ville]/             → Liste des pros du métier à [ville]        ✅ implémenté
/annuaire/ville/[ville]/                → Toutes professions dans une ville          ✅ implémenté (ajout)
/annuaire/[metier]/                     → Liste des pros du métier (toutes zones)   🔜 roadmap
/annuaire/[metier]/[ville]/[slug]/      → Fiche pro avec booking inline             🔜 roadmap
```

Exemples :
```
/annuaire/kinesitherapeute/lyon/
/annuaire/plombier/bruxelles/
/annuaire/ville/rennes/                  ← toutes professions à Rennes
```

> **Note** : La page `/annuaire/ville/[ville]` a été ajoutée à l'implémentation (hors spec initiale) pour que les liens "villes populaires" du hub pointent vers une page utile même quand le secteur est inconnu.

---

## 3. Base de données ✅ implémenté

### Table `directory_listing` — migration `026_directory.sql`

Structure réelle implémentée (légèrement différente de la spec initiale) :

```sql
create table directory_listing (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenant(id) on delete cascade unique,
  is_listed boolean default false,
  metier text,                    -- clé secteur ("kinesitherapeute", "plombier", "autre"…)
  metier_slug text,               -- slug URL (= metier pour les secteurs standard)
  custom_metier text,             -- valeur libre si metier = "autre"
  description text,
  primary_zone text,              -- ville principale (Title Case)
  zones text[],                   -- toutes les zones (Title Case obligatoire)
  phone text,
  email text,
  updated_at timestamptz default now()
);
```

> **Normalisation zones** : les zones sont toujours stockées en **Title Case** (`"Rennes"`, `"Saint-Brieuc"`). Le backend normalise à l'écriture. Supabase `.contains()` est sensible à la casse pour les arrays text.

> **Différences avec la spec initiale** : `display_name`, `tagline`, `profile_photo_url`, `accepts_booking`, `languages` ne sont pas encore dans la table — ces colonnes sont roadmap.

### Vue matérialisée 🔜 roadmap

La vue matérialisée n'est pas encore implémentée. Les requêtes annuaire font une jointure directe sur `tenant` et `site`.

---

## 4. Endpoints backend ✅ implémenté

### Endpoints annuaire réels (`backend/app/api/v1/directory.py`)

```
GET  /api/v1/directory/listings?ville=...&metier=...  → liste paginée (public, metier optionnel)
GET  /api/v1/directory/listing/{slug}                 → fiche publique par slug (public)
GET  /api/v1/directory/my-listing                     → listing du tenant courant (auth)
POST /api/v1/directory/opt-in                         → créer/MAJ listing (auth, normalise zones)
PATCH /api/v1/directory/my-listing                    → modifier listing (auth, normalise zones)
DELETE /api/v1/directory/opt-out                      → is_listed = false (auth)
```

> **Différence avec la spec** : les endpoints utilisent des query params (`?ville=&metier=`) et non des segments de path. `metier` est optionnel — sans lui, la requête retourne toutes professions pour la ville.

### Schema de réponse GET /directory/listings

```json
{
  "metier": "kinesitherapeute",
  "ville": "Rennes",
  "page": 1,
  "per_page": 20,
  "listings": [
    {
      "id": "...",
      "slug": "cabinet-kine-dupont",
      "metier": "kinesitherapeute",
      "metier_slug": "kinesitherapeute",
      "description": "Kiné libéral à Rennes...",
      "zones": ["Rennes", "Saint-Grégoire"],
      "primary_zone": "Rennes",
      "phone": "0612345678",
      "email": "...",
      "site_url": "/cabinet-kine-dupont",
      "directory_url": "/annuaire/kinesitherapeute/rennes"
    }
  ]
}
```

### Pièges backend connus

- **Join `!inner` en supabase-py** : `tenant!inner(slug)` retourne silencieusement des résultats vides. Utiliser `tenant(slug)` (sans `!inner`) + fallback slug via requête séparée.
- **Casse des zones** : normaliser en `.title()` avant `.contains()` et avant écriture.

---

## 5. Pages frontend (Next.js) ✅ partiellement implémenté

### Structure fichiers réelle

```
frontend/app/annuaire/
├── page.tsx                            ← Hub annuaire            ✅ implémenté
├── [metier]/
│   └── [ville]/
│       └── page.tsx                    ← Liste métier × ville    ✅ implémenté
└── ville/
    └── [ville]/
        └── page.tsx                    ← Toutes professions/ville ✅ implémenté (ajout)

Manquant (roadmap) :
├── [metier]/page.tsx                   ← Liste métier toutes zones 🔜
└── [metier]/[ville]/[slug]/page.tsx    ← Fiche pro avec booking    🔜
```

> **Pas dans un route group `(marketing)`** — l'implémentation est directement dans `app/annuaire/`, pas `app/(marketing)/annuaire/`.

### Page hub (`/annuaire/`) ✅

- Grid des secteurs avec nb de pros listés par métier
- Villes populaires par secteur — liens vers `/annuaire/ville/{ville}` (pas `/annuaire/{metier}/{ville}` pour éviter le problème du secteur inconnu)
- `cache: "no-store"` — pas de cache Next.js (évite d'afficher 0 pro après opt-in)

### Page métier × ville (`/annuaire/[metier]/[ville]/`) ✅

- Liste des fiches actives pour ce métier dans cette ville
- Filtre via `zones` array (`.contains()` Title Case) + fallback `primary_zone ILIKE`
- `cache: "no-store"`

### Page ville multi-métiers (`/annuaire/ville/[ville]/`) ✅ (ajout hors spec)

- Toutes les fiches actives dans la ville, groupées par `metier_slug`
- Lien "Voir tous →" par groupe → `/annuaire/{metier}/{ville}`
- `robots: { index: false }` si aucune fiche trouvée
- `cache: "no-store"`

### Fiche pro (`/annuaire/[metier]/[ville]/[slug]/`) 🔜 roadmap

Option B recommandée (page wrapper SEO avec booking inline) — non encore implémentée. Actuellement, les cards de la liste pointent directement vers `/{slug}` (le site du tenant).

---

## 6. Opt-in — expérience utilisateur

### Où afficher l'opt-in ?

1. **Dashboard settings** → section "Annuaire public" (toggle + aperçu) ✅ implémenté
2. **Onboarding** → étape finale 🔜 roadmap
3. **Dashboard** → bannière contextuelle post-publication 🔜 roadmap

### Flow opt-in implémenté (Settings → Annuaire)

`SectionAnnuaire` dans `frontend/app/dashboard/settings/page.tsx` :

1. Toggle "Apparaître dans l'annuaire" → `is_listed`
2. Sélecteur métier (liste déroulante des secteurs standard + "autre")
3. Champ métier libre si "autre" → `custom_metier`
4. Description (textarea)
5. Zone principale + zones multiples avec **autocomplete Nominatim** (350ms debounce, `onMouseDown` sur suggestions)
6. Téléphone + email
7. Sauvegarde via `POST /api/v1/directory/opt-in` ou `PATCH /api/v1/directory/my-listing`

> **Autocomplete zones** : API Nominatim (OpenStreetMap), `onMouseDown` (pas `onClick`) pour éviter le conflit avec `onBlur`, délai 150ms sur `onBlur` avant fermeture du dropdown.

> **Normalisation** : `titleCaseZone()` appliqué côté frontend à la lecture + au `addZone()`. Le backend normalise également à l'écriture (`.title()` Python).

### CGU annuaire 🔜 roadmap

La checkbox CGU n'est pas encore dans le flow — à ajouter avant le lancement public de l'annuaire.

---

## 7. SEO de l'annuaire

### Sitemap dédié

```
/annuaire-sitemap.xml → toutes les pages /annuaire/
  - Mis à jour en temps réel dès qu'un pro s'inscrit
  - Priorité : 0.7 pour pages ville, 0.8 pour fiches pro actives
```

### Données structurées

```json
// Page liste métier × ville
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Kinésithérapeutes à Lyon",
  "numberOfItems": 12,
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "item": {
        "@type": "LocalBusiness",
        "name": "Jean Dupont — Kinésithérapeute",
        "url": "https://klientys.co/cabinet-kine-dupont",
        "areaServed": "Lyon"
      }
    }
  ]
}
```

### Règle de fraîcheur

- `updated_at` sur chaque listing → Google comprend que le contenu est maintenu
- Les fiches inactives depuis 6 mois → `noindex` automatique (protection thin content)
- Minimum 3 pros pour indexer une page ville (sinon thin content)

---

## 8. Monétisation future (roadmap)

| Feature | Plan | Description |
|---------|------|-------------|
| Listing de base | Gratuit | Nom, zones, lien site |
| Listing premium | Payant | Photo, tagline, booking inline, badge "Vérifié" |
| Mise en avant | Payant | Position #1 dans la liste ville |
| Avis clients | Tous plans | Collecte avis depuis les RDV confirmés |
| Badge "Klientys Certifié" | Plan Pro | Rassure les visiteurs |

---

## 9. Roadmap implémentation

| Sprint | Tâche | Statut |
|--------|-------|--------|
| S1 | Migration SQL `directory_listing` (`026_directory.sql`) | ✅ fait |
| S1 | Endpoints GET annuaire (public, paginé, metier optionnel) | ✅ fait |
| S1 | Endpoints opt-in/opt-out + PATCH listing (auth) | ✅ fait |
| S2 | Page hub `/annuaire/` | ✅ fait |
| S2 | Page liste métier × ville | ✅ fait |
| S2 | Page ville multi-métiers `/annuaire/ville/[ville]/` | ✅ fait (hors spec) |
| S2 | Autocomplete Nominatim sur les zones (settings) | ✅ fait |
| S3 | Section opt-in dans settings dashboard | ✅ fait |
| S3 | Fiche pro (Option B avec booking inline) | 🔜 roadmap |
| S3 | Bannière opt-in post-publication | 🔜 roadmap |
| S3 | Schema.org + sitemap annuaire | 🔜 roadmap |
| S4 | Vue matérialisée refresh job (cron) | 🔜 roadmap |
| S4 | Règles noindex (< 3 pros, inactivité 6 mois) | 🔜 roadmap |
| S4 | CGU annuaire (checkbox opt-in) | 🔜 roadmap |
| S4 | Page `/annuaire/[metier]/` (liste toutes zones) | 🔜 roadmap |
