# EP-06 · CRM : contacts, leads, relances

**Objectif** : donner au pro une base clients simple mais fiable : chaque demande devient un lead, chaque client a une fiche, rien ne se perd entre deux imports.

**Périmètre code** : `backend/app/api/v1/contacts.py`, `contact_fields.py`, `leads.py`, `reminders.py`, `tags.py`, `attachments.py`, `backend/app/services/lead.py`, `activity.py`, `contact_limits.py`, `phone.py`, `frontend/app/dashboard/contacts/`, `leads/`, `reminders/`, `frontend/lib/sectorVocabulary.ts`, migrations `009`, `013`, `016`, `033`→`040`, `062`, `066`→`070`, `076`, `078`

**Personas** : Pro, Membre (permission `crm`)

---

## User stories

### US-06.01 · Retrouver mes contacts
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux rechercher, filtrer et visualiser mes contacts (liste ou kanban) afin de retrouver un client en quelques secondes.

**Critères d'acceptation**
- Recherche, filtres (tags, fiche incomplète), vue kanban.
- Libellés adaptés au secteur (« Patients », « Clients »…) via `useSectorVocab`.

**Tickets** : KLT-0620

### US-06.02 · Consulter et enrichir une fiche contact
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux une fiche complète avec notes internes, historique des échanges, photo et documents afin d'avoir tout le contexte avant un RDV.

**Critères d'acceptation**
- **Notes internes** (`contact.notes`, texte libre) distinctes de la **timeline** (`contact_activity`, événements datés).
- Photo stockée dans le bucket privé `contact-photos`, servie en URL signée 1 h.
- Pièces jointes : Pro 5 × 45 Mo, Business 10 × 45 Mo, bucket privé, stockées en `application/octet-stream`.
- Journal des modifications par fiche (`activity_log.target_type/target_id`).

**Tickets** : KLT-0608, KLT-0613, KLT-0615

### US-06.03 · Configurer les champs de ma fiche contact
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux désactiver les champs inutiles et créer les miens afin que la fiche corresponde à mon métier.

**Critères d'acceptation**
- `contact_field_def` par tenant ; seed paresseux au premier `GET /contact-fields/`.
- `first_name`, `last_name`, `email`, `phone` jamais désactivables ni supprimables.
- Champs custom : `cf_<8 hex>`, `storage_mode = jsonb`, types text / phone / email / date / number / select.
- Réordonnancement par glisser-déposer ; validation générique par type.

### US-06.04 · Supprimer un champ sans perdre de données par accident
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux être prévenu quand un champ supprimé contient des données, et pouvoir les récupérer, afin de ne rien perdre par erreur.

**Critères d'acceptation**
- `DELETE /contact-fields/{key}` → 409 avec le décompte ; `?purge=true` supprime définition **et** valeurs.
- `GET /contact-fields/usage` : décompte par champ + clés orphelines (écran de configuration uniquement).
- `POST /contact-fields/reattach` restaure une clé orpheline ; `DELETE /contact-fields/orphans/{key}` la purge.
- Badge ambre « N ✎ » sur un champ désactivé qui porte encore des données.

**Tickets** : KLT-0607, KLT-0631

### US-06.05 · Importer mes contacts depuis un fichier
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux importer un CSV ou un Excel, et le réimporter enrichi plus tard, afin de migrer depuis mon ancien outil sans doublons.

**Critères d'acceptation**
- Tâche de fond (`contact_import_job`) qui survit à la fermeture de l'onglet, toast de statut sur toutes les pages.
- Un seul import en cours par tenant (index partiel, migration `078`) ; fichier ≤ 20 Mo et ≤ 50 000 lignes.
- Rapprochement : email seul s'il est présent ; téléphone normalisé seulement pour les lignes sans email ; plusieurs correspondances → ligne signalée.
- Modes `complete` (remplit les vides) et `overwrite` (le fichier gagne) ; **une cellule vide n'efface jamais rien**.
- Rapport : créés, enrichis, ambigus ; détail des changements en mode `overwrite`.
- Le quota du plan ne compte que les créations.
- En-têtes reconnus par libellé, clé ou alias FR, insensibles à la casse, aux accents et aux séparateurs.

