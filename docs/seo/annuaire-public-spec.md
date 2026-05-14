# Spec produit — Annuaire public Klientys

> Levier SEO #1 : chaque user Klientys devient une page indexée sur "kiné Lyon" ou "plombier Bruxelles".
> Modèle : Treatwell, Doctolib listing, PagesJaunes — mais gratuit et auto-alimenté.

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
/annuaire/                              → Hub annuaire (index par famille)
/annuaire/[metier]/                     → Liste des pros du métier (toutes zones)
/annuaire/[metier]/[ville]/             → Liste des pros du métier à [ville]
/annuaire/[metier]/[ville]/[slug]/      → Fiche pro (= site vitrine du tenant)
```

Exemples :
```
/annuaire/kinesitherapeute/lyon/
/annuaire/plombier/bruxelles/
/annuaire/infirmier-liberal/paris/jean-dupont/
```

---

## 3. Base de données

### Table `directory_listing` (nouvelle)

```sql
create table directory_listing (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenant(id) on delete cascade unique,
  is_listed boolean default false,         -- opt-in explicite
  listed_at timestamptz,
  metier_slug text,                        -- slug normalisé (ex: "kinesitherapeute")
  display_name text,                       -- nom affiché dans l'annuaire
  tagline text,                            -- accroche courte
  zones text[],                            -- ["Lyon", "Villeurbanne", "Bron"]
  primary_zone text,                       -- ville principale (pour URL)
  profile_photo_url text,
  accepts_booking boolean default true,    -- si le tenant a l'agenda activé
  languages text[] default array['fr'],
  updated_at timestamptz default now()
);

-- Index pour les recherches annuaire
create index idx_directory_metier_zone on directory_listing (metier_slug, primary_zone)
  where is_listed = true;
create index idx_directory_zones on directory_listing using gin (zones)
  where is_listed = true;
```

### Vue matérialisée (rafraîchie toutes les heures)

```sql
create materialized view directory_listing_enriched as
  select
    dl.*,
    t.slug as tenant_slug,
    t.country,
    s.title as site_title,
    s.address,
    s.site_style->>'primary_color' as color,
    count(distinct a.id) filter (where a.status = 'confirmed') as appointments_count,
    max(a.created_at) as last_activity_at
  from directory_listing dl
  join tenant t on t.id = dl.tenant_id
  join site s on s.tenant_id = dl.tenant_id and s.status = 'published'
  left join appointment a on a.calendar_id in (
    select id from calendar where tenant_id = dl.tenant_id
  )
  where dl.is_listed = true
  group by dl.id, t.slug, t.country, s.title, s.address, s.site_style;

create unique index on directory_listing_enriched (id);
```

---

## 4. Endpoints backend

### Nouveaux endpoints annuaire

```
GET  /api/v1/directory/[metier]                → liste paginée (public)
GET  /api/v1/directory/[metier]/[ville]        → liste filtrée par ville (public)
GET  /api/v1/directory/[metier]/[ville]/[slug] → fiche pro (public, redirige vers site)
POST /api/v1/directory/opt-in                  → activer listing (authentifié)
POST /api/v1/directory/opt-out                 → désactiver listing (authentifié)
GET  /api/v1/directory/my-listing              → voir son propre listing (authentifié)
PATCH /api/v1/directory/my-listing             → modifier son listing (authentifié)
```

### Schema de réponse GET /directory/[metier]/[ville]

```json
{
  "metier": "kinesitherapeute",
  "ville": "Lyon",
  "total": 12,
  "page": 1,
  "per_page": 20,
  "listings": [
    {
      "slug": "cabinet-kine-dupont",
      "display_name": "Jean Dupont — Kinésithérapeute",
      "tagline": "Kiné à domicile — Lyon 3e et environs",
      "zones": ["Lyon", "Villeurbanne", "Caluire-et-Cuire"],
      "primary_zone": "Lyon",
      "profile_photo_url": "https://...",
      "accepts_booking": true,
      "site_url": "/cabinet-kine-dupont",
      "directory_url": "/annuaire/kinesitherapeute/lyon/cabinet-kine-dupont"
    }
  ]
}
```

---

## 5. Pages frontend (Next.js)

### Structure fichiers

```
frontend/app/(marketing)/annuaire/
├── page.tsx                            ← Hub annuaire
├── [metier]/
│   ├── page.tsx                        ← Liste métier (toutes zones)
│   └── [ville]/
│       ├── page.tsx                    ← Liste métier × ville
│       └── [slug]/
│           └── page.tsx                ← Fiche pro (wrapper autour du site)
```

### Page hub (`/annuaire/`)

- Titre H1 : "Annuaire des professionnels indépendants"
- Grid des familles : Santé, Artisanat, Services
- Sous chaque famille : top 5 métiers avec nb de pros listés
- Schema.org `ItemList`

### Page métier × ville (`/annuaire/[metier]/[ville]/`)

```
H1 : "Kinésithérapeutes à Lyon — [N] professionnels listés"

