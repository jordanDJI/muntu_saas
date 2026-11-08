# Plan éditorial — Univers Klientys

> **Ce document est la source de vérité de l'agent de contenu.** Il le lit à chaque run.
> Il ne le modifie jamais : seul Jordan le met à jour, par un commit.
>
> L'agent n'a aucun accès à la base. Il utilise uniquement :
> - `GET /admin/content/blog/agent-list` pour savoir quels slugs existent déjà ;
> - `POST /admin/content/blog/propose` pour déposer un brouillon (jamais publié directement).

---

## 0. Mode d'emploi pour l'agent (à suivre à chaque run)

1. Lire ce document en entier, en particulier §1 (vérité produit) et §7 (règles de rédaction).
2. Appeler `agent-list` et récupérer la liste des slugs existants (toutes langues, draft + published).
3. Parcourir le **calendrier (§9) de haut en bas**. Prendre la **première ligne dont le slug n'existe pas encore**.
4. Rédiger cet article, et **uniquement celui-là** : slug, format, persona, mots-clés, question
   (« Répond à »), source unique et liens imposés par la ligne. Ne pas traiter la question d'une autre
   ligne : y renvoyer par un lien si elle est publiée.
   - Pour un mot-clé, consulter sa catégorie dans `keywords-200.md` et la section **Intentions à risque**.
   - Pour toute instruction « allez dans… », n'utiliser que les chemins de l'**annexe A**.
5. Le proposer via `propose` (toujours en `draft`, toujours en `fr`).
6. Si toutes les lignes du calendrier existent déjà : **ne rien proposer**. Ne jamais inventer de sujet hors calendrier.

> Pourquoi cette règle : quand l'agent choisissait lui-même son sujet, deux runs pouvaient juger
> différemment ce qui était « déjà couvert », et les articles se répétaient. Le calendrier fixe le
> sujet à l'avance ; l'existence du slug suffit à savoir s'il est traité.

---

## 1. Vérité produit — ce que Klientys fait et ne fait pas

Un article ne cite **que** des fonctionnalités de cette liste. En cas de doute, ne pas mentionner.

### Ce que Klientys fait (en production)

| Domaine | Ce qui existe réellement |
|---|---|
| Site vitrine | Site public par professionnel (`klientys.co/{slug}`), assistant de création en 9 étapes sans code, modifiable à tout moment par le pro lui-même, SEO de base inclus, domaine personnalisé (connecté ou acheté), suivi GA4 / Meta Pixel / GTM avec bandeau cookies |
| Prise de RDV | Réservation en ligne depuis le site, plusieurs plages par jour (pause déjeuner), périodes bloquées (congés), confirmation/refus par le pro, rappel email 24 h avant, questions personnalisées dans le formulaire |
| Acompte | Acompte PayPal optionnel à la réservation, remboursé automatiquement si le pro refuse la demande |
| CRM | Fiche contact configurable (champs personnalisés), historique des échanges, notes internes, import/export CSV-Excel avec enrichissement sans doublon, relances, pipeline des demandes en vue liste ou Kanban, pièces jointes par contact, campagnes email ciblées (clients inactifs, étiquette) |
| Demandes (leads) | Toutes les demandes (formulaire, réservation, widgets) au même endroit, avec leur source |
| Agents IA | Chatbot sur le site (gratuit sur tous les plans), agent support client, assistant du pro sur Telegram / WhatsApp |
| Widgets | Chatbot, réservation et formulaire de contact intégrables sur un site existant (Wix, WordPress…), multilingues fr/en/de/nl, mesure des demandes par support |
| Facturation (France) | Factures générées depuis un rendez-vous, suivi brouillon → envoyée → payée, avoirs, numérotation continue, mentions légales françaises (franchise 293 B, exonération médicale 261-4-1°, autoliquidation…), PDF **Factur-X** (EN 16931) + UBL |
| Analytics | Visites, clics, formulaires et conversations du site ; potentiel de demande locale (Google Trends par zone) |
| Annuaire | Fiche gratuite dans l'annuaire public `/annuaire/{metier}/{ville}` |
| Équipe & croissance | Membres invités avec accès limités par section (CRM, agenda, site, analytics, agents) ; plan Business : membres illimités, plusieurs espaces de travail avec un calendrier chacun, contacts illimités |
| Accompagnement | Guides interactifs intégrés au tableau de bord, support par email (prioritaire en Pro) ; plan Business : onboarding personnalisé, refonte du design par l'équipe Klientys (1 site, sur demande), interlocuteur dédié |
| Sécurité | Double authentification (TOTP), chiffrement des secrets, export RGPD des données |
| Essai | 14 jours gratuits, sans carte |

### Ce que Klientys ne fait pas — ne jamais l'affirmer

- **Transmission de factures via une PDP** (plateforme de dématérialisation partenaire) : Klientys produit des factures au format Factur-X, mais **ne les transmet pas** à l'administration et n'est pas PDP. Pas d'e-reporting.
- **Facturation belge Peppol** : non couverte. Aucun article ne doit laisser penser qu'un pro belge peut facturer en conformité Peppol avec Klientys.
- **Hébergement certifié HDS** (données de santé) : pas de certification. Ne pas écrire « conforme HDS » ni « hébergement de données de santé agréé ».
- **Télétransmission / carte Vitale / tiers payant / dossier patient médical** : n'existe pas.
- **Paiement en ligne de la prestation complète** (hors acompte PayPal), **Stripe pour les clients finaux**, **SMS** : n'existe pas.
- **Application mobile native** : n'existe pas (le dashboard est responsive).
- Aucun **chiffre de clients, de RDV pris, de gain de temps** : il n'existe pas de statistique publiée. Ne pas en inventer.