**Tickets** : KLT-0601 → KLT-0606, KLT-0610 → KLT-0612, KLT-0617, KLT-0630

### US-06.06 · Exporter mes contacts
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux exporter mes contacts en CSV ou Excel, et télécharger un modèle d'import, afin de garder la maîtrise de mes données.

**Critères d'acceptation**
- Colonnes = champs activés, dans leur ordre.
- Modèle d'import généré côté serveur, mêmes colonnes.

### US-06.07 · Garder une base propre
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux repérer les doublons et les fiches incomplètes afin que ma base reste exploitable.

**Critères d'acceptation**
- Détection des doublons probables, fusion manuelle ou ignorance définitive.
- Badge et filtre « fiche incomplète » ; suggestions d'archivage des fiches incomplètes inactives.

### US-06.08 · Suivre mes demandes entrantes (leads)
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux voir chaque demande entrante avec sa source et son statut afin de n'en oublier aucune.

**Critères d'acceptation**
- Sources : `booking`, `contact_form`, `website` (widget), agents.
- Plusieurs leads par contact (`ensure_lead()` insère toujours).
- Pipeline complet, sauf RDV en attente : `new → confirmed / refused`.
- Titre et types adaptés au secteur (« Devis », « Demandes de soin »…).
- Attribution à l'intégration d'origine (`lead.integration_id`, EP-13).

**Tickets** : KLT-0619

### US-06.09 · Programmer des relances
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux planifier des relances sur un contact, éventuellement envoyées automatiquement, afin de ne pas perdre un prospect.

**Critères d'acceptation**
- Échéance, type, note, envoi automatique par email (et Telegram si le contact est lié).
- Relances en retard signalées (aussi dans la fiche tenant admin).

### US-06.10 · Classer mes contacts par tags
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux taguer mes contacts afin de les segmenter (campagnes, filtres).

**Critères d'acceptation**
- CRUD tags, ajout / retrait sur un contact, filtres et segments de campagne par tag.

**Tickets** : KLT-0203

### US-06.11 · Respecter les limites de mon plan sans blocage brutal
**Statut** : ✅ Livré · **Persona** : Pro, Opérateur

> En tant que **pro**, je veux être prévenu à l'approche de ma limite de contacts afin de passer au plan supérieur avant d'être bloqué.

**Critères d'acceptation**
- `ContactLimitBanner` à 80 % et 95 % de `max_contacts`.
- Plafond de grâce à 150 % du plan, avertissement de dépassement pendant 3 mois (bannière tenant + badge admin), puis restriction manuelle par l'admin.

**Tickets** : KLT-0618

---

## Tickets

### KLT-0601 · Réimporter un fichier enrichi ne mettait rien à jour
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-06.05 · **Réf.** : `83d039c` (2026-10-05)

**Problème** — Une ligne dont l'email existait était comptée « ignorée » et abandonnée.

**Correction** — Rapprochement puis enrichissement (`_match_existing`, `_plan_enrichment`), modes `complete` / `overwrite`. Migration `076`.

### KLT-0602 · Deux membres d'un même foyer fusionnés à l'import
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-06.05 · **Réf.** : `83d039c`

**Cause** — Repli inconditionnel sur le téléphone : deux personnes au même numéro mais aux emails distincts devenaient un seul contact.

**Correction** — L'email est la seule clé quand il est présent ; le téléphone ne sert que pour les lignes sans email. Trouvé en rejouant le plan de recette contre les fonctions réelles.

### KLT-0603 · Une ligne sans champ custom faisait échouer tout l'import
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-06.05 · **Réf.** : `83d039c`

**Cause** — `custom_fields` envoyé à `null` explicite ; la colonne est `NOT NULL` et le défaut ne s'applique que si la clé est absente : Postgres rejetait l'insertion multi-lignes entière. Présent depuis la migration `062`.

**Correction** — Clé omise ou `{}` ; 21 tests unitaires sur la forme du payload.

### KLT-0604 · Les lignes sans email étaient réinsérées à chaque import
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-06.05 · **Réf.** : `83d039c`

