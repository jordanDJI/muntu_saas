# EP-04 · Agenda & réservation en ligne

**Objectif** : remplacer les plateformes de réservation payantes : le pro gère ses disponibilités, ses clients réservent en ligne, et chaque RDV suit un cycle clair (en attente → confirmé / refusé / annulé).

**Périmètre code** : `backend/app/api/v1/booking.py`, `appointments.py`, `calendar.py`, `frontend/app/dashboard/appointments/page.tsx` (`AvailabilityPanel`, `BlockPanel`, `ApptModal`, `BlockedOverrideModal`, `FormPanel`), `frontend/app/[tenant]/contact-form.tsx`, migrations `005`, `006`, `014`, `041`, `043`, `047`

**Personas** : Pro, Client final

> **Invariant** : tous les RDV sont stockés en ISO local naïf (`YYYY-MM-DDTHH:MM:SS`) dans le fuseau du tenant. Voir CLAUDE.md, « Architecture fuseaux horaires ».

---

## User stories

### US-04.01 · Définir mes disponibilités
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux définir mes plages horaires par jour, avec des pauses, afin que mes clients ne réservent que quand je travaille.

**Critères d'acceptation**
- Jusqu'à 3 plages par jour (une ligne `availability_slot` par plage).
- À la création du calendrier : 10 créneaux par défaut (9h-12h et 13h-17h, lundi-vendredi).

**Tickets** : KLT-0411

### US-04.02 · Bloquer des périodes (congés, fermeture)
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux bloquer des périodes afin que personne ne réserve pendant mes congés.

**Critères d'acceptation**
- Création, modification (`PATCH /calendar/blocked/{id}`), suppression.
- Les périodes bloquées sont exclues des créneaux publics et refusées à la réservation.

### US-04.03 · Consulter mon agenda
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux voir mes RDV par jour, semaine ou mois afin d'organiser mon activité.

**Critères d'acceptation**
- Vues Jour / Semaine / Mois ; bannière des RDV en attente avec confirmation / refus rapide.
- Statut d'acompte et réponses au formulaire visibles sur chaque RDV.

### US-04.04 · Créer et modifier un RDV depuis l'agenda
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux saisir un RDV pris par téléphone, en cherchant le client ou en le créant, afin de tout centraliser dans mon agenda.

**Critères d'acceptation**
- Clic sur une cellule : `ApptModal` avec recherche de contact ou création d'un nouveau client.
- Clic sur un RDV existant : édition (`PATCH /appointments/{id}`).
- Sur une période bloquée : `BlockedOverrideModal` avertit, puis autorise la création.

### US-04.05 · Réserver un créneau en ligne
**Statut** : ✅ Livré · **Persona** : Client final

> En tant que **client**, je veux choisir un jour puis un créneau libre afin de réserver sans appeler.

**Critères d'acceptation**
- `GET /booking/{slug}/available-days` (calendrier mensuel) puis `GET /booking/{slug}/slots`.
- Le créneau est revalidé à la réservation (`_assert_slot_bookable`) : horaires d'ouverture, périodes bloquées, créneau passé, capacité, taille de groupe.
- Le RDV est créé en `pending`, le pro reçoit un email et une notification push.
- Créneau envoyé en UTC par le navigateur, stocké en heure locale du tenant.

**Tickets** : KLT-0401, KLT-0404, KLT-0406, KLT-0407

### US-04.06 · Réserver pour plusieurs personnes (capacité 1:N)
**Statut** : ✅ Livré · **Persona** : Client final, Pro (restaurant, cours collectifs)

> En tant que **restaurateur**, je veux qu'un créneau accepte plusieurs réservations jusqu'à une capacité donnée afin de gérer des tables ou des cours collectifs.

**Critères d'acceptation**
- `availability_slot.capacity` et `max_party_size` ; `appointment.party_size`.
- Les créneaux complets (`booked_count + party_size > capacity`) sont masqués ; `spots_left` affiché.
- Capacité et taille max lues sur la plage **contenant** le créneau.
- Dépassement : HTTP 400 avec le message « Le nombre de personnes maximum par réservation des {JOUR}… ».

**Tickets** : KLT-0402, KLT-0403, KLT-0405, KLT-0420

### US-04.07 · Poser mes propres questions au formulaire de réservation
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux ajouter des questions (motif, première visite…) afin de préparer le RDV.

**Critères d'acceptation**
- `site_style.booking_questions` : types `text`, `textarea`, `select` (options), `required`.
- Réponses dans `appointment.custom_answers` (limite : 50 clés, 5 000 caractères par valeur).
- Questions affichées à l'étape Coordonnées, sans étape supplémentaire.
- Configuration depuis « 📋 Formulaire » de l'agenda (`FormPanel`, onglet Formulaire).

**Tickets** : KLT-0408, KLT-0409, KLT-0410

### US-04.08 · Confirmer, refuser ou annuler un RDV
**Statut** : ✅ Livré · **Persona** : Pro, Client final

> En tant que **pro**, je veux confirmer ou refuser une demande, et annuler un RDV, afin que mon client soit informé automatiquement.

**Critères d'acceptation**
- `POST /appointments/{id}/confirm` → email de confirmation + push au client.
- `POST /appointments/{id}/cancel` → email d'annulation ; si le RDV était `pending`, l'email propose de réserver un autre créneau.
- Refus d'une demande avec acompte payé → remboursement automatique (EP-05).
- Pipeline restreint pour les leads issus d'un RDV en attente : `new → confirmed / refused`.

