# Plan éditorial — Cocons sémantiques Klientys

> Objectif : organiser l'existant (200 mots-clés, 1 pilier rédigé, pages programmatiques, annuaire) en architecture de cocons avec maillage interne, sans dépendre d'un outil tiers payant (Oscar ai et équivalents).
> Méthode inspirée d'un audit commercial reçu d'Oscar ai (voir contexte conversation) — filtrée pour coller au vrai produit Klientys, pas à un SaaS générique.

---

## 0. Ce qui existe déjà (ne pas refaire)

| Actif | Fichier | État |
|---|---|---|
| 200 mots-clés priorisés, 18 catégories | [`keywords-200.md`](./keywords-200.md) | ✅ fait |
| Article pilier "SEO local indépendant" (2500 mots, FR/EN/DE) | [`article-seo-local.md`](./article-seo-local.md) | ✅ rédigé |
| Pages programmatiques métier × ville (3000 pages cibles) | [`programmatic-page-spec.md`](./programmatic-page-spec.md) | 🔜 spec, à vérifier si livré |
| Annuaire public (`/annuaire/[metier]/[ville]`) | [`annuaire-public-spec.md`](./annuaire-public-spec.md) | ✅ en prod (hub + métier×ville + ville) |

Il manque : **la structure en cocons qui relie ces actifs entre eux** (aujourd'hui c'est une liste de mots-clés à plat + un seul article) et **deux clusters absents** des 200 mots-clés actuels, identifiés dans l'audit Oscar et vérifiés réels (voir plus bas).

---

## 1. Architecture en 5 cocons

Chaque cocon = 1 page pilier + articles satellites qui pointent vers elle, qui elle-même pointe vers les pages transactionnelles (pricing, essai gratuit, pages programmatiques, annuaire).

### Cocon A — SEO local & visibilité Google *(déjà démarré)*
- **Pilier** : `article-seo-local.md` (existant).
- **Satellites à écrire** (déjà dans `keywords-200.md`, cat. 10 et 7) : Google My Business artisan, avis Google comment en avoir, schema.org local business, référencement Google profession libérale.
- **Maillage sortant** : chaque satellite doit linker vers 2-3 pages `/site-internet-pour/[metier]/[ville]` et vers `/annuaire`.