**Correction** — Rapprochement par téléphone normalisé (`clean_phone`) pour ces lignes.

### KLT-0605 · Import de 5 000 lignes : 6 000 allers-retours séquentiels
**Type** : Performance · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-06.05 · **Réf.** : `83d039c`

**Correction** — Écritures par lots de 500 (`_insert_contacts`, `_bulk_update_contacts`) ; lot refusé repris ligne par ligne. Deux pièges traités : colonnes uniformes sur tout le lot (sinon NULL implicite), lignes indexées par id (Postgres refuse un `ON CONFLICT` touchant deux fois la même ligne).

### KLT-0606 · Un appel Auth par membre à chaque réservation publique
**Type** : Performance · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-06.08 · **Réf.** : `83d039c`

**Problème** — `_get_team_emails` (garde « pas de lead avec l'email d'un membre ») appelait l'API Auth une fois par membre, sur chaque réservation et chaque formulaire.

**Correction** — Une requête `app_user`, l'API Auth en repli ciblé pour les membres absents de la table.

### KLT-0607 · Supprimer un champ laissait ses données dans l'export RGPD
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-06.04 · **Réf.** : `83d039c`

**Problème** — Seule la définition était supprimée : les valeurs restaient dans `contact.custom_fields`, invisibles mais exportées (`gdpr.py`, `select("*")`), et irrécupérables (nouvelle clé aléatoire à la recréation).

**Correction** — 409 + purge explicite, `usage`, `reattach`, purge des orphelins.

### KLT-0608 · Les notes internes avaient disparu de la fiche
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-06.02 · **Réf.** : `83d039c`

**Cause** — La migration `038` (timeline) avait retiré le champ de l'interface ; `contact.notes` restait importable et exportable, `saveNotes()` était du code mort.

**Correction** — Champ réaffiché dans la colonne droite, sans migration.

### KLT-0609 · Les erreurs 409 structurées arrivaient sans leur contenu
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-06.04 · **Réf.** : `83d039c`

**Correction** — `apiFetch` expose `err.status` et `err.detail` même quand `detail` n'est pas une chaîne.

### KLT-0610 · Import en erreur sur les lignes à un seul identifiant
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-06.05 · **Réf.** : `6373abd`, migration `067`

**Cause** — Contraintes `NOT NULL` sur `first_name` / `last_name` présentes en base mais déclarées dans aucune migration.

**Correction** — Colonnes rendues nullables par migration.

### KLT-0611 · Contournement du quota par imports simultanés
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-06.05 · **Réf.** : `5571b58`, migration `078`

**Problème** — TOCTOU : deux imports lancés ensemble vérifiaient tous deux le quota avant d'écrire.

**Correction** — Un seul import en vol par tenant, contrôlé dans le code **et** par un index unique partiel.

### KLT-0612 · Taille d'import non bornée
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-06.05 · **Réf.** : `5571b58`

**Correction** — 20 Mo et 50 000 lignes maximum.

### KLT-0613 · Une pièce jointe HTML/SVG pouvait s'exécuter
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-06.02 · **Réf.** : `5571b58`

**Correction** — Stockage forcé en `application/octet-stream`, quel que soit le type déclaré : l'URL signée ouverte directement télécharge le fichier au lieu de l'afficher.

### KLT-0614 · Erreurs 500 au lieu de 404 sur les ressources absentes
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-06.02 · **Réf.** : `834bfeb` (2026-09-25)

**Cause** — `maybe_single().execute()` renvoie `None` sans correspondance ; `.data` était lu directement.

**Correction** — Garde sur `None` dans contacts, attachments, gdpr et l'API blog. Voir KLT-1924 pour l'audit des `.single()` restants.

### KLT-0615 · Obtenir l'URL signée de la photo d'un autre tenant
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-06.02 · **Réf.** : `5571b58`

**Problème** — La clé réservée `photo_path` pouvait être écrite dans `custom_fields` (PATCH contact ou `reattach`) avec le chemin d'un autre tenant ; `GET /contacts/{id}` signait alors cette URL.

**Correction** — Clé retirée / validée à l'écriture.

