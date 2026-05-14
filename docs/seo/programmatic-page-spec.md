# Spec — Pages programmatiques métier × ville

> Cible : `/site-internet-pour/[metier]/[ville]`
> Objectif : 3 000 pages indexées, zero duplication perçue par Google, chacune utile.

---

## 1. Architecture des URLs

```
/site-internet-pour/                          → Index métiers (landing hub)
/site-internet-pour/[metier]                  → Page métier (niveau 1)
/site-internet-pour/[metier]/[ville]          → Page métier × ville (niveau 2)
```

**Slugs métier** (50 cibles initiales) :
```
infirmier-liberal, kinesitherapeute, osteopathe, psychologue, sophrologue,
coach-sportif, naturopathe, dieteticienne, sage-femme, podologue,
plombier, electricien, couvreur, peintre, jardinier-paysagiste,
serrurier, chauffagiste, menuisier, macon, carreleur,
photographe-mariage, professeur-particulier, aide-domicile, garde-enfants,
toiletteur, dj-evenementiel, traiteur, formateur-independant,
comptable-proximite, coach-vie
```

**Villes cibles** (100 villes FR + BE) :
```
# France (top 60)
paris, lyon, marseille, toulouse, bordeaux, nantes, lille, strasbourg,
nice, rennes, montpellier, grenoble, rouen, toulon, saint-etienne,
dijon, angers, nimes, aix-en-provence, le-mans, clermont-ferrand,
reims, limoges, amiens, metz, brest, perpignan, caen, mulhouse, nancy,
orléans, besançon, tours, valenciennes, troyes, pau, dunkerque, avignon,
bayonne, mérignac, la-rochelle, quimper, annecy, versailles, argenteuil,
saint-denis, montreuil, vitry-sur-seine, calais, boulogne-billancourt

# Belgique (40 villes)
bruxelles, liege, gand, anvers, charleroi, bruges, namur, louvain,
mons, mouscron, arlon, tournai, verviers, ostende, courtrai,
hasselt, genk, mechelen, alost, roulers, terneuzem, tubize,
ottignies, wavre, waterloo, braine-lalleud, nivelles, halle,
vilvoorde, ixelles, saint-gilles, anderlecht, etterbeek,
jette, laeken, woluwe, forest, schaerbeek, molenbeek, evere
```

---

## 2. Structure de données par page

### 2a. Données statiques (JSON par métier)

```typescript
// data/metiers.ts
interface MetierData {
  slug: string
  label: string           // "Kinésithérapeute"
  labelPlural: string     // "Kinésithérapeutes"
  emoji: string
  famille: "sante" | "artisan" | "services"
  description: string     // 1 ligne, utilisée dans meta
  painPoints: string[]    // 3 douleurs spécifiques au métier
  keyFeatures: string[]   // 3 features Klientys les plus utiles pour ce métier
  templateColor: string   // couleur primaire suggérée ("indigo", "teal", ...)
  kw_monthly_fr: number   // volume mensuel estimé FR
  kw_monthly_be: number   // volume mensuel estimé BE
  testimonialName: string // prénom fictif (ex: "Sandrine")
  testimonialCity: string // ville fictive (ex: "Lyon")
  testimonialQuote: string
}
```

### 2b. Données dynamiques (par ville, injectées à build time)

```typescript
interface VilleData {
  slug: string
  label: string           // "Lyon"
  labelPrep: string       // "à Lyon" ou "en Île-de-France"
  region: string          // "Auvergne-Rhône-Alpes"
  pays: "FR" | "BE"
  population: number      // source: INSEE / statbel
  departement?: string    // "69" (FR uniquement)
  province?: string       // "Hainaut" (BE uniquement)
  lat: number
  lng: number
  // Contexte local : récupéré ou estimé
  nbProfessionnels?: number  // nb pros du secteur dans la ville (optionnel)
  demandLocale?: number      // score Google Trends (optionnel, via pytrends)
}
```

---

## 3. Template de page (Next.js App Router)

```
frontend/app/(marketing)/site-internet-pour/
├── page.tsx                  ← Hub métiers
├── [metier]/
│   ├── page.tsx              ← Niveau 1
│   └── [ville]/
│       └── page.tsx          ← Niveau 2 (la page clé)
```

### Contenu de la page niveau 2 — 7 sections obligatoires

```
Section 1 — Hero
  H1 : "Site internet pour [métier] à [ville] — prêt en 10 minutes"
  Sous-titre : "[NbPros fictif]+  [métier]s à [ville] utilisent déjà Klientys"
  CTA : "Créer mon site gratuitement"
  Image : screenshot du template métier (statique)

Section 2 — Pourquoi un [métier] à [ville] a besoin d'un site
  3 pain points spécifiques au métier (depuis MetierData.painPoints)
  Données locales : population + rayon d'intervention estimé
  Angle local : "À [ville], X% des recherches '[métier] [ville]' se font sur mobile"

Section 3 — Ce que Klientys fait pour vous
  3 features clés (depuis MetierData.keyFeatures)
  Screenshot ou GIF animé

Section 4 — Votre site en 3 étapes
  1. Choisissez votre template [métier]
  2. Renseignez vos zones d'intervention autour de [ville]
  3. Publiez — votre site est indexé sous 48h

Section 5 — Témoignage local
  Quote de [MetierData.testimonialName], [métier] à [MetierData.testimonialCity]
  Photo générée (avatar neutre)
  Note : 5 étoiles

Section 6 — Comparatif rapide
  Tableau : Klientys vs Doctolib (si santé) ou Wix (si artisan/services)
  Colonnes : Prix · Site vitrine · Agenda · CRM · Zones d'intervention · IA

Section 7 — FAQ locale (3 questions)
  "Combien coûte un site internet pour [métier] à [ville] ?"
  "Comment être trouvé sur Google quand on est [métier] à [ville] ?"
  "Puis-je gérer mes zones d'intervention depuis [ville] ?"
```

