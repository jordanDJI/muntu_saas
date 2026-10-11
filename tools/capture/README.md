# Capture des écrans produit (pub motion design)

Produit les assets PNG en double densité que l'animation publicitaire consomme.

```bash
cd tools/capture
npm install
cp capture.config.example.json capture.config.json   # puis renseigner email / password / tenantSlug
node capture.js
```

Les deux serveurs doivent tourner (`npm run dev` côté frontend, `uvicorn` côté
backend) : les créneaux de réservation viennent de l'API.

## Fichiers produits

| Fichier | Écran | Densité |
|---|---|---|
| `dash.png` | `/dashboard` | 2880×1800 |
| `contacts.png` | `/dashboard/contacts` | 2880×1800 |
| `agenda-avant.png` | agenda, vue semaine, **avant** la réservation | 2880×1800 |
| `analytics.png` | `/dashboard/analytics` | 2880×1800 |
| `site-public-hero.png` | site vitrine, au-dessus de la ligne de flottaison | 2880×1800 |
| `site-public.png` | site vitrine, page entière | 2880×N |
| `booking-creneau.png` | widget de réservation, étape créneaux | élément recadré |
| `booking-form.png` | widget, formulaire rempli | élément recadré |
| `booking-confirme.png` | widget, confirmation ✓ | élément recadré |
| `agenda-apres.png` | agenda, **après** la réservation | 2880×1800 |
| `agenda-pending.png` | la bannière ambre seule | élément recadré |
| `mobile-dash.png` | dashboard en 390×844 | 1170×2532 |
| `mobile-site.png` | site vitrine en 390×844 | 1170×2532 |

## Étapes

`dash` · `contacts` · `agenda` · `analytics` · `site` · `booking` · `agenda2` · `mobile`

```bash
node capture.js site booking     # un sous-ensemble
node capture.js --show           # navigateur visible, pour débugger un sélecteur
```

L'ordre compte : `agenda` capture l'agenda **avant**, `booking` crée la demande,
`agenda2` capture l'**après**. Lancer `agenda2` sans `booking` donne deux
captures identiques.

## Ce que fait l'étape `booking`

Elle réserve réellement un créneau : un `contact` et un `appointment` en statut
`pending` sont créés dans le tenant, et un email part vers le propriétaire.
**À ne lancer que sur un tenant de démo.** C'est ce qui rend la paire
avant/après authentique — un agenda truqué se voit à l'image.

## Prérequis sur le tenant de démo

- **Pas en `trial_expired`** — sinon un overlay plein écran masque tout le
  dashboard. À corriger via `/admin/tenants/<id>` → « Activer gratuitement ».
- **Feature `analytics` active** — sinon `analytics.png` capture un écran
  d'upgrade. Override possible depuis la même page admin.
- **Acompte PayPal désactivé** — sinon la soumission part vers l'étape de
  paiement et `booking-confirme.png` / `agenda-apres.png` sont sautés.
  (Agenda → Formulaire → onglet Paiement.)
- **Disponibilités ouvertes** dans les 3 prochains mois.
- **Données crédibles** : 40 à 50 contacts, des RDV étalés sur la semaine, des
  noms français. Un dashboard à zéro ne vend rien.
- **Aucune donnée personnelle réelle** — ces images partent en publicité.

## Détails d'implémentation

- Session Supabase mise en cache dans `.session.json` : les relances ne
  repassent pas par le formulaire de connexion.
- Consentement cookies forcé à `refused` avant chargement : la bannière
  n'apparaît pas et aucun script de tracking ne se charge.
- `[data-reveal]` est forcé visible avant capture — le site public met
  `opacity: 0` en inline et attend l'IntersectionObserver, ce qui laisserait
  tout le bas de la page blanc sur une capture pleine page.
- En cas d'échec, l'état de la page est enregistré dans `_erreur.png`.