Meta title : "Kinésithérapeutes à Lyon - Trouvez un kiné libéral | Klientys"
Meta description : "Trouvez un kinésithérapeute libéral à Lyon. 
  Profils vérifiés, prise de RDV en ligne directe. [N] kiné(s) disponibles."

Contenu :
  - Breadcrumb : Annuaire > Kinésithérapeutes > Lyon
  - Carte Leaflet : marqueurs pour chaque pro (lat/lng de primary_zone)
  - Liste de cards pros (nom, photo, tagline, zones, bouton RDV si booking actif)
  - Pagination (20 par page)
  - FAQ locale : 3 questions SEO sur "kiné Lyon"
  - CTA bottom : "Vous êtes kiné à Lyon ? Rejoignez l'annuaire gratuitement"
```

### Fiche pro (`/annuaire/[metier]/[ville]/[slug]/`)

Deux options :
- **Option A (simple)** : redirect 301 vers `/{slug}` (le site du tenant)
- **Option B (SEO)** : page wrapper qui affiche les données du pro + iframe ou embed du site

**Recommandation : Option B** pour garder l'URL dans l'annuaire indexée.

```
Layout fiche pro :
  - Header : nom, photo, métier, note (si avis)
  - Zones d'intervention (liste + carte)
  - Bouton "Prendre RDV" → ouvre widget booking inline
  - Description du pro (depuis site.description)
  - Prestations (depuis service_offer)
  - Lien "Voir le site complet"
  
Schema.org :
  "@type": "LocalBusiness" ou "Physician" (selon métier)
  "name": display_name
  "areaServed": zones[]
  "url": site_url
  "makesOffer": prestations[]
```

---

## 6. Opt-in — expérience utilisateur

### Où afficher l'opt-in ?

1. **Dashboard settings** → section "Annuaire public" (toggle + aperçu)
2. **Onboarding** → étape finale : "Voulez-vous apparaître dans l'annuaire ?"
3. **Dashboard** → bannière contextuelle : "Votre site est publié ! Apparaissez dans l'annuaire pour +X clients potentiels"

### Flow opt-in

```
1. Tenant clique "Rejoindre l'annuaire"
2. Modal de configuration :
   - Sélectionner le métier principal (liste déroulante)
   - Choisir la zone principale (autocomplete villes)
   - Vérifier les zones d'intervention (déjà renseignées dans site-builder)
   - Upload photo de profil (ou utiliser logo)
   - Aperçu de la fiche
3. Clic "Publier dans l'annuaire"
4. Confirmation : "Votre fiche sera visible dans l'annuaire sous 1h"
```

### CGU annuaire (checkbox obligatoire)

> "J'accepte que mes informations professionnelles soient affichées publiquement dans l'annuaire Klientys et indexées par les moteurs de recherche."

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

| Sprint | Tâche | Effort |
|--------|-------|--------|
| S1 | Migration SQL `directory_listing` + vue matérialisée | 2h |
| S1 | Endpoints GET annuaire (public, paginé) | 4h |
| S1 | Endpoints opt-in/opt-out + PATCH listing (auth) | 3h |
| S2 | Page hub `/annuaire/` | 4h |
| S2 | Page liste métier × ville (avec carte Leaflet) | 8h |
| S2 | Fiche pro (Option B avec booking inline) | 6h |
| S3 | Modal opt-in dans settings dashboard | 5h |
| S3 | Bannière opt-in post-publication | 2h |
| S3 | Schema.org + sitemap annuaire | 3h |
| S4 | Vue matérialisée refresh job (cron) | 2h |
| S4 | Règles noindex (< 3 pros, inactivité 6 mois) | 2h |

**Total estimé : ~41h dev**