---

## 2. Personas

**Klientys s'adresse à toute activité qui vit de ses clients** et a besoin, au même endroit :
- d'un site facile à créer et à modifier soi-même ;
- d'un CRM et de ce qui gravite autour (agenda, demandes, relances, factures, campagnes) ;
- de mesurer ce qui marche (analytics) ;
- d'être accompagnée ;
- de pouvoir grandir (équipe, plusieurs espaces) sans changer d'outil.

Les métiers ci-dessous sont des **exemples prioritaires pour le SEO**, pas une limite. Il y a deux
familles de personas :
- **par métier** : ils captent des recherches précises (« logiciel kiné », « devis artisan ») ;
- **par stade d'activité** : ils parlent à tous les métiers à la fois.

Chaque article vise **un seul persona principal**. L'agent écrit pour cette personne : son vocabulaire,
ses contraintes, son quotidien.

### Par stade d'activité (tous métiers)

| Code | Persona | Contexte | Douleurs principales | Ce qu'il attend de Klientys |
|---|---|---|---|---|
| `P-CREA` | Se lance | Premiers mois, budget serré, pas de présence en ligne | « Par où commencer ? », crédibilité, coût des outils | Un site pro vite, sans compétence technique ; un seul abonnement |
| `P-SOLO` | Indépendant installé | Clientèle établie, travaille seul, outils dispersés (Excel, agenda papier, WhatsApp, Word) | Demandes perdues, relances oubliées, administratif le soir | Tout centraliser, ne plus rien oublier |
| `P-CROISS` | Veut développer son activité | Plus de demandes qu'il ne peut en suivre, ou pas assez | Ne sait pas d'où viennent ses clients, ne peut pas déléguer, plafonne | Mesurer (analytics, demande locale), automatiser (agents IA, rappels), déléguer |
| `P-TPE` | Petite équipe (2-10) | Associés, salariés, secrétaire, parfois plusieurs lieux | Qui fait quoi, accès aux données, un agenda par personne ou par lieu | Membres avec accès limités, plusieurs espaces, accompagnement |

### Par métier (exemples prioritaires)

| Code | Persona | Contexte | Douleurs principales | Vocabulaire (cf. `lib/sectorVocabulary.ts`) |
|---|---|---|---|---|
| `P-SERV` | Consultant, coach, formateur, prestataire de services | Vend son temps et son expertise, souvent à distance | Prospects à suivre, devis, prises de RDV par email | clients, prospects, séances |
| `P-INF` | Infirmière / infirmier libéral (FR, BE) | Tournées, beaucoup d'appels, pas de secrétariat | Téléphone qui sonne pendant les soins, planning de tournée, administratif le soir | patients, soins, tournée |
| `P-KINE` | Kiné, ostéopathe | Cabinet seul ou à deux, souvent sur Doctolib | Coût de Doctolib, RDV non honorés, dépendance à une plateforme | patients, séances |
| `P-BIEN` | Esthéticienne, praticien bien-être, coach | Activité qui vit d'Instagram et du bouche-à-oreille | Réservations par DM, annulations de dernière minute, pas de site | clientes, séances, soins |
| `P-ART` | Artisan (plombier, électricien, menuisier…) | Sur les chantiers toute la journée | Demandes de devis perdues, rappels oubliés, factures en retard | devis, chantiers, clients |
| `P-RESTO` | Restaurant, commerce de proximité | Petite équipe, réservations par téléphone | Réservations de groupe, horaires, visibilité locale | réservations, couverts, clients |

> **Pays** : FR et BE. Un article qui traite de réglementation précise toujours le pays.
> Les règles de facturation (§1) sont françaises uniquement.

---

## 3. Étapes du parcours d'achat

| Étape | Le lecteur… | Ce que l'article fait | CTA autorisé |
|---|---|---|---|
| **TOFU** — découverte | a un problème, ne cherche pas d'outil | explique, rassure, donne une méthode utilisable **sans Klientys** | doux : lien vers un article MOFU, annuaire, ou une page `/site-internet-pour/...` |
| **MOFU** — considération | compare des façons de faire / des outils | compare honnêtement, montre comment Klientys s'y prend | essai gratuit (`/onboarding`) ou tarifs (`/#pricing`) |
| **BOFU** — décision | hésite à s'inscrire | lève une objection précise, montre le produit étape par étape | essai gratuit, explicite |
| **RÉTENTION** — client | utilise déjà Klientys | apprend une fonctionnalité méconnue, un usage | lien vers la section du dashboard concernée |

> Règle : un article TOFU ne doit pas devenir une publicité. Au moins **70 % du contenu** est utile
> à quelqu'un qui n'utilisera jamais Klientys.

---

## 4. Les univers éditoriaux

Chaque univers = **1 pilier** (article long, référence) + des satellites qui pointent vers lui.
Les univers A à E existaient ; F à H les complètent pour parler de l'environnement des clients, pas
seulement du produit.

### A — Être trouvé localement (SEO local, Google, avis)
- **Pilier** : `article-seo-local.md` (rédigé).
- **Angle Klientys** : site vitrine, annuaire, domaine personnalisé, potentiel de demande locale.
- **Mots-clés** : `keywords-200.md` cat. 8, 10, 15 (la cat. 7, métier × ville, appartient aux pages programmatiques).

