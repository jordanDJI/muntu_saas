# Backlog Klientys — Epics, user stories & tickets

État au **3 novembre 2026**, après l'implémentation des tickets ouverts (modifications **non commitées**). Constitué à partir de l'historique git (166 commits, avril → novembre 2026), de `CLAUDE.md`, des migrations `001` → `085` et d'une lecture du code.

| | Total | Livré / Terminé | Partiel | À faire |
|---|---:|---:|---:|---:|
| **Epics** | 19 | | | |
| **User stories** | 152 | 147 | 3 | 2 |
| **Tickets** | 212 | 199 | 6 | 7 |

Chaque ticket terminé documente le problème, la cause et la correction ; ceux traités le 3 novembre portent en plus une ligne **Réalisation** qui dit ce qui a été fait et ce qui reste. Les tickets ouverts donnent leur preuve (fichier et ligne), une proposition, des critères de validation et une estimation.

Export tableur : [`backlog.csv`](backlog.csv) (séparateur `;`, UTF-8), importable dans Jira, Linear, Notion ou Excel.

## Avant de déployer les modifications du 3 novembre

1. Appliquer les migrations `081` → `085` (Supabase → SQL Editor), **avant** le backend : sans `081`, le webhook Telegram ne retrouve plus les bots (recherche par empreinte) ; sans `083`, les réservations échouent (`appointment.lang`). `082`, `084` et `085` ont un repli.
2. Poser `DATA_ENCRYPTION_KEY` sur Railway (`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`) et vérifier `APP_ENV=production` — sans clé, l'enregistrement des secrets tenant est refusé en production.
3. Après déploiement : `python scripts/encrypt_existing_secrets.py` (simulation) puis `--apply`, et `python scripts/resync_telegram_webhooks.py`.
4. Enrôler la double authentification sur les comptes admin, puis seulement `ADMIN_REQUIRE_MFA=true`.

---

## Epics

| Epic | Périmètre | US | Tickets terminés | Partiels | À faire |
|---|---|---:|---:|---:|---:|
| [EP-01](epics/EP-01-auth-onboarding.md) | Authentification, inscription & onboarding | 9 | 12 | 0 | 1 |
| [EP-02](epics/EP-02-multitenant-equipe.md) | Multi-tenant, équipe & permissions | 8 | 13 | 0 | 0 |
| [EP-03](epics/EP-03-site-vitrine.md) | Site vitrine public & site-builder | 12 | 13 | 0 | 0 |
| [EP-04](epics/EP-04-agenda-reservation.md) | Agenda & réservation en ligne | 9 | 12 | 0 | 0 |
| [EP-05](epics/EP-05-acompte-paypal.md) | Acompte PayPal à la réservation | 7 | 12 | 2 | 0 |
| [EP-06](epics/EP-06-crm.md) | CRM : contacts, leads, relances | 11 | 23 | 0 | 0 |
| [EP-07](epics/EP-07-communication.md) | Communication : emails, campagnes, notifications | 8 | 6 | 0 | 0 |
| [EP-08](epics/EP-08-agents-ia.md) | Agents IA | 8 | 11 | 0 | 0 |
| [EP-09](epics/EP-09-analytics.md) | Analytics & potentiel de demande locale | 7 | 6 | 0 | 0 |
| [EP-10](epics/EP-10-abonnements.md) | Abonnements, essai & monétisation | 9 | 14 | 1 | 0 |
| [EP-11](epics/EP-11-facturation.md) | Facturation électronique | 6 | 8 | 1 | 1 |
| [EP-12](epics/EP-12-domaines.md) | Domaines personnalisés | 5 | 5 | 0 | 0 |
| [EP-13](epics/EP-13-widgets-integrations.md) | Widgets & intégrations externes | 7 | 6 | 0 | 0 |
| [EP-14](epics/EP-14-annuaire.md) | Annuaire public | 6 | 10 | 0 | 0 |
| [EP-15](epics/EP-15-marketing-blog-seo.md) | Site marketing, blog & SEO | 9 | 14 | 0 | 1 |
| [EP-16](epics/EP-16-admin-operateur.md) | Panel admin opérateur | 10 | 5 | 0 | 0 |
| [EP-17](epics/EP-17-support-services.md) | Support client & services additionnels | 4 | 3 | 1 | 0 |
| [EP-18](epics/EP-18-rgpd-securite.md) | RGPD, sécurité & conformité | 10 | 9 | 0 | 1 |
| [EP-19](epics/EP-19-plateforme-qualite.md) | Plateforme, qualité & documentation | 7 | 17 | 1 | 3 |

---

