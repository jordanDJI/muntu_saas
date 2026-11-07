# EP-05 · Acompte PayPal à la réservation

**Objectif** : réduire les rendez-vous non honorés en permettant au pro d'exiger un acompte, encaissé directement sur son propre compte PayPal, sans que Klientys ne touche l'argent.

**Périmètre code** : `backend/app/services/paypal.py`, `backend/app/services/deposits.py`, `backend/app/api/v1/booking.py` (`paypal-order`, `paypal-capture`, `paypal-return`, `paypal/webhook`), `appointments.py` (`refund-deposit`), `scheduler.py` (`cancel_abandoned_deposit_bookings`), `frontend/app/paypal-return/`, `FormPanel` (onglet Paiement), migrations `047`, `072`

**Personas** : Pro, Client final, Opérateur Klientys

> **Invariants de sécurité** (CLAUDE.md) : le montant ne vient jamais du client ; la capture est vérifiée ; pas de RDV sans acompte quand il est exigé ; le créneau est validé avant encaissement ; aucun argent sans rendez-vous.

---

## User stories

### US-05.01 · Configurer un acompte
**Statut** : ✅ Livré · **Persona** : Pro (owner/admin)

> En tant que **pro**, je veux activer un acompte avec un montant et mes identifiants PayPal afin de sécuriser mes réservations.

**Critères d'acceptation**
- Onglet Paiement du `FormPanel` : activation, montant, devise, `paypal_client_id` (format validé), secret, mode sandbox.
- `paypal_client_secret` stocké dans `site.paypal_client_secret`, jamais dans `site_style` ni dans une réponse publique.
- Réservé à owner/admin (`require_owner_or_admin`).

**Tickets** : KLT-0512, KLT-1820

### US-05.02 · Payer l'acompte en réservant sur le site
**Statut** : ✅ Livré · **Persona** : Client final

> En tant que **client**, je veux régler l'acompte au moment de réserver afin que mon créneau soit garanti.

**Critères d'acceptation**
- Étape 4 « Paiement » avec les boutons PayPal (SDK chargé dynamiquement).
- `POST /paypal-order` à corps vide : montant et devise lus côté serveur (`get_deposit_config`).
- `POST /paypal-capture` : valide le créneau, capture, compare montant et devise, puis crée le RDV (`deposit_status = paid`).
- Paiement échoué → aucun RDV créé.
- `POST /book` renvoie 402 pour un RDV quand un acompte est exigé.

**Tickets** : KLT-0501, KLT-0502, KLT-0503, KLT-0507, KLT-0508, KLT-0509, KLT-0511

### US-05.03 · Payer l'acompte d'une réservation faite via Telegram
**Statut** : ✅ Livré · **Persona** : Client final

> En tant que **client** qui réserve en conversant avec l'agent, je veux recevoir un lien de paiement afin de finaliser ma réservation.

**Critères d'acceptation**
- RDV créé en `pending_payment`, lien `approve_url` envoyé dans la conversation.
- `GET /booking/{slug}/paypal-return` capture, passe le RDV en `pending`, notifie le pro ; le token est comparé à `deposit_paypal_order_id`.
- Page `/paypal-return` : succès, annulation ou erreur.

**Tickets** : KLT-0506, KLT-0510

### US-05.04 · Rembourser un acompte
**Statut** : ✅ Livré · **Persona** : Pro, Client final

> En tant que **client**, je veux être remboursé si le pro refuse ma demande afin de ne pas payer pour un service non rendu.

**Critères d'acceptation**
- Refus d'une demande en attente → remboursement automatique.
- Annulation d'un RDV confirmé → bouton de remboursement manuel dans `ApptModal` (`POST /appointments/{id}/refund-deposit`, owner/admin).
- Échec → `deposit_status = refund_failed` + `payment_incident` ; le bouton reste disponible.

**Tickets** : KLT-0504

### US-05.05 · Ne pas perdre un paiement si le client ferme l'onglet
**Statut** : ✅ Livré · **Persona** : Client final

> En tant que **client**, je veux que mon paiement approuvé soit pris en compte même si je ferme la page trop tôt afin de ne pas payer sans réservation.