### B — Sortir de la dépendance aux plateformes (Doctolib, Calendly, Wix, Planity)
- **Pilier** : « Pourquoi les indépendants quittent les plateformes de réservation ».
- **Angle Klientys** : site + agenda + CRM à soi, données exportables, pas de commission.
- **Règle** : les tarifs des concurrents ne sont cités **qu'avec la source et la date** de relevé. Sinon, ne pas chiffrer.
- **Mots-clés** : cat. 2, 9, 24.

### C — Organiser son agenda et ses clients
- **Pilier** : « Agenda en ligne + CRM pour indépendant : le guide ».
- **Angle Klientys** : plages multiples, périodes bloquées, rappels, acompte, fiche contact, import CSV.
- **Mots-clés** : cat. 12, 22 (les cat. 3, 4, 6 vont aux pages métier).

### D — Agents IA & messageries (WhatsApp, Telegram, chatbot)
- **Pilier** : « Agent IA WhatsApp pour indépendants : ce qui est autorisé (règles Meta 2026) ».
- **Fait vérifié** : depuis le 15 janvier 2026, Meta interdit les chatbots généralistes sur WhatsApp Business ; les agents métier (prise de RDV, qualification de demande) restent autorisés.
- **Angle Klientys** : chatbot du site, assistant Telegram/WhatsApp du pro.
- **Mots-clés** : cat. 11, 18.

### E — Facturation électronique & conformité *(mis à jour : Klientys a désormais un module de facturation)*
- **Pilier** : « Facturation électronique 2026-2027 : ce qui change pour un indépendant en France ».
- **Faits vérifiés** : réception des factures électroniques obligatoire pour toutes les entreprises assujetties à la TVA au **1er septembre 2026** ; émission obligatoire pour les TPE/PME au **1er septembre 2027** ; la transmission passe par une **PDP**.
- **Angle Klientys** : factures et avoirs conformes aux mentions françaises, format Factur-X.
- **⚠️ Limite à toujours écrire** : Klientys **produit** la facture au bon format, mais **ne la transmet pas** à une PDP. L'article le dit clairement et explique que le pro devra choisir une PDP. Ne jamais écrire « 100 % conforme à la réforme ».
- **France uniquement** : pas d'article sur Peppol / Belgique dans cet univers.
- **Mots-clés** : cat. 19.

### F — Piloter et développer son activité *(nouveau)*
- **Piliers** : « Indépendant : l'administratif qui prend le plus de temps, et comment le réduire » et « Les indicateurs pour piloter son activité ».
- **Thèmes** :
  - gérer : devis → facture → relance, organisation de la semaine, premiers mois d'activité ;
  - mesurer : d'où viennent les clients, quels supports apportent des demandes, demande locale ;
  - grandir : déléguer, passer de seul à une équipe, ouvrir un deuxième lieu, être accompagné.
- **Angle Klientys** : facturation, analytics, mesure par intégration, potentiel de demande locale, membres et espaces de travail, accompagnement du plan Business.
- **Personas privilégiés** : `P-CREA`, `P-SOLO`, `P-CROISS`, `P-TPE`.

### G — Relation client & fidélisation *(nouveau)*
- **Pilier** : « RDV non honorés : causes, coût et solutions pour un indépendant ».
- **Thèmes** : rendez-vous manqués, acompte, rappels, avis clients, demandes perdues, répondre hors horaires.
- **Angle Klientys** : rappel 24 h, acompte PayPal, chatbot, centralisation des demandes.
- **Personas privilégiés** : `P-KINE`, `P-BIEN`, `P-RESTO`.

### H — Données clients, RGPD & sécurité *(nouveau)*
- **Pilier** : « RGPD pour un indépendant : ce que vous devez vraiment faire avec les données de vos clients ».
- **Thèmes** : consentement, durée de conservation, droit d'accès, cookies sur son site, sécuriser ses comptes (double authentification).
- **Angle Klientys** : export RGPD, bandeau cookies, double authentification, chiffrement.
- **⚠️ Santé** : ne jamais affirmer une conformité HDS (cf. §1). Pour les professionnels de santé, rappeler que les données médicales relèvent de règles spécifiques.

### Ce qu'on n'écrit pas
- **Articles métier × ville** (« site internet kiné Lyon ») : ce sont les pages `/site-internet-pour/{metier}/{ville}` et l'annuaire qui couvrent ces recherches. Un article de blog sur le même sujet leur ferait concurrence.
- **Déclinaisons d'un même article par métier** (« alternative Doctolib pour kiné », puis « … pour ostéo »…) si le contenu change à moins de 50 %. Un seul article qui traite les métiers dans des sections distinctes.
- **Sujets généralistes sans lien produit** (« 10 astuces de productivité ») : ils ramènent un trafic qui ne convertit pas.
  Un sujet transversal (« Excel ou CRM ? ») est le bienvenu s'il vise un persona précis du §2 et
  s'appuie sur une source unique.

---

## 5. Formats d'article

Le format est imposé par la ligne du calendrier. Chaque format a une structure différente — ne pas
tous les écrire sur le même moule.