## Ce qui reste ouvert

| Ticket | Priorité | Statut | Sujet | Ce qui bloque |
|---|---|---|---|---|
| KLT-0520 | P1 | 🟡 Partiel | Tests d'intégration sur le sandbox PayPal | Script prêt : à exécuter avec une app PayPal sandbox |
| KLT-0521 | P1 | 🟡 Partiel | Valider le paiement PayPal dans l'iframe d'un site client | Page de test prête : campagne sur 4 navigateurs à mener |
| KLT-1020 | P1 | 🟡 Partiel | Tests d'intégration sur le mode test Stripe | Script prêt : à exécuter avec la Stripe CLI sur une base de recette |
| KLT-1120 | P1 | 🟡 Partiel | Générer des factures au format Factur-X | Factur-X livré ; reste la vérification PDF/A-3 (veraPDF) et schématron en recette |
| KLT-1121 | P1 | ⬜ À faire | Adossement à une PDP et e-reporting (France, échéance 1er septembre 2027) | Choix d'une PDP partenaire (contrat, API) — échéance 1er septembre 2027 |
| KLT-1822 | P1 | ⬜ À faire | Décider de l'hébergement des données de santé (HDS) | Décision à prendre (exclure les données de santé ou héberger en HDS) |
| KLT-1922 | P1 | 🟡 Partiel | Générer le baseline exact du schéma de production | Script prêt : à lancer avec l'URL de la base (Supabase CLI) |
| KLT-1930 | P2 | ⬜ À faire | Point-in-time recovery Supabase | Décision de coût (abonnement PITR Supabase) |
| KLT-0121 | P3 | ⬜ À faire | Activer la connexion Facebook après validation Meta | Validation de l'application par Meta |
| KLT-1521 | P3 | ⬜ À faire | Publication des articles sur la page LinkedIn | En attente de la réponse de LinkedIn (accès à l'API) |
| KLT-1720 | P3 | 🟡 Partiel | Remplacer le polling du support par du temps réel | Polling suspendu en arrière-plan ; Realtime demande des policies RLS |
| KLT-1925 | P3 | ⬜ À faire | Découper les fichiers géants | À mener au fil des évolutions, pas en chantier dédié |
| KLT-1926 | P3 | ⬜ À faire | Réduire les `any` TypeScript | À mener au fil des évolutions |

---

## Conventions

### Identifiants

| Élément | Format | Exemple |
|---|---|---|
| Epic | `EP-NN` | `EP-04` |
| User story | `US-NN.MM` (NN = epic) | `US-04.05` |
| Ticket | `KLT-NNMM` (NN = epic) | `KLT-0401` |

Les numéros ne sont jamais réutilisés ; une lacune dans une série est normale.

### Statuts

| User story | Ticket | Signification |
|---|---|---|
| ✅ Livré | ✅ Terminé | En production |
| 🟡 Partiel | — | Livrée avec une limite connue, suivie par un ticket ouvert |
| ⬜ À faire | ⬜ À faire | Non commencé |
| — | 🔍 À confirmer | Constat à vérifier avant de corriger |

### Types de ticket

`Bug` · `Sécurité` · `Conformité` · `Amélioration` · `Performance` · `Dette technique` · `Qualité` · `Documentation` · `Infrastructure` · `SEO`

### Priorités

| | Règle |
|---|---|
| **P0** | Faille exploitable, perte d'argent ou de données, obligation légale déjà en vigueur |
| **P1** | Risque réel à court terme, ou prérequis d'autres tickets |
| **P2** | Gêne utilisateur ou dette qui ralentit le développement |
| **P3** | Confort, nettoyage |

### Estimations

`XS` < 2 h · `S` ≤ 1 jour · `M` 2-5 jours · `L` > 1 semaine

### Structure d'un ticket

Ligne de métadonnées (type, statut, priorité, US liée, référence commit ou fichier), puis :
- **terminé** : Problème → Cause → Correction (→ Vérification) ;
- **ouvert** : Constat (avec preuve) → Proposition → Critères de validation → Estimation.

---

## Maintenir ce backlog

- Un ticket se crée dans le fichier de son epic, sous `## Tickets`, avec le numéro suivant de la série.
- À la livraison : passer le statut en `✅ Terminé`, ajouter le commit dans **Réf.** et la section Correction.
- Le CSV se régénère avec `python docs/backlog/build_csv.py docs/backlog`, qui vérifie aussi que chaque référence `US-…` / `KLT-…` existe. Le script lit les titres `### US-…` / `### KLT-…` et la ligne de métadonnées qui suit. Garder ce format pour que l'export reste juste.