**Critères d'acceptation**
- `POST /booking/paypal/webhook` finalise un acompte approuvé mais non capturé.
- La charge utile n'est qu'un indice : l'état réel est relu par un appel authentifié (chaque tenant ayant sa propre app PayPal, aucune signature globale n'est vérifiable).

### US-05.06 · Libérer les créneaux réservés mais jamais payés
**Statut** : ✅ Livré · **Persona** : Pro, Client final

> En tant que **pro**, je veux qu'une réservation abandonnée au paiement libère le créneau afin qu'un autre client puisse le prendre.

**Critères d'acceptation**
- `pending_payment` de plus de 30 min ignorés au contrôle de disponibilité (`DEPOSIT_PENDING_TTL_MINUTES`).
- Passés en `cancelled` toutes les 15 min par le scheduler.

**Tickets** : KLT-0505

### US-05.07 · Tracer les incidents de paiement
**Statut** : ✅ Livré · **Persona** : Opérateur Klientys

> En tant qu'**opérateur**, je veux être alerté de tout encaissement qui n'a pas abouti à une livraison afin d'intervenir avant le client.

**Critères d'acceptation**
- Table `payment_incident` (kind, provider, reference, amount, refunded, detail).
- Alimentée par : écart de montant, échec d'écriture après capture, échec de remboursement (et côté Stripe : OVH échoué, litige).

**Tickets** : KLT-0502

---

## Tickets

### KLT-0501 · L'acompte pouvait être fixé à 0,01 € par le client
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-05.02 · **Réf.** : `7efba30` (2026-10-04)

**Problème** — Le montant de l'order PayPal venait du corps de la requête : n'importe qui pouvait réserver avec un acompte de 0,01 €.

**Correction** — `POST /paypal-order` prend un corps vide ; `get_deposit_config()` est la seule source du montant, de la devise et du mode sandbox.

**Vérification** — Envoyer `{ "amount": 0.01 }` : ignoré, l'order porte le montant configuré.

### KLT-0502 · Montant capturé non vérifié
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-05.02, US-05.07 · **Réf.** : `7efba30`

**Correction** — `paypal-capture` et `paypal-return` comparent montant et devise capturés à la configuration. Écart → remboursement + `payment_incident`. Toute écriture qui échoue après capture déclenche `_refund_and_record()`.

### KLT-0503 · Réservation sans acompte par appel direct ou widget
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-05.02 · **Réf.** : `0e5935b` (2026-11-01)

**Problème** — L'acompte n'était imposé que par le formulaire du site : un appel direct à `/book`, ou l'ancien widget embarqué, réservait sans payer.

**Correction** — `/book` renvoie 402 pour un `request_type="appointment"` dès qu'un acompte est configuré, **avant toute écriture** (aucun contact ni lead créé).

### KLT-0504 · Aucun remboursement possible
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-05.04 · **Réf.** : `7efba30`

**Problème** — Il n'existait aucune fonction de remboursement : un pro qui refusait une demande gardait l'acompte, et devait rembourser à la main depuis PayPal.

**Correction** — `services/deposits.py` : automatique au refus d'une demande, manuel sur un RDV confirmé annulé, `refund_failed` tracé.

### KLT-0505 · Les créneaux non payés restaient bloqués à vie
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-05.06 · **Réf.** : `7efba30`

**Cause** — Le contrôle anti-double réservation compte tout sauf `cancelled`, y compris les `pending_payment` abandonnés.

**Correction** — TTL de 30 min à la lecture + tâche planifiée toutes les 15 min.

### KLT-0506 · Retour PayPal non vérifié
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-05.03 · **Réf.** : `7efba30`

**Problème** — L'URL de retour est publique ; rien ne liait le token PayPal au RDV visé.

**Correction** — Le token est comparé à `appointment.deposit_paypal_order_id`.

### KLT-0507 · Appels PayPal bloquants dans des handlers async
**Type** : Dette technique · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-05.02 · **Réf.** : `7efba30`

**Correction** — `httpx.AsyncClient` avec cache du token OAuth ; ajout de l'appel de remboursement.