| Code | Format | Longueur | Structure | FAQ |
|---|---|---|---|---|
| `PILIER` | Guide de référence | 2000-3000 mots | Sommaire, sections H2 complètes, encadré « l'essentiel », liens vers tous les satellites | oui (5-7 questions) |
| `GUIDE` | Pas à pas | 1000-1500 mots | Étapes numérotées, chaque étape avec une action concrète ; checklist récapitulative | non |
| `COMPAR` | Comparatif | 1200-1800 mots | Critères annoncés au début, tableau comparatif, verdict par profil de lecteur (« si vous êtes… ») | oui (3-4 questions) |
| `REGLE` | Décryptage réglementaire | 800-1200 mots | Ce qui change / qui est concerné / à quelle date / que faire ; sources officielles citées en liens | oui (3-5 questions) |
| `CAS` | Cas d'usage produit | 800-1200 mots | Situation d'un persona (un mardi de tournée, une semaine de chantier…), problème, comment il s'organise avec Klientys, ce qu'il reste à faire hors Klientys | non |
| `ERREURS` | Erreurs fréquentes | 900-1300 mots | 5 à 7 erreurs, pour chacune : pourquoi on la fait, ce que ça coûte, comment l'éviter | non |
| `QUESTION` | Réponse courte à une question | 600-900 mots | La réponse dans le premier paragraphe (pour Google et les assistants IA), puis le détail | non |

> **Variation obligatoire** : l'accroche et la formule du CTA final ne doivent jamais reprendre celles
> d'un article existant. Ouvrir par une situation concrète, une question, un chiffre sourcé ou une
> idée reçue — jamais par « Vous êtes indépendant et… ».

---

## 6. Maillage interne