---

## 4. SEO technique par page

### Metadata Next.js

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const { metier, ville } = params
  const m = getMetierData(metier)
  const v = getVilleData(ville)
  
  return {
    title: `Site internet pour ${m.label} à ${v.label} — Klientys`,
    description: `Créez votre site professionnel de ${m.labelPlural} à ${v.label} en 10 min. Agenda en ligne, zones d'intervention, agents IA. Essai gratuit.`,
    alternates: {
      canonical: `/site-internet-pour/${metier}/${ville}`
    },
    openGraph: {
      title: `Site internet ${m.label} à ${v.label}`,
      description: `La plateforme tout-en-un pour les ${m.labelPlural} qui couvrent ${v.label} et sa région.`,
      images: [`/og/metier/${metier}.png`]  // image OG statique par métier
    }
  }
}
```

### Schema.org JSON-LD

```typescript
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Klientys",
  "applicationCategory": "BusinessApplication",
  "description": `Site internet et agenda en ligne pour ${metier.label}s à ${ville.label}`,
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "EUR",
    "description": "Essai gratuit"
  },
  "areaServed": {
    "@type": "City",
    "name": ville.label,
    "containedInPlace": {
      "@type": "AdministrativeArea",
      "name": ville.region
    }
  },
  "audience": {
    "@type": "Audience",
    "audienceType": metier.label
  }
}
```

---

## 5. Génération statique (ISR)

```typescript
// generateStaticParams — génère toutes les combinaisons au build
export async function generateStaticParams() {
  const metiers = getAllMetiers()   // ~50
  const villes = getAllVilles()     // ~100
  
  const params = []
  for (const metier of metiers) {
    for (const ville of villes) {
      params.push({ metier: metier.slug, ville: ville.slug })
    }
  }
  return params  // ~5 000 combinaisons
}

// ISR : revalidation toutes les 24h (pour màj données locales)
export const revalidate = 86400
```

---

## 6. Protection anti-thin content

### Règle : chaque page doit différer sur ≥ 3 éléments uniques

| Élément | Source de variation |
|---------|---------------------|
| Population et contexte ville | `VilleData.population` |
| Rayon d'intervention estimé | Calculé depuis `population` |
| Nb de professionnels locaux estimé | `VilleData.nbProfessionnels` |
| Score de demande locale | `VilleData.demandLocale` (pytrends) |
| Texte intro Section 2 | Template interpolé avec vraies données |
| FAQ Q1 (prix) | Fourchette selon ville (Paris vs petite ville) |
| Métadonnées OG | Image + titre uniques |

### Règle : ne pas indexer les pages sans données suffisantes

```typescript
// Si nbProfessionnels et demandLocale sont absents → noindex
if (!villeData.nbProfessionnels && !villeData.demandLocale) {
  return { robots: { index: false, follow: true } }
}
```

---

## 7. Sitemap

```typescript
// app/sitemap.ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const metiers = getAllMetiers()
  const villes = getAllVilles()
  
  const pages = []
  
  // Hub
  pages.push({ url: '/site-internet-pour', priority: 0.9, changeFrequency: 'weekly' })
  
  // Niveau 1
  for (const m of metiers) {
    pages.push({
      url: `/site-internet-pour/${m.slug}`,
      priority: 0.8,
      changeFrequency: 'weekly'
    })
  }
  
  // Niveau 2
  for (const m of metiers) {
    for (const v of villes) {
      pages.push({
        url: `/site-internet-pour/${m.slug}/${v.slug}`,
        priority: 0.6,
        changeFrequency: 'monthly'
      })
    }
  }
  
  return pages
}
```

---

## 8. Données à préparer (fichiers statiques)

```
frontend/data/
├── metiers.json      ← 50 métiers avec tous les champs MetierData
├── villes-fr.json    ← 60 villes FR avec population INSEE
├── villes-be.json    ← 40 villes BE avec population Statbel
└── templates/
    ├── infirmier-liberal.png   ← screenshot template
    ├── kinesitherapeute.png
    └── ...
```

---

## 9. Roadmap implémentation

| Sprint | Tâche | Effort |
|--------|-------|--------|
| S1 | Créer `data/metiers.json` (50 métiers) | 4h |
| S1 | Créer `data/villes-fr.json` + `villes-be.json` | 3h |
| S1 | Template page niveau 1 (sans données locales) | 6h |
| S2 | Template page niveau 2 (avec interpolation données) | 8h |
| S2 | Schema.org + metadata dynamique | 3h |
| S2 | `generateStaticParams` + ISR | 2h |
| S3 | Intégration pytrends → score demande locale par ville | 4h |
| S3 | Protection anti-thin content + noindex conditionnel | 2h |
| S3 | Sitemap dynamique | 2h |
| S4 | Screenshots templates par métier (OG images) | 6h |

**Total estimé : ~40h dev**
