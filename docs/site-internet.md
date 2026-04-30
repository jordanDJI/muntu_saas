# Périmètre Site Internet — Guide complet

**Version :** 1.0  
**Date :** Avril 2026  
**Périmètre :** Création, personnalisation, publication et intégration de sites vitrine dans le SaaS

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Cas d'usage 1 — Créer un site depuis le SaaS](#2-cas-dusage-1--créer-un-site-depuis-le-saas)
3. [Cas d'usage 2 — Intégrer un site déjà existant](#3-cas-dusage-2--intégrer-un-site-déjà-existant)
4. [Personnalisation avancée (plan Business)](#4-personnalisation-avancée-plan-business)
5. [Architecture technique](#5-architecture-technique)
6. [API endpoints — référence complète](#6-api-endpoints--référence-complète)
7. [Flux de données — de la création à l'affichage](#7-flux-de-données--de-la-création-à-laffichage)
8. [Formulaire de contact et leads](#8-formulaire-de-contact-et-leads)
9. [Modes d'audience (B2C / B2B / Hybride)](#9-modes-daudience-b2c--b2b--hybride)
10. [Checklist de mise en ligne](#10-checklist-de-mise-en-ligne)

---

## 1. Vue d'ensemble

Le périmètre "site internet" du SaaS couvre **deux situations distinctes** :

| Situation | Outil | URL dashboard |
|---|---|---|
| Le client n'a pas de site → il en crée un via le SaaS | Site Builder (wizard 9 étapes) | `/dashboard/site-builder` |
| Le client a déjà un site → il veut y ajouter le chatbot IA et/ou le tracking | Page Intégrer | `/dashboard/embed` |

Dans les deux cas, les **leads** générés (formulaires de contact, questions chatbot) remontent dans le même tableau de bord `/dashboard/leads`.

---

## 2. Cas d'usage 1 — Créer un site depuis le SaaS

### 2.1 Le wizard de création (9 étapes)

Accessible depuis `Dashboard → Mon site` ou `/dashboard/site-builder`.

Le wizard guide le professionnel étape par étape. Il ne peut pas avancer si la sauvegarde de l'étape en cours échoue.

| # | Étape | Champs | Sauvegarde |
|---|---|---|---|
| 1 | Votre image & photos | Logo (a / n'a pas / texte), palette couleur (6 choix), police (moderne / classique / manuscrit), option photos (stock / propres) | `site_style.logo_option`, `site_style.primary_color`, `site_style.font_style`, `site_style.photos_option`, `site_style.photo_urls` |
| 2 | Votre contenu | Pages à inclure (Accueil, Présentation, Services, Contact) | `site_style.pages_enabled[]` |
| 3 | Identité | Titre de l'activité, accroche (tagline), description | `site.title`, `site.tagline`, `site.description` |
| 4 | Contact & Réseaux | Téléphone, email, adresse, Facebook / Instagram / LinkedIn | `site.phone`, `site.email_contact`, `site.address`, `site_style.social_links` |
| 5 | Zones d'intervention | Liste des villes/régions couvertes (champ multi-valeur) | `service_area` table |
| 6 | Prestations | Nom, description, durée (min), prix (€) | `service_offer` table |
| 7 | Atouts | Jusqu'à 6 éléments : icône emoji, titre, description | `site_style.values_list[]` |
| 8 | Témoignages | Auteur, rôle, texte, note (1–5) | `testimonial` table |
| 9 | Suivi & Lancement | IDs tracking (GA4, Meta Pixel, GTM), CSS premium, bouton Publier | `site_style.tracking`, `site_style.custom_css`, `site.status` |

**Exemple concret (infirmière Yolande) :**

```
Étape 1 — Image : palette "Bleu confiance", police "Moderne", photos propres
Étape 3 — Identité : "Muntu Cura", tagline "Soins à domicile avec cœur"
Étape 5 — Zones : ["Halle", "Tubize", "Braine-le-Château", "Rebecq"]
Étape 6 — Prestations :
  - "Soins infirmiers à domicile", 45 min, 35 €
  - "Coordination avec maison de repos", 60 min, sans prix affiché
Étape 9 — Tracking : GA4 "G-XXXXXXXX", puis Publier
```

### 2.2 Le rendu du site public

Une fois publié, le site est accessible à l'URL :

```
https://[votre-app].vercel.app/[slug-du-tenant]
```

Exemples :
- `https://saas.vercel.app/muntu-cura` → site Yolande
- `https://saas.vercel.app/artisan-dupont` → site d'un plombier

Le template est rendu côté serveur (Next.js `[tenant]/page.tsx`) et adapte automatiquement :
- Les couleurs et polices selon `site_style.primary_color` et `site_style.font_style`
- Les photos (héro, à propos, services, contact) si le client en a fourni
- Le mode d'audience (B2C / B2B / Hybride) pour adapter les textes et formulaires
- Le chatbot IA (Agent 1) embarqué en widget flottant

**Sections du template (inspiré EvaCare.be) :**

```
┌────────────────────────────────────────┐
│ Navigation fixe (ancres)               │
├────────────────────────────────────────┤
│ HÉRO — photo + accroche + CTA         │  ← photo_urls.hero (optionnel)
├────────────────────────────────────────┤
│ À PROPOS — texte + photo              │  ← photo_urls.about (optionnel)
├────────────────────────────────────────┤
│ PRESTATIONS — grille de cartes        │  ← service_offer table
├────────────────────────────────────────┤
│ ZONES D'INTERVENTION — liste          │  ← service_area table
├────────────────────────────────────────┤
│ NOS ATOUTS — 6 icônes                 │  ← site_style.values_list
├────────────────────────────────────────┤
│ TÉMOIGNAGES — avis clients            │  ← testimonial table
├────────────────────────────────────────┤
│ CONTACT — coordonnées + formulaire    │  ← photo_urls.contact (optionnel)
├────────────────────────────────────────┤
│ Footer                                 │
└────────────────────────────────────────┘
         🤖 Chatbot IA (widget flottant)
```

### 2.3 Les photos personnalisées

Quand le client sélectionne "J'ai mes propres photos" à l'étape 1, quatre champs URL apparaissent — un par section du site. Un bouton `?` à côté de chaque champ ouvre un popover avec :
- Un mini wireframe du site indiquant visuellement l'emplacement de la photo
- La description de ce que la photo doit représenter
- Le format recommandé
- Des idées concrètes

| Clé | Section | Format recommandé | Exemples |
|---|---|---|---|
| `hero` | Bandeau principal | Paysage 16:9, min 1200×675 px | Photo de vous en action, cabinet, zone d'intervention |
| `about` | À propos | Portrait 4:3 ou carré, min 600×600 px | Portrait professionnel, équipe, bureau |
| `services` | Fond section prestations | Paysage large, min 1400×600 px | Matériel de travail, geste professionnel |
| `contact` | Section contact | Portrait ou carré, min 600×800 px | Photo accueillante, sourire, tenue professionnelle |

Les URLs sont stockées dans `site_style.photo_urls` (JSONB) :

```json
{
  "photo_urls": {
    "hero": "https://images.unsplash.com/photo-...",
    "about": "https://drive.google.com/...",
    "services": "",
    "contact": ""
  }
}
```

### 2.4 Modes d'audience

Le mode d'audience du site (`site.audience_mode`) détermine comment le template s'adapte :

| Mode | Comportement |
|---|---|
| `b2c` | Formulaire "prendre rendez-vous", textes orientés patient/particulier |
| `b2b` | Formulaire "nous contacter", textes orientés partenaire/structure |
| `hybrid` | Les deux formulaires disponibles, le visiteur choisit son profil |

**Exemple :** Yolande NYA → mode `hybrid`. Un patient clique "Je suis particulier", une maison de repos clique "Je suis un partenaire". Chaque parcours génère un lead avec `audience_type` différent.

---

## 3. Cas d'usage 2 — Intégrer un site déjà existant

Un client peut avoir un site WordPress, Wix, Squarespace ou autre, et vouloir uniquement bénéficier du **chatbot IA** et/ou du **tracking analytics** du SaaS.

Page d'accès : `Dashboard → Intégrer` ou `/dashboard/embed`.

### 3.1 Intégrer le chatbot IA

Le chatbot est embarqué via un snippet JavaScript qui crée un `<iframe>` flottant. Ce snippet est auto-généré pour chaque tenant.

**Snippet généré (exemple pour le tenant `muntu-cura`) :**

```html
<!-- Chatbot IA — à coller avant </body> -->
<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = 'https://saas.vercel.app/embed/chatbot/muntu-cura';
    iframe.style.cssText = 'position:fixed;bottom:24px;right:24px;width:60px;height:60px;border:none;z-index:9999;border-radius:50%;box-shadow:0 4px 20px rgba(0,0,0,0.15)';
    iframe.id = 'saas-chatbot';
    document.body.appendChild(iframe);
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'saas-chatbot-resize') {
        var el = document.getElementById('saas-chatbot');
        if (el) {
          el.style.width = e.data.w;
          el.style.height = e.data.h;
          el.style.borderRadius = e.data.r || '50%';
        }
      }
    });
  })();
</script>
```

**Comment ça fonctionne :**
1. Un iframe `60×60 px` avec un bouton rond apparaît en bas à droite du site client
2. Quand le visiteur clique, l'iframe envoie un message `postMessage` (`saas-chatbot-resize`) pour s'agrandir en fenêtre de chat
3. Le chatbot IA (Agent 1) est initialisé avec le contexte du tenant (`slug`)
4. Les conversations et leads générés remontent dans `/dashboard/leads` du tenant

**Instructions par plateforme :**

| Plateforme | Où coller le snippet |
|---|---|
| WordPress | Plugin *Insert Headers and Footers* → section "Footer" — **ou** Apparence → Éditeur de thème → `footer.php` avant `</body>` |
| Wix | Paramètres → Avancé → Code personnalisé → "Ajouter du code dans chaque page" → Position : Corps (fin) |
| Squarespace | Paramètres → Avancé → Code d'injection → Pied de page |
| Webflow | Paramètres du projet → Code personnalisé → "Avant la balise </body>" |
| Shopify | Thèmes → Modifier le code → `theme.liquid` → avant `</body>` |
| HTML pur | Directement dans le fichier HTML, avant `</body>` |

### 3.2 Intégrer le tracking analytics

Le tracking est optionnel. Les IDs doivent d'abord être configurés dans le Site Builder (étape 9), puis la page Intégrer génère automatiquement les snippets corrects.

**Google Analytics 4 (dans `<head>`) :**

```html
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

**Meta Pixel (dans `<head>`) :**

```html
<!-- Meta Pixel -->
<script>
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){...};
  fbq('init', '1234567890123456');
  fbq('track', 'PageView');
</script>
```

**Google Tag Manager (dans `<head>` ET après `<body>`) :**

```html
<!-- GTM dans <head> -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];...})(window,document,'script','dataLayer','GTM-XXXXXX');</script>

<!-- GTM noscript après <body> -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXX" ...></iframe></noscript>
```

**Priorité recommandée :**

```
1er choix → Google Tag Manager (GTM) : gère GA4, Meta Pixel, et plus encore depuis une seule interface
2e choix  → Google Analytics 4 seul : si le client veut juste des stats de visites
3e choix  → Meta Pixel seul : si le client fait de la pub Facebook/Instagram
```

### 3.3 Scénario complet — WordPress + chatbot + GA4

```
Contexte : Marie, infirmière libérale, a un site WordPress fait par une agence.
Elle souscrit au SaaS pour avoir le chatbot IA et mesurer ses visites.

Étapes :
1. Marie ouvre /dashboard/site-builder → étape 9
   → Elle entre son ID GA4 : "G-ABC123DEF4"
   → Elle clique Publier (pour activer l'étape tracking, même si elle n'utilise pas le site SaaS)

2. Marie ouvre /dashboard/embed
   → La page affiche son snippet chatbot et son snippet GA4 déjà remplis avec son ID

3. Marie installe le plugin WordPress "Insert Headers and Footers"
   → Dans la section "Scripts in Header" : colle le snippet GA4
   → Dans la section "Scripts in Footer" : colle le snippet chatbot

Résultat :
→ Les visiteurs de son site WordPress voient le chatbot IA flottant
→ GA4 mesure les visites
→ Les leads du chatbot arrivent dans /dashboard/leads
```

---

## 4. Personnalisation avancée (plan Business)

Disponible à l'étape 9 du wizard pour les abonnés **Business (99€/mois)**.

Un éditeur de code CSS est disponible. Le CSS saisi est injecté en `<style>` directement dans la page du site public (champ `site_style.custom_css`).

**Exemples d'utilisation :**

```css
/* Changer la couleur du bouton CTA */
.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 30px;
}

/* Personnaliser la section héro */
.hero-section {
  min-height: 100vh;
  background-attachment: fixed;
}

/* Modifier la police des titres */
h1, h2, h3 {
  font-family: 'Playfair Display', serif;
  letter-spacing: -0.02em;
}
```

> **Sécurité :** Le CSS est appliqué tel quel via `dangerouslySetInnerHTML` — réservé aux clients avancés. Pas de validation côté serveur actuellement.

---

## 5. Architecture technique

### 5.1 Table `site` et colonne `site_style`

La table `site` est la table centrale. Elle appartient à un `tenant` (via `tenant_id`) et stocke toutes les données du site.

La colonne `site_style` (type `JSONB`) centralise tous les paramètres visuels et de contenu qui ne méritent pas leur propre table :

```json
{
  "logo_option": "has_logo",
  "primary_color": "#4F46E5",
  "font_style": "modern",
  "pages_enabled": ["home", "about", "services", "contact"],
  "photos_option": "has_photos",
  "photo_urls": {
    "hero": "https://example.com/hero.jpg",
    "about": "https://example.com/about.jpg",
    "services": "",
    "contact": ""
  },
  "social_links": {
    "facebook": "https://facebook.com/muntu-cura",
    "instagram": "",
    "linkedin": ""
  },
  "values_list": [
    { "icon": "🏥", "title": "Soins certifiés", "description": "Agréée INAMI depuis 2015" },
    { "icon": "🕐", "title": "Disponible 7j/7", "description": "Même le week-end" }
  ],
  "tracking": {
    "ga4_id": "G-ABC123DEF4",
    "meta_pixel_id": "",
    "gtm_id": ""
  },
  "custom_css": ""
}
```

### 5.2 Tables liées

```
site (1)
 ├── service_offer (0..*) — prestations proposées
 ├── service_area (0..*) — zones géographiques couvertes
 └── testimonial (0..*) — avis clients
```

**Table `service_offer` :**

| Colonne (DB actuel) | Alias API/frontend | Description |
|---|---|---|
| `id` | `id` | UUID |
| `site_id` | `site_id` | FK vers `site` |
| `name` | `name` | Nom de la prestation |
| `description` | `description` | Description |
| `duration_minutes` | `duration_min` | Durée en minutes |
| `price_from` | `price_eur` | Prix en euros |

> **Note :** La migration 004 (`backend/supabase/migrations/004_fix_service_offer_columns.sql`) renommera `duration_minutes → duration_min` et `price_from → price_eur`. En attendant, le backend maintient une couche de mapping (`_offer_from_db` / `_offer_to_db` dans `backend/app/api/v1/sites.py`).

### 5.3 Route publique du site

Le site public d'un tenant est rendu par `frontend/app/[tenant]/page.tsx`.

**Résolution du tenant :**

```
URL : /muntu-cura
  → Next.js extrait le paramètre [tenant] = "muntu-cura"
  → Requête Supabase : SELECT * FROM tenant WHERE slug = 'muntu-cura'
  → Requête site : SELECT * FROM site WHERE tenant_id = ... AND status = 'published'
  → Si aucun site publié → page 404
  → Si site trouvé → rendu du template avec les données
```

### 5.4 Sécurité et isolation multi-tenant

- **Row-Level Security (RLS)** activée sur la table `site` : un tenant ne peut lire/écrire que ses propres sites
- Le backend utilise le **service_role** de Supabase (bypass RLS) pour les opérations d'administration, et extrait le `tenant_id` du JWT Supabase (`app_metadata.tenant_id`)
- La route publique `/[tenant]` utilise le client Supabase **anon** — seules les données du site publié sont exposées

---

## 6. API endpoints — référence complète

Tous les endpoints sont préfixés par `/api/v1/sites`.

### Sites

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/sites/` | JWT tenant | Lister les sites du tenant connecté |
| `POST` | `/api/v1/sites/` | JWT tenant | Créer un nouveau site |
| `PATCH` | `/api/v1/sites/{site_id}` | JWT tenant | Modifier un site (titre, statut, site_style…) |
| `POST` | `/api/v1/sites/{site_id}/publish` | JWT tenant | Publier le site (`status = "published"`) |
| `POST` | `/api/v1/sites/{site_id}/unpublish` | JWT tenant | Dépublier le site (`status = "draft"`) |

### Prestations (service_offer)

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/sites/{site_id}/offers` | JWT tenant | Lister les prestations du site |
| `PUT` | `/api/v1/sites/{site_id}/offers` | JWT tenant | Remplacer toutes les prestations (delete + insert) |

### Témoignages (testimonial)

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/sites/{site_id}/testimonials` | JWT tenant | Lister les témoignages du site |
| `PUT` | `/api/v1/sites/{site_id}/testimonials` | JWT tenant | Remplacer tous les témoignages |

### Leads publics (depuis le site vitrine)

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/leads/public/{tenant_slug}` | Aucune | Créer un lead depuis le formulaire public |

**Payload exemple (formulaire de contact) :**

```json
{
  "first_name": "Martine",
  "last_name": "Dubois",
  "email": "martine@example.com",
  "phone": "0491 23 45 67",
  "source": "website",
  "audience_type": "b2c",
  "request_type": "contact"
}
```

---

## 7. Flux de données — de la création à l'affichage

```
Tenant crée son site (wizard 9 étapes)
  │
  ├── PATCH /api/v1/sites/{id}
  │     └── Sauvegarde site_style, title, phone, email…
  │
  ├── PUT /api/v1/sites/{id}/offers
  │     └── Remplace les service_offer en base
  │
  ├── PUT /api/v1/sites/{id}/testimonials
  │     └── Remplace les testimonial en base
  │
  └── POST /api/v1/sites/{id}/publish
        └── site.status = "published"

                    ↓

Visiteur accède à https://app.vercel.app/[slug]
  │
  ├── Next.js [tenant]/page.tsx (Server Component)
  │     ├── Requête Supabase : tenant par slug
  │     ├── Requête site : site publié du tenant
  │     ├── Requête service_offer : prestations
  │     ├── Requête service_area : zones
  │     └── Requête testimonial : avis
  │
  ├── Rendu HTML avec couleurs/polices/photos dynamiques
  ├── Injection scripts tracking (GA4/Meta/GTM) si configurés
  └── Widget chatbot IA (Agent 1) flottant

                    ↓

Visiteur remplit le formulaire de contact
  │
  └── POST /api/v1/leads/public/{slug}
        ├── Crée un Contact en base
        ├── Crée un Lead en base (status = "new")
        └── Envoie email de notification au tenant (Resend)
              └── Lead apparaît dans /dashboard/leads
```

---

## 8. Formulaire de contact et leads

Le formulaire "Nous contacter" est dans `frontend/app/[tenant]/contact-form.tsx`.

**Champs du formulaire :**

| Champ | Type | Envoyé au backend | Colonne en base |
|---|---|---|---|
| Prénom | text | `first_name` | `contact.first_name` |
| Nom | text | `last_name` | `contact.last_name` |
| Email | email | `email` | `contact.email` |
| Téléphone | tel | `phone` | `contact.phone` |
| Source | (auto) | `source: "website"` | `lead.source` |
| Type audience | (auto) | `audience_type: "b2c"` | `lead.audience_type` |
| Type de demande | (auto) | `request_type: "contact"` | `lead.request_type` |

Chaque soumission crée :
1. Un enregistrement `contact` (ou retrouve le contact existant si même email)
2. Un enregistrement `lead` lié à ce contact, avec `status = "new"`
3. Un email de notification envoyé au tenant via Resend

---

## 9. Modes d'audience (B2C / B2B / Hybride)

Le champ `site.audience_mode` adapte le rendu du template :

### Mode B2C

```
Texte du formulaire : "Prenez rendez-vous"
Champs : Prénom, Nom, Email, Téléphone
Lead créé avec : audience_type = "b2c", source = "website"
```

### Mode B2B

```
Texte du formulaire : "Contactez-nous"
Champs : Prénom, Nom, Email, Téléphone, (Entreprise à venir)
Lead créé avec : audience_type = "b2b", source = "website"
```

### Mode Hybride

Le visiteur choisit son profil. Le template affiche deux boutons ou deux onglets. Selon le choix, le formulaire adapte son texte et le lead est créé avec l'`audience_type` correspondant.

**Exemple Yolande (hybride) :**
- Un patient particulier → remplit "Demande de soins à domicile" → `audience_type = "b2c"`
- Une maison de repos → remplit "Collaboration professionnelle" → `audience_type = "b2b"`

Les deux leads arrivent dans le même tableau de bord `/dashboard/leads`, avec un filtre visuel pour distinguer B2C et B2B.

---

## 10. Checklist de mise en ligne

### Pour un nouveau site créé via le SaaS

```
□ Étape 1 — Image : palette, police, option photos choisies
□ Étape 2 — Pages à inclure sélectionnées
□ Étape 3 — Titre, accroche et description renseignés
□ Étape 4 — Email de contact et téléphone renseignés (obligatoires pour les leads)
□ Étape 5 — Au moins une zone d'intervention ajoutée
□ Étape 6 — Au moins une prestation ajoutée
□ Étape 7 — Au moins un atout ajouté
□ Étape 8 — Au moins un témoignage ajouté (optionnel mais recommandé)
□ Étape 9 — ID GA4 renseigné (optionnel mais fortement recommandé)
□ Étape 9 — Cliquer "Publier le site"
□ Vérifier l'URL publique : https://[app]/[slug]
□ Tester le formulaire de contact → vérifier la réception dans /dashboard/leads
□ Tester le chatbot IA (widget flottant)
```

### Pour l'intégration sur un site existant

```
□ Configurer les IDs tracking dans Site Builder → étape 9 (même si pas utilisé)
□ Publier le site (requis pour générer les snippets)
□ Ouvrir /dashboard/embed
□ Copier le snippet chatbot → coller avant </body> sur le site client
□ Copier le snippet tracking → coller dans <head> sur le site client
□ Vérifier que l'iframe chatbot apparaît sur le site client
□ Vérifier que GA4/Meta/GTM remonte des données (laisser 24h)
□ Tester une interaction chatbot → vérifier le lead dans /dashboard/leads
```

---

*Document maintenu avec le projet — toute évolution du site builder ou de la page embed doit être reflétée ici.*