Routes réelles à utiliser (ne pas inventer d'URL) :

| Cible | URL |
|---|---|
| Essai gratuit | `/onboarding` |
| Tarifs | `/#pricing` |
| Pages métier | `/site-internet-pour/{metier}` |
| Pages métier × ville | `/site-internet-pour/{metier}/{ville}` |
| Annuaire | `/annuaire`, `/annuaire/{metier}/{ville}`, `/annuaire/ville/{ville}` |
| Blog | `/blog/{slug}` (uniquement des slugs présents dans `agent-list` **en `published`**) |

Règles :

```
Tout article
   → 1 lien vers le pilier de son univers (s'il est publié)
   → 1 lien vers un article d'un AUTRE univers (indiqué dans le calendrier)

TOFU  → 2 pages /site-internet-pour/... ou annuaire, adaptées au persona
MOFU  → /#pricing ou /onboarding + tableau comparatif
BOFU  → /onboarding, explicite
PILIER → liens vers tous ses satellites publiés + 1-2 autres piliers
```

> Ne jamais faire de lien vers un brouillon : il renverrait une 404.

---

## 7. Règles de rédaction

### Ton
- Vouvoiement. Phrases courtes. Zéro jargon marketing ou technique non expliqué (le lecteur n'est pas un spécialiste du digital).
- Parler du métier du lecteur avant de parler de l'outil.
- Honnête sur les limites : dire ce que Klientys ne fait pas quand c'est pertinent (cf. §1). Ça rassure plus qu'une promesse.

### Le bénéfice d'abord, la fonctionnalité ensuite
Le lecteur cherche un résultat, pas un logiciel. Chaque fonctionnalité citée est introduite par ce
qu'elle change dans sa journée, puis nommée.

| ❌ Fonctionnalité seule | ✅ Bénéfice, puis fonctionnalité |
|---|---|
| « Klientys propose un pipeline Kanban. » | « Vous voyez d'un coup d'œil quelles demandes attendent une réponse — c'est la vue Kanban des demandes. » |
| « Rappel email automatique 24 h avant. » | « Vos patients reçoivent un rappel la veille, sans que vous y pensiez. » |
| « Acompte PayPal configurable. » | « Une cliente qui a versé un acompte vient à son rendez-vous. » |
| « Chatbot IA sur le site. » | « Les questions posées à 22 h trouvent une réponse avant le lendemain matin. » |

> Un bénéfice n'est écrit que s'il découle **directement** d'une fonctionnalité du §1. Pas de promesse
> chiffrée (« gagnez 5 h par semaine ») : aucune mesure ne l'appuie.

### Messages clés (un par article, pas tous à la fois)
| Message | Idée à transmettre | Univers où il sert le plus |
|---|---|---|
| Tout au même endroit | Site, agenda, demandes, clients et factures ne sont plus dispersés | C, F |
| Vos clients, pas ceux d'une plateforme | Données à vous, exportables, pas de commission | B, H |
| Disponible même quand vous travaillez | Réservation et réponses en dehors des heures, pendant les soins ou le chantier | D, G |
| Pensé pour votre métier | Vocabulaire, besoins et contraintes de chaque profession | tous |
| Sans être informaticien | Créer, modifier et utiliser sans compétence technique, avec de l'aide si besoin | A, C |
| Grandir sans changer d'outil | De seul à une équipe, d'un lieu à plusieurs, avec les mêmes données | F |

### Structure de rédaction par format
| Format | Méthode | Déroulé |
|---|---|---|
| `ERREURS`, `REGLE`, `QUESTION` | **PAS** | Problème → ce qu'il coûte s'il dure → la solution (d'abord sans outil, puis avec Klientys) |
| `CAS` | **Avant / Après / Pont** | La semaine du persona avant → la même semaine après → ce qu'il a mis en place |
| `GUIDE`, `COMPAR` | **Tâche à accomplir** | Ce que le lecteur veut obtenir → les étapes ou critères → le résultat |
| `PILIER` | libre | Vue d'ensemble qui renvoie vers les satellites |

### Proportions sur l'ensemble du blog
- **70 %** de contenu utile sans Klientys (TOFU)
- **20 %** de contenu sur les usages de Klientys (MOFU, RÉTENTION)
- **10 %** directement promotionnel (BOFU)

C'est une cible pour l'ensemble du blog. Le calendrier actuel (§9) penche vers le MOFU (≈ 49 % TOFU,
36 % MOFU, 13 % RÉTENTION, 3 % BOFU) : les prochaines lignes ajoutées doivent être en priorité TOFU.
Dans un article MOFU, la partie utile sans Klientys reste majoritaire.

### Interdits
- Inventer une statistique, un témoignage, un nom de client, une citation.
- Citer un prix concurrent sans source ni date.
- Affirmer une conformité ou une fonctionnalité absente du §1.
- Un conseil juridique ou fiscal présenté comme définitif : renvoyer vers la source officielle (service-public.fr, impots.gouv.fr, economie.gouv.fr, CNIL, SPF Finances pour la Belgique).

### Sources
- Toute affirmation réglementaire ou chiffrée porte un lien vers une source officielle ou primaire.
- Une date réglementaire est vérifiée au moment de la rédaction ; si elle a pu changer, l'écrire.

### SEO et assistants IA
- Un H1 unique, contenant le mot-clé principal de la ligne du calendrier.
- La réponse à la question du titre dans les 2 premières phrases.
- Description ≤ 155 caractères.
- Sous-titres formulés comme les questions que se pose le persona.

---

## 8. Hors périmètre de l'agent

L'agent ne produit **que des articles de blog en français**, en brouillon. Le reste est fait à la main
ou par d'autres outils :

| Quoi | Où | Qui |
|---|---|---|
| Traductions en/de/nl | bouton « Traduire » dans `/admin/content`, après publication du fr | Jordan |
| Posts LinkedIn | page Klientys (cf. `linkedin-post.md`) | Jordan |
| Témoignages | `/admin/content` → témoignages, **uniquement de vrais clients** | Jordan |
| Vidéos, newsletters | — | plus tard |

### Déclinaison d'un article (pour Jordan, après publication)
Un article publié se décline au lieu de créer des contenus indépendants :

| Article publié | Déclinaison |
|---|---|
| `ERREURS` | Post LinkedIn « une erreur par slide » (carrousel) |
| `CAS` | Post LinkedIn en récit (la semaine du persona) |
| `REGLE` | Post LinkedIn court : ce qui change + date + lien |
| `GUIDE` | Checklist en image |

LinkedIn est le seul réseau prioritaire tant que la production repose sur une personne. Instagram,
Facebook, TikTok : à ouvrir seulement quand LinkedIn tourne régulièrement.

### Ressources à télécharger (à construire plus tard)
Candidates, par ordre d'intérêt : checklist « facturation électronique 2026-2027 », modèle de
mentions obligatoires d'une facture, checklist « premier site internet ».

> **Prérequis** : il n'existe aujourd'hui **aucun formulaire public d'inscription à une newsletter**.
> Tant qu'il n'existe pas, l'agent ne propose aucune ressource « à télécharger contre email ».

---

## 9. Calendrier éditorial

**Ordre = priorité.** L'agent prend la première ligne dont le slug n'existe pas encore (§0).
Pour ajouter, retirer ou réordonner un sujet : modifier ce tableau et committer.

Logique de l'ordre : les **piliers des univers prioritaires** d'abord (B, E, C, D), pour que les
satellites aient un pilier publié vers lequel pointer ; puis une alternance TOFU / MOFU ; la
rétention et le BOFU en dernier, quand il y a du trafic à convertir.

Déjà publiés en dur dans le code (ne pas réécrire) : `cout-site-internet-independant`,
`doctolib-vs-klientys-kine-infirmier`, `remplir-agenda-en-ligne-sans-plateforme`. Ils
n'apparaissent pas dans `agent-list` : l'agent doit les considérer comme existants.
L'ancienne URL `cout-site-internet-independant-2025` redirige en 301 vers
`cout-site-internet-independant` (`frontend/next.config.ts`) : ne jamais créer de slug « prix /
coût d'un site » avec une année.

Colonnes :
- **Mots-clés** : numéros de [`keywords-200.md`](./keywords-200.md). Le premier est le mot-clé principal (H1, slug, description). « à mesurer » = pas encore de donnée de volume.
- **Répond à** : la question précise de l'article. **Deux lignes ne répondent jamais à la même question** : si un sujet voisin existe, l'article renvoie vers lui au lieu de le retraiter.
- **Source unique** : ce qui rend l'article impossible à écrire pour un concurrent ou un générateur générique. Si l'agent ne peut pas s'appuyer dessus, il le dit dans l'article plutôt que de combler par du générique.
- **Lien croisé** : l'article d'un autre univers à lier (si publié).

| # | Slug | Univers | Format | Étape | Persona | Mots-clés | Répond à | Source unique | Lien croisé |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `quitter-plateforme-reservation-independant` | B | PILIER | MOFU | `P-KINE`, `P-BIEN`, `P-SERV` | #11, #13, #14, #17 | Pourquoi et comment quitter une plateforme de réservation sans perdre ses clients ? | Export des données, site à soi, fiche annuaire gratuite, pas de commission | `agenda-crm-independant-guide` |
| 2 | `facturation-electronique-independant-2026-2027` | E | PILIER | TOFU | `P-CREA`, `P-SOLO`, `P-ART` | #201, #202 | Qu'est-ce qui change, pour qui et à quelle date ? | Calendrier officiel DGFiP ; ce que Klientys fait (Factur-X) et ne fait pas (PDP) | `devis-facture-relance-artisan` |
| 3 | `agenda-crm-independant-guide` | C | PILIER | MOFU | tous | #7, #126, #127, #10 | Comment organiser agenda, demandes et fiches clients dans un seul outil ? | Plages multiples, périodes bloquées, demandes en Kanban, import CSV avec enrichissement | `rgpd-donnees-clients-independant` |
| 4 | `agent-ia-whatsapp-regles-meta-2026` | D | PILIER | TOFU | tous | #116, #124 | A-t-on le droit d'utiliser un agent IA sur WhatsApp depuis 2026 ? | Politique WhatsApp Business de Meta (15/01/2026), distinction agent métier / chatbot généraliste | `rdv-non-honores-solutions-independant` |
| 5 | `excel-ou-crm-independant` | C | COMPAR | MOFU | `P-SOLO` | #223, #229 | À partir de quand Excel ne suffit plus ? | Import du fichier Excel sans doublon, export toujours possible (pas d'enfermement) | `outils-disperses-independant-centraliser` |
| 6 | `ajouter-reservation-site-wix-wordpress` | B | GUIDE | MOFU | `P-BIEN`, `P-SERV`, `P-ART` | #237, #238, #239 | Comment ajouter la prise de RDV à mon site actuel sans le refaire ? | Widgets Klientys (réservation, contact, chatbot) avec mesure par support | `quitter-plateforme-reservation-independant` |
| 7 | `mentions-obligatoires-facture` | E | REGLE | TOFU | `P-CREA`, `P-SOLO` | #204, #205, #209 | Quelles mentions doit porter ma facture, selon mon régime de TVA ? | Mentions gérées par le module (293 B, 261-4-1°, autoliquidation…) ; source impots.gouv | `facturation-electronique-independant-2026-2027` |
| 8 | `rdv-non-honores-solutions-independant` | G | PILIER | TOFU | `P-KINE`, `P-BIEN` | #232, #233 | Pourquoi des clients ne viennent pas, combien ça coûte, quelles solutions existent ? | Rappel 24 h, acompte remboursé si refus — sans détailler la mise en place (→ `acompte-reservation-en-ligne`) | `acompte-reservation-en-ligne` |
| 9 | `outils-disperses-independant-centraliser` | C | ERREURS | TOFU | `P-SOLO` | #229, #183 | Que perd-on à jongler entre Excel, WhatsApp, agenda papier et Word ? | Ce qui se perd entre les outils ; site + agenda + demandes + factures au même endroit | `excel-ou-crm-independant` |
| 10 | `factur-x-cest-quoi` | E | QUESTION | TOFU | tous | #203 | Factur-X, c'est quoi, concrètement ? | PDF lisible + XML EN 16931 embarqué, expliqué simplement | `facturation-electronique-independant-2026-2027` |
| 11 | `indicateurs-piloter-activite-independant` | F | PILIER | TOFU | `P-CROISS` | #211, #216, #85 | Quels chiffres suivre chaque mois pour savoir si mon activité progresse ? | Visites, demandes, taux de conversion, RDV — tels que les mesure le tableau de bord | `savoir-dou-viennent-ses-clients` |
| 12 | `rgpd-donnees-clients-independant` | H | PILIER | TOFU | tous | #136, #140, #135 | Que dois-je vraiment faire avec les données de mes clients ? | Export RGPD, bandeau cookies, consentement au formulaire ; source CNIL (APD pour la Belgique) | `agenda-crm-independant-guide` |
| 13 | `avis-google-artisan` | A | GUIDE | TOFU | `P-ART` | #112, #81 | Comment obtenir des avis Google, concrètement, après un chantier ? | Cohérence fiche Google / site / fiche annuaire | `devis-facture-relance-artisan` |
| 14 | `acompte-reservation-en-ligne` | G | GUIDE | MOFU | `P-BIEN`, `P-RESTO` | #234 | Comment demander un acompte à la réservation, et est-ce légal ? | Paramétrage PayPal, remboursement automatique au refus | `rdv-non-honores-solutions-independant` |
| 15 | `consultant-coach-site-suivi-prospects` | C | CAS | MOFU | `P-SERV` | #226, #227, #228, #230 | Comment un consultant ou un coach suit ses prospects jusqu'au premier RDV ? | Demandes en Kanban, questions personnalisées au formulaire, timeline des échanges | `excel-ou-crm-independant` |
| 16 | `facture-kine-exoneration-tva` | E | REGLE | TOFU | `P-KINE` | #206 | Quelle mention d'exonération sur une facture de kiné ? | Différence exonération / autoliquidation (erreur fréquente des logiciels) | `quitter-plateforme-reservation-independant` |
| 17 | `instagram-reservation-estheticienne` | B | CAS | MOFU | `P-BIEN` | #240, #177 | Comment passer des réservations par DM Instagram à un vrai agenda ? | Intégration de type lien (bio Instagram) + mesure des demandes par support | `acompte-reservation-en-ligne` |
| 18 | `erreurs-premier-site-internet-independant` | A | ERREURS | TOFU | `P-CREA` | #94, #179 | Quelles erreurs rendent un premier site inutile ? | Assistant de création en 9 étapes : ce que chaque étape évite | `cout-site-internet-independant` |
| 19 | `chatbot-site-prise-rdv-fonctionnement` | D | CAS | MOFU | `P-KINE` | #117, #122, #193 | À quoi ressemble une journée avec un chatbot sur son site ? | Chatbot gratuit sur tous les plans ; ce qu'il lui faut pour bien répondre (prestations, contact) | `agenda-crm-independant-guide` |
| 20 | `savoir-dou-viennent-ses-clients` | F | GUIDE | TOFU | `P-CROISS` | #212, #214 | Comment savoir quel canal m'apporte des demandes ? | Source de chaque demande, mesure par support (site, Instagram, page externe) — sans reprendre la liste des indicateurs (→ #11) | `indicateurs-piloter-activite-independant` |
| 21 | `devis-facture-relance-artisan` | F | GUIDE | MOFU | `P-ART` | #52, #207 | Comment ne plus perdre une demande entre le devis et le paiement ? | Demandes centralisées, facture depuis le RDV, suivi jusqu'à « payée » | `facturation-electronique-independant-2026-2027` |
| 22 | `infirmier-liberal-telephone-tournee` | D | CAS | MOFU | `P-INF` | #118, #125 | Comment ne plus être interrompu par le téléphone pendant les soins ? | Assistant Telegram/WhatsApp du pro + chatbot du site (pas de réponse aux appels — le dire) | `rdv-non-honores-solutions-independant` |
| 23 | `modifier-son-site-soi-meme` | A | QUESTION | TOFU | `P-CREA` | à mesurer | Peut-on modifier son site soi-même, sans webmaster ? | Éditeur sans code modifiable à tout moment ; refonte par l'équipe en plan Business | `erreurs-premier-site-internet-independant` |
| 24 | `relancer-clients-inactifs-email` | G | GUIDE | TOFU | `P-SOLO` | #231, #134 | Comment relancer d'anciens clients sans les agacer ni enfreindre le RGPD ? | Campagnes ciblées (inactifs, étiquette), lien de désinscription ; règles CNIL | `rgpd-donnees-clients-independant` |
| 25 | `passer-de-seul-a-equipe` | F | GUIDE | TOFU | `P-TPE`, `P-CROISS` | #218, #221 | Comment s'organiser quand on n'est plus seul ? | Rôles owner / admin / membre — l'organisation, pas le pas à pas (→ #36) | `travailler-avec-secretaire-acces-limite` |
| 26 | `google-business-profile-infirmier-liberal` | A | GUIDE | TOFU | `P-INF` | #111, #110 | Comment créer et tenir sa fiche Google quand on fait des tournées ? | Cohérence fiche Google / site / annuaire, zones d'intervention | `infirmier-liberal-telephone-tournee` |
| 27 | `bandeau-cookies-site-vitrine` | H | QUESTION | TOFU | `P-CREA` | #142 | Faut-il un bandeau cookies sur un site vitrine ? | Quand il est obligatoire (GA4, Meta Pixel) et quand non ; source CNIL | `erreurs-premier-site-internet-independant` |
| 28 | `alternative-doctolib-belgique` | B | COMPAR | MOFU | `P-KINE`, `P-INF` | #163 | Quelles options en Belgique pour la prise de RDV en ligne ? | Site en fr/nl, domaine .be, annuaire par ville belge — **aucune mention de facturation** (Peppol non couvert) | `quitter-plateforme-reservation-independant` |
| 29 | `creer-site-independant-belgique` | A | GUIDE | TOFU | `P-CREA` | #170, #165 | Que doit contenir le site d'un indépendant en Belgique ? | Mentions propres à la Belgique (numéro d'entreprise BCE), site multilingue ; source SPF Économie | `alternative-doctolib-belgique` |
| 30 | `lancer-activite-independant-outils` | F | ERREURS | TOFU | `P-CREA` | #171, #172, #173 | Quels outils mettre en place au lancement, et lesquels peuvent attendre ? | Ce dont on a besoin le mois 1 vs le mois 6 ; essai 14 jours | `erreurs-premier-site-internet-independant` |
| 31 | `reservation-groupe-restaurant` | G | CAS | MOFU | `P-RESTO` | #236 | Comment accepter des réservations de groupe sans surbooking ? | Capacité par créneau, taille de groupe max par plage | `acompte-reservation-en-ligne` |
| 32 | `site-multilingue-clientele-etrangere` | A | QUESTION | MOFU | `P-BIEN`, `P-RESTO` | à mesurer | Comment recevoir des demandes en anglais, allemand ou néerlandais ? | Widgets et chatbot fr/en/de/nl | `chatbot-site-prise-rdv-fonctionnement` |
| 33 | `ouvrir-deuxieme-lieu-agenda-par-espace` | F | CAS | MOFU | `P-TPE` | #219, #220 | Comment gérer deux lieux sans mélanger les agendas ? | Plusieurs espaces de travail avec calendrier indépendant (plan Business) | `passer-de-seul-a-equipe` |
| 34 | `importer-fichier-clients-excel-crm` | C | GUIDE | RÉTENTION | tous | #225 | Comment importer mon fichier Excel sans créer de doublons ? | Rapprochement par email, mode compléter / écraser, une cellule vide n'efface rien | `excel-ou-crm-independant` |
| 35 | `pause-dejeuner-conges-agenda-en-ligne` | C | GUIDE | RÉTENTION | `P-KINE`, `P-INF` | à mesurer | Comment régler pause déjeuner et congés dans l'agenda ? | Plusieurs plages par jour, périodes bloquées | `rdv-non-honores-solutions-independant` |
| 36 | `travailler-avec-secretaire-acces-limite` | F | GUIDE | RÉTENTION | `P-KINE`, `P-ART` | #217 | Comment donner accès à une secrétaire sans tout partager, pas à pas ? | Invitation, rôle membre, accès par section | `rgpd-donnees-clients-independant` |
| 37 | `double-authentification-comptes-pro` | H | GUIDE | RÉTENTION | tous | à mesurer | Comment protéger son compte avec la double authentification ? | Activation pas à pas (annexe A) | `rgpd-donnees-clients-independant` |
| 38 | `potentiel-demande-locale-google-trends` | A | CAS | RÉTENTION | tous | #113 | Mon métier est-il recherché dans ma ville ? | Carte de potentiel de demande locale (Google Trends par zone) | `avis-google-artisan` |
| 39 | `essai-gratuit-klientys-14-jours` | C | GUIDE | BOFU | tous | à mesurer | Que mettre en place pendant les 14 jours d'essai, dans quel ordre ? | Parcours réel : site → disponibilités → prestations → publication → chatbot ; essai sans carte | `agenda-crm-independant-guide` |

> **Pour allonger le calendrier** : ajouter des lignes en respectant §4 (« ce qu'on n'écrit pas »),
> en vérifiant que la question de « Répond à » n'est traitée par aucune autre ligne, et en remplissant
> *Source unique*. Une ligne sans source unique n'a pas sa place ici. Les mots-clés de la section
> « Intentions à risque » de `keywords-200.md` ne deviennent jamais un mot-clé principal.

---

## 10. Mesurer

| KPI | Où le lire | Fréquence |
|---|---|---|
| Impressions, clics, position par article | Google Search Console | mensuelle |
| Trafic organique par univers | GA4 (filtre par chemin `/blog/...`) | mensuelle |
| Inscriptions venant du blog | GA4 → conversion `/onboarding` | trimestrielle |
| Recherches de marque « klientys » | Search Console | trimestrielle |

Un univers qui ne génère aucune impression après 3 mois et 3 articles publiés : le mettre en pause
dans le calendrier plutôt que d'y ajouter des articles.

---

## Annexe A — Où se trouve chaque réglage (pour les articles GUIDE)

Un article qui explique « comment faire dans Klientys » n'utilise **que** ces chemins, avec ces
libellés exacts. Si une étape n'est pas dans cette liste, l'agent la décrit sans nommer de bouton et
signale l'endroit par `[À VÉRIFIER : …]`. Là où une image aiderait, il insère `[CAPTURE : ce qu'elle
doit montrer]` — Jordan remplace ces emplacements avant publication.

> Relevé dans le code le 2026-11-08 (`dashboard/layout.tsx`, `dashboard/settings/page.tsx`,
> `lib/i18n.ts`). À mettre à jour si la navigation change.

### Menu principal (barre latérale)

| Libellé | Ce qu'on y fait |
|---|---|
| **Tableau de bord** | Vue d'ensemble, liens vers le site publié et l'aperçu |
| **Demandes** | Toutes les demandes entrantes, en vue liste ou **Kanban** |
| **Rendez-vous** | Agenda jour / semaine / mois ; boutons **⚙ Disponibilités** (plages horaires, plusieurs par jour), **🚫 Bloquer** (congés, fermeture), **📋 Formulaire** (onglet *Formulaire* : questions personnalisées ; onglet *Paiement* : acompte PayPal) |
| **Mon site** | Assistant de création en 9 étapes, bouton **Publier** |
| **Analytics** | Visites, clics, formulaires, conversations du chatbot, potentiel de demande locale |
| **Agents IA** | Chatbot du site, agent support client, assistant Telegram / WhatsApp |
| **Factures** | Factures et avoirs |
| **Contacts** | Fiches clients, import / export. ⚠️ Le libellé change selon le métier (ex. « Patients ») : écrire « la section Contacts (ou Patients, selon votre métier) » |
| **Relances** | Rappels à faire auprès des contacts |
| **Campagnes** | Emails envoyés à un groupe de clients (inactifs, étiquette) |
| **Intégrer** | Codes à copier pour ajouter réservation, contact ou chatbot à un site existant ; liste des supports (intégrations) |
| **Paramètres** | Voir ci-dessous |

### Paramètres (sections)

| Section | Contenu utile aux articles |
|---|---|
| **Profil** | Nom, informations du compte |
| **Sécurité** | Double authentification (code à 6 chiffres via une application d'authentification) |
| **Mon site** | Réglages du site |
| **Domaine** | Connecter ou acheter un domaine personnalisé |
| **Annuaire public** | Créer / modifier sa fiche annuaire, zones d'intervention |
| **Métriques** | Choisir les indicateurs affichés sur le tableau de bord |
| **Abonnement** | Plan, facturation Klientys (propriétaire et admin uniquement) |
| **Notifications** | Emails reçus par le pro |
| **Équipe** | Inviter un membre, choisir son rôle et ses accès par section (propriétaire et admin uniquement) |
| **Champs contact** | Activer, désactiver ou créer des champs de fiche contact |
| **Facturation** | Identité légale, adresse, régime de TVA, mentions — ce qui manque pour une facture conforme est signalé |
| **Intégrations** | Connexion Google Analytics 4 |
| **Export & RGPD** | Export des données |
| **Support** | Contacter l'équipe Klientys |

> Ne pas citer les sections **Préférences**, **RGPD** et **Activité** sans vérification : leur contenu
> exact n'est pas relevé ici.

---

## Annexes

- Mots-clés chiffrés FR + BE : [`keywords-200.md`](./keywords-200.md)
- Pilier SEO local : [`article-seo-local.md`](./article-seo-local.md)
- Pages programmatiques : [`programmatic-page-spec.md`](./programmatic-page-spec.md)
- Annuaire : [`annuaire-public-spec.md`](./annuaire-public-spec.md)