### KLT-0508 · SDK PayPal chargé de façon non fiable
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-05.02 · **Réf.** : `f6606cf` (2026-07-04)

**Correction** — Chargement via `document.createElement("script")` au lieu de `next/script`.

### KLT-0509 · Mode sandbox incohérent entre création et capture
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-05.02 · **Réf.** : `f6606cf`

**Correction** — Le flag sandbox est transmis à `create_order` et `capture_order`.

### KLT-0510 · Page /paypal-return en erreur au build
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-05.03 · **Réf.** : `91a64f9` (2026-07-04)

**Correction** — `useSearchParams` enveloppé dans un `Suspense`.

### KLT-0511 · Un même order PayPal pouvait financer deux RDV
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-05.02 · **Réf.** : migration `072_payment_traceability.sql`

**Correction** — Index unique sur `appointment.deposit_paypal_order_id`. Ajout de `deposit_capture_id` (l'API Refunds s'applique à la capture), `deposit_currency`, `deposit_refund_id`, `deposit_refunded_at`.

### KLT-0512 · Un membre pouvait remplacer les identifiants PayPal
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-05.01 · **Réf.** : `7efba30` — voir KLT-0205

**Problème** — N'importe quel membre pouvait remplacer `paypal_client_id` / `paypal_client_secret` par les siens et détourner les acomptes.

**Correction** — `booking-config` réservé à owner/admin.

### KLT-0520 · Tests d'intégration sur le sandbox PayPal
**Type** : Qualité · **Statut** : 🟡 Partiel · **Priorité** : P1 · **US** : US-05.02, US-05.04, US-05.05 · **Réf.** : non commité (2026-11-03) · `7efba30` (« Not covered »), `backend/tests/test_payments.py`

**Réalisation** — Script guidé `backend/scripts/sandbox_paypal_check.py` (création, approbation, capture, contrôle du montant, remboursement). Reste : l'exécuter avec une app sandbox, puis l'automatiser en CI.

**Constat** — 29 tests couvrent les fonctions pures de la chaîne de paiement, mais aucun test ne joue le flux réel contre le sandbox PayPal : création d'order, approbation, capture, remboursement, webhook.

**Proposition**
1. Compte sandbox dédié (client id/secret en secrets de CI).
2. Script de test : order → approbation (compte acheteur sandbox) → capture → vérification du RDV → remboursement → vérification `refunded`.
3. Cas d'erreur : capture d'un montant différent (simulé) → remboursement + incident.
4. Exécution manuelle avant chaque déploiement touchant `paypal.py`, `deposits.py` ou `booking.py`, puis en CI (KLT-1920).

**Critères de validation** — Le script passe de bout en bout sur sandbox et laisse un état propre.

**Estimation** — M

### KLT-0521 · Valider le paiement PayPal dans l'iframe d'un site client
**Type** : Qualité · **Statut** : 🟡 Partiel · **Priorité** : P1 · **US** : US-05.02 · **Réf.** : non commité (2026-11-03) · CLAUDE.md (« PayPal dans l'iframe du site client : non testé »), EP-13

**Réalisation** — Page hôte de test `frontend/scripts/embed-test.html` (autre origine, widget + iframe). Reste : la campagne de test sur les 4 navigateurs.

**Constat** — Depuis `0e5935b`, les widgets réservation affichent le vrai formulaire, acompte compris. Le parcours PayPal dans une iframe tierce n'a jamais été testé : popups bloquées, cookies tiers, `sandbox` de l'iframe peuvent empêcher le paiement — et un client bloqué abandonne sa réservation.

**Proposition**
1. Page HTML de test hébergée sur un domaine distinct, avec le widget `book`.
2. Tester Chrome, Safari (ITP), Firefox, mobile iOS / Android.
3. Si la popup est bloquée : bascule vers une redirection pleine page (`approve_url`, comme le flux Telegram) avec retour sur `/paypal-return`.

**Critères de validation** — Une réservation avec acompte aboutit dans l'iframe sur les 4 navigateurs cibles.

**Estimation** — M