### KLT-0616 · Zéros de tête perdus dans les numéros de téléphone
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-06.02 · **Réf.** : `834bfeb`

**Correction** — Téléphone = chiffres avec `+` initial optionnel, filtré en saisie (frontend) et validé (Pydantic). Jamais stocké comme entier.

### KLT-0617 · Exports anglais (LinkedIn « First Name ») non reconnus
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-06.05 · **Réf.** : `6373abd`

**Correction** — Correspondance des en-têtes insensible aux accents, espaces et underscores.

### KLT-0618 · Limites de contacts du plan purement décoratives
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-06.11 · **Réf.** : `6373abd` (2026-10-02), migration `070`

**Correction** — Grâce à 150 %, avertissement 3 mois, badge admin, restriction manuelle.

### KLT-0619 · Anciennes demandes absentes de la liste des leads
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-06.08 · **Réf.** : migration `016_backfill_leads.sql`

**Correction** — Rattrapage des leads pour les RDV et messages antérieurs au module.

### KLT-0620 · Vocabulaire sectoriel uniquement en français
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-06.01 · **Réf.** : `20cceff` (2026-06-14)

**Correction** — `getSectorVocab(sector, lang)` en fr/en/de/nl pour 8 secteurs, réactif au changement de langue.

### KLT-0630 · Prévenir la perte des zéros de tête dans les fichiers préparés sous Excel
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-06.05 · **Réf.** : non commité (2026-11-03) · `docs/recette/README.md` (avertissement « Importer les .csv tels quels »)

**Réalisation** — `phone.restore_leading_zero()` (FR : 9 chiffres ; BE : 8 chiffres, ou 9 commençant par 4), appliqué à tous les champs téléphone à l'import, signalé dans le rapport. Colonnes téléphone au format Texte dans les exports et le modèle `.xlsx`. 3 tests unitaires.

**Constat** — Un fichier ouvert puis enregistré dans Excel transforme `06 12 00 00 02` en `612000002`. La recette le signale pour les testeurs, mais les clients réels sont exposés de la même façon et l'import accepte ces numéros sans broncher.

**Proposition**
1. À l'import, détecter les numéros à 9 chiffres sans `0` ni `+` quand le pays du tenant est FR ou BE, et les signaler dans le rapport (« 42 numéros semblent avoir perdu leur 0 initial »).
2. Proposer de les corriger automatiquement (ajout du `0`), au choix de l'utilisateur.
3. Ajouter l'avertissement dans la boîte de dialogue d'import et formater la colonne téléphone en texte dans le modèle `.xlsx`.

**Critères de validation** — Un fichier contenant `612000002` (tenant FR) produit un avertissement et, si accepté, stocke `0612000002`.

**Estimation** — S

### KLT-0631 · Calcul de l'usage des champs par agrégation SQL
**Type** : Performance · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-06.04 · **Réf.** : non commité (2026-11-03) · `contact_fields.py` (`GET /contact-fields/usage`)

**Réalisation** — Fonction SQL `contact_custom_field_usage` (migration `084`), repli sur l'ancien calcul si absente. Corrige au passage les décomptes faux au-delà de 1 000 contacts (KLT-0632).

**Constat** — L'endpoint parcourt tous les contacts du tenant en Python. Acceptable aujourd'hui (écran de configuration seulement), lent au-delà de quelques milliers de contacts.

**Proposition** — Fonction SQL agrégeant `jsonb_object_keys(custom_fields)` par tenant, appelée en RPC.

**Critères de validation** — Même résultat que l'implémentation actuelle ; réponse < 500 ms sur 10 000 contacts.

**Estimation** — S

### KLT-0632 · Décomptes d'usage des champs faux au-delà de 1 000 contacts
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-06.04 · **Réf.** : non commité (2026-11-03)

**Problème** — `field_usage()` lisait les contacts sans pagination ; PostgREST plafonnant une réponse à 1 000 lignes, les décomptes étaient tronqués, y compris le 409 qui protège la suppression d'un champ : un champ rempli seulement au-delà du 1 000e contact pouvait être supprimé sans avertissement.

**Correction** — Calcul en SQL (KLT-0631, migration `084`).
