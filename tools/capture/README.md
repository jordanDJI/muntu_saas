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

## Remplir le tenant avant de capturer

```bash
node seed.js              # ~45 contacts + ~22 rendez-vous sur deux semaines
node seed.js --count 60
node seed.js --contacts-only
```

Le jeton vient de `frontend/.env.local` (`NEXT_PUBLIC_SUPABASE_URL` +
`ANON_KEY`) et du couple email/mot de passe de `capture.config.json` : aucune
clé de service n'est manipulée. Les contacts passent par
`POST /contacts/import`, les rendez-vous par `POST /appointments/`.

Deux points de conception :

- **Les contacts qui reçoivent un rendez-vous sont créés sans email.**
  `POST /appointments/` envoie une confirmation au contact ; vingt rendez-vous
  sur des adresses fictives, c'est vingt rebonds durs chez Resend et une
  réputation d'expéditeur abîmée. Sans email sur la fiche, l'envoi est sauté.
- **Tous les rendez-vous créés ici sont `confirmed`** — l'API ne sait pas créer
  un `pending`. La demande en attente, et sa bannière ambre, viennent de
  l'étape `booking` de `capture.js`, qui passe par la vraie réservation
  publique.

Les créneaux ne sont pas devinés : le script lit
`GET /booking/{slug}/slots` (endpoint public) jour par jour sur deux semaines.
Les rendez-vous tombent donc dans les vraies plages d'ouverture, les créneaux
déjà pris sont absents de la réponse et ne sont jamais réutilisés, et le
`label` donne l'heure locale — l'invariant de stockage est respecté sans
conversion de fuseau.

Le jeu de données est déterministe (PRNG à graine fixe) : relancer le script
réimporte les mêmes personnes, donc l'import les **enrichit** au lieu de les
dupliquer. Les rendez-vous, eux, s'ajoutent — `--contacts-only` est plus sûr
pour une relance.

Les contacts sont européens (Belgique, France, Allemagne) avec des numéros
E.164, parce que c'est la clientèle décrite par le site de démo. Si le tenant
change, les tableaux `PLACES` et `NOTES` en haut de `seed.js` sont là pour être
édités — ce texte s'affiche à l'écran dans la pub.

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