### US-04.09 · Rappeler le RDV au client
**Statut** : ✅ Livré · **Persona** : Client final

> En tant que **client**, je veux recevoir un rappel la veille afin de ne pas oublier mon RDV.

**Critères d'acceptation**
- `send_appointment_reminder` envoyé 24 h avant par le scheduler.

---

## Tickets

### KLT-0401 · RDV décalés selon le fuseau horaire
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-04.05 · **Réf.** : `20cceff` (2026-06-14)

**Problème** — Un RDV réservé à 10h apparaissait à 8h dans l'agenda (Belgique, été).

**Cause** — Le navigateur envoie le créneau en UTC avec fuseau ; il était stocké tel quel, alors que l'agenda raisonne en heure locale.

**Correction** — `book_appointment` convertit en heure locale du tenant (`ZoneInfo(tenant.timezone)`, helper `_tenant_tz`) avant stockage. `GET /calendar/appointments` reconvertit à la lecture les anciens RDV encore stockés avec fuseau.

**Vérification** — Réserver 10h00 depuis le site public en heure d'été : l'agenda affiche 10h00.

### KLT-0402 · Créneaux complets proposés au public
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-04.06 · **Réf.** : `20cceff`

**Correction** — Créneaux où `booked_count + party_size > capacity` masqués dans la liste publique.

### KLT-0403 · Contrôle de capacité faussé par les dates naïves
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-04.06 · **Réf.** : `20cceff`

**Cause** — Les timestamps naïfs (locaux) étaient comparés comme s'ils étaient en UTC aux créneaux (UTC) : les RDV existants tombaient sur le mauvais créneau.

**Correction** — Les naïfs sont interprétés en heure locale du tenant puis convertis en UTC avant comparaison (`get_available_slots`, `get_available_days`).

### KLT-0404 · Réservation possible hors horaires, sur une période bloquée ou dans le passé
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-04.05 · **Réf.** : `7efba30` (2026-10-04)

**Problème** — Ni `/book` ni `/paypal-capture` ne vérifiaient horaires d'ouverture, périodes bloquées et date passée : un appel direct réservait n'importe quand.

**Correction** — `_assert_slot_bookable()` partagée par les deux chemins.

### KLT-0405 · Capacité lue sur le maximum de la journée
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-04.06 · **Réf.** : `7efba30`

**Problème** — Avec deux plages de capacités différentes le même jour, la capacité la plus haute s'appliquait aux deux.

**Correction** — Capacité et `max_party_size` lues sur la plage qui contient le créneau.

### KLT-0406 · Heures des rendez-vous incorrectes
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-04.05 · **Réf.** : `ef7dcc2` (2026-05-18)

**Correction** — Première correction de l'affichage des heures, avant la normalisation complète de KLT-0401.

### KLT-0407 · Crash au démarrage : import `BaseModel` manquant dans booking.py
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-04.05 · **Réf.** : `f6606cf` (2026-07-04)

**Correction** — Import ajouté. Voir KLT-1920 : une CI qui importe l'application aurait bloqué ce commit.

### KLT-0408 · `t is not a function` dans le panneau Formulaire
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-04.07 · **Réf.** : `f6606cf`

**Correction** — `t()` remplacé par `t.key` dans `FormPanel`.

### KLT-0409 · Le curseur sautait dans le champ des options d'une question
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-04.07 · **Réf.** : `f6606cf`

**Cause** — Les lignes vides étaient filtrées à chaque frappe, ce qui recalculait la valeur du textarea.

**Correction** — Filtrage uniquement à l'enregistrement.

### KLT-0410 · Taille des réponses au formulaire non bornée
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-04.07 · **Réf.** : `5571b58` (2026-10-11)

**Correction** — `custom_answers` limité à 50 clés et 5 000 caractères par valeur (endpoint public).

### KLT-0411 · Calendrier vide à la création d'un espace
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-04.01 · **Réf.** : `15e7945` (2026-05-27)

**Problème** — Un nouveau pro n'avait aucun créneau : son site n'acceptait aucune réservation tant qu'il n'avait pas trouvé le panneau Disponibilités.

**Correction** — 10 créneaux par défaut à la création du calendrier.

### KLT-0420 · Messages d'erreur de réservation toujours en français
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-04.06 · **Réf.** : non commité (2026-11-03) · `booking.py` (`detail` des `HTTPException`), CLAUDE.md « Langue des widgets »

**Réalisation** — `booking.BookingError` (code + params), gestionnaire dans `main.py`, traductions fr/en/de/nl et `serverErrorMessage()` dans `contact-form-i18n.ts`. `detail` reste en français pour l'agent Telegram.

**Constat** — Le formulaire est traduit en fr/en/de/nl (site et widgets), mais les erreurs renvoyées par le backend (capacité dépassée, créneau indisponible, acompte requis…) restent en français. Un visiteur néerlandophone d'un kiné de Flandre reçoit « Le nombre de personnes maximum… ».

**Proposition**
1. Renvoyer un `code` stable en plus du `detail` (`slot_full`, `party_too_large`, `slot_blocked`, `deposit_required`…), avec les paramètres (`max`, `day`).
2. Traduire côté frontend dans `contact-form-i18n.ts` ; garder `detail` français en repli.

**Critères de validation** — Avec `lang=nl`, une réservation au-delà de la capacité affiche le message en néerlandais.

**Estimation** — M