### Cocon B — Alternatives à Doctolib / Calendly / Wix *(le plus rentable, à prioriser)*
- **Pilier à écrire** : "Pourquoi les indépendants quittent Doctolib en 2026" (mots-clés cat. 2 déjà identifiés : `alternative Doctolib`, `concurrent Doctolib`, `Doctolib trop cher`).
- **Satellites** : un article par métier à fort volume (kiné, infirmier, ostéopathe) + "Combien coûte vraiment Doctolib par mois" (cat. 9, #99).
- **Point d'attention** : ce sont vos visiteurs les plus chauds (déjà en rupture avec un outil payant) — chaque article doit avoir un tableau comparatif tarifs + un lien direct vers l'essai gratuit, pas juste vers le pilier.

### Cocon C — Agenda, CRM et RDV sans Doctolib
- **Pilier à écrire** : "Agenda en ligne + CRM pour indépendant : le guide 2026".
- **Satellites** : déjà couverts par cat. 3/4/6/12 de `keywords-200.md` (site internet kiné, logiciel CRM kiné, gestion patientèle infirmier…).

### Cocon D — Agents IA WhatsApp/Telegram *(angle réglementaire à ajouter)*
- **Ce qui existe** : cat. 11/18 couvrent déjà "WhatsApp Business indépendant", "chatbot rendez-vous en ligne", "bot Telegram professionnel".
- **Ce qui manque et qui est vérifié réel** (voir fact-check) : le ban Meta des chatbots généralistes sur WhatsApp au 15 janvier 2026, avec exemption explicite pour les agents métier (prise de RDV, qualification de lead). C'est un angle de réassurance légale que personne dans votre liste actuelle n'exploite.
- **Pilier à écrire** : "Agent IA WhatsApp pour indépendants : ce qui est légal en 2026 (nouvelles règles Meta)" — répond à "est-ce que j'ai le droit d'utiliser ça ?", rassure, puis redirige vers `/dashboard/agents`.

### Cocon E — Réglementation & confiance ⚠️ *(nouveau — à cadrer avec prudence)*
- **Ce qui est vérifié réel** : obligation de réception de factures électroniques pour toutes les entreprises assujetties à la TVA au 1er septembre 2026 (Urssaf/DGFiP confirmé).
- **⚠️ Point de vigilance produit** : contrairement à ce que l'audit Oscar suppose ("Klientys intègre un module de facturation conforme"), **Klientys n'a pas aujourd'hui de module de facturation électronique** dans les endpoints/tables listés au CLAUDE.md. Deux options honnêtes :
  1. Traiter ce cocon en **contenu d'autorité pur** (répondre à "suis-je concerné", "quelles sanctions") sans prétendre que Klientys résout le problème — juste construire la confiance et le trafic, avec un CTA doux vers le site vitrine/CRM plutôt qu'un mensonge produit.
  2. Ou remonter le besoin en interne comme piste produit réelle avant de publier ce cluster — la demande de recherche est là et confirmée, donc si un module facturation devient réaliste un jour, c'est un signal fort.
- Ne publiez rien qui affirme une conformité que le produit n'a pas — c'est le genre d'erreur qu'un générateur de contenu automatisé (comme Oscar) commet facilement en écrivant pour "un SaaS d'indépendants" générique plutôt que pour le vôtre spécifiquement.

---

## 2. Maillage interne — la règle à appliquer partout

```
Article TOFU (cocon A/D/E) 
   → 2-3 liens vers pages programmatiques /site-internet-pour/[metier]/[ville]
   → 1 lien vers /annuaire (hub ou ville)
   → 1 lien "doux" vers un article MOFU (cocon B ou C)

Article MOFU (cocon B/C)
   → tableau comparatif + lien direct /pricing ou essai gratuit
   → lien vers la page fonctionnalité concernée (agents IA, site-builder, calendrier)

Page pilier
   → toujours liée depuis TOUS ses satellites (breadcrumb + lien contextuel dans le corps)
   → liée vers les 1-2 autres piliers les plus connexes (ex : pilier B ↔ pilier C)
```

Aujourd'hui vos 3 actifs (blog, pages programmatiques, annuaire) semblent vivre en silo. Le gain le plus rapide et le moins coûteux, avant même d'écrire de nouveaux articles, c'est de **relier ce qui existe déjà** : `article-seo-local.md` devrait déjà linker vers `/annuaire` et vers quelques pages `/site-internet-pour/...` si elles sont en prod.

---

## 3. Cadence réaliste (vs les 16-45 articles/mois vendus par Oscar)

Sans outil d'automatisation payant, en solo ou petite équipe :

| Rythme | Volume | Faisabilité |
|---|---|---|
| 1 pilier / trimestre | 4/an | Réaliste, structurant |
| 2-3 satellites / mois | 24-36/an | Réaliste avec Claude pour le draft + relecture humaine obligatoire |
| 16-45 articles / mois | 190-540/an | Nécessite une vraie automatisation + supervision éditoriale — risque réel vis-à-vis de la politique Google "scaled content abuse" si la supervision humaine ne suit pas |

Recommandation : viser **Cocon B (alternatives) et D (agent IA)** en premier — ce sont les deux qui convertissent le mieux et qui ont le moins de concurrence directe aujourd'hui. Cocon E seulement si vous tranchez la question du module facturation.

---

## 4. Mesurer sans outil tiers (déjà instrumenté chez vous)

Klientys a déjà l'infra pour mesurer ça sans payer d'outil supplémentaire :
- `GET /api/v1/analytics/summary` — sessions, `cta_click`, `form_submit` par page (donc par article une fois le tracking `site_event` posé sur le blog).
- Connexion GA4 native (`google_analytics_connection`) pour le trafic organique et les positions.
- Google Search Console (gratuit, hors stack Klientys) pour suivre position/impressions/CTR par mot-clé — c'est ce qu'Oscar montre dans ses captures d'écran clients, rien de propriétaire.

KPIs par cocon à suivre trimestriellement : sessions organiques, `cta_click` vers essai gratuit, position Top 10 sur les mots-clés ⭐⭐⭐ de `keywords-200.md`.

---

## 5. Premiers articles à écrire (ordre de priorité)

| # | Cocon | Titre | Mot-clé (réf. `keywords-200.md`) | Intention |
|---|---|---|---|---|
| 1 | B | Combien coûte vraiment Doctolib par mois en 2026 ? | #99 | MOFU |
| 2 | B | Top alternatives à Doctolib pour kinésithérapeutes | #11, #23 | MOFU |
| 3 | D | Agent IA WhatsApp : ce qui est légal en 2026 (règles Meta) | #116, nouveau | TOFU rassurant |
| 4 | B | Klientys vs Doctolib : comparatif complet | #188 (marque) | BOFU |
| 5 | C | Agenda en ligne + CRM pour indépendant : le guide 2026 | #7, #126 | Pilier |
| 6 | A | Comment avoir des avis Google quand on est artisan | #112 | Satellite |
| 7 | B | Alternative Wix gratuite pour un site professionnel | #12 | MOFU |
| 8 | D | Chatbot de prise de RDV : comment ça marche pour un kiné | #122 | Satellite |
| 9 | C | CRM profession libérale : lequel choisir en 2026 | #126 | MOFU |
| 10 | A | Google My Business pour infirmier libéral | #111 | Satellite |

Chaque article : 1200-1800 mots, FAQ intégrée (extraits enrichis + réponses IA génératives), 3-5 liens internes selon la règle de la section 2, CTA final vers essai gratuit ou page fonctionnalité.

---

## 6. Ce que je ne recommande pas de copier d'Oscar

- Le volume industriel (16-45 art./mois) sans garde-fou éditorial humain fort.
- Prétendre à une conformité produit qu'on n'a pas (cocon E).
- Les personas/mots-clés génériques copiés tels quels — les vôtres (`keywords-200.md`) sont déjà plus précis et déjà chiffrés par ville/pays FR+BE, ce qu'Oscar n'a pas fourni pour klientys.co dans son propre audit.
