# EP-17 · Support client & services additionnels

**Objectif** : que le pro obtienne de l'aide sans quitter son dashboard, et puisse acheter des prestations (design sur mesure, logo) qui complètent l'abonnement.

**Périmètre code** : `backend/app/api/v1/support.py`, `design_requests.py`, `logo_requests.py`, `admin.py` (`/admin/support/*`), Paramètres → Support, `DesignRequestModal`, `frontend/app/admin/support/`, migrations `030`, `032`, `055_support_push`, `056`, `058`

**Personas** : Pro, Agent support, Opérateur

---

## User stories

### US-17.01 · Contacter le support depuis mon dashboard
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux ouvrir un ticket et échanger avec Klientys dans l'application afin d'être aidé sans chercher une adresse email.

**Critères d'acceptation**
- Paramètres → Support : liste des tickets, conversation, réponse.
- Email à l'opérateur à la création ; email + push au tenant à chaque réponse.
- Types : `general`, `design_request`.

**Tickets** : KLT-1701, KLT-1702, KLT-1703

### US-17.02 · Savoir qu'une réponse m'attend
**Statut** : ✅ Livré · **Persona** : Pro, Agent support

> En tant qu'**agent support**, je veux voir en temps réel les tickets qui attendent une réponse afin de répondre vite.

**Critères d'acceptation**
- Admin : badge du nombre de tickets `open` (polling 30 s), liste 20 s, messages 10 s, flash « Nouveau message du tenant ».
- Tenant : badge sur l'onglet Support (ticket `in_progress`), flash « Nouvelle réponse de Klientys » ; compte affiché dans le sélecteur mobile.

**Tickets** : KLT-1720

### US-17.03 · Demander un design sur mesure
**Statut** : ✅ Livré · **Persona** : Pro (Business : 1 site inclus)

> En tant que **pro**, je veux décrire le design que je souhaite afin que l'équipe Klientys refasse mon site.

**Critères d'acceptation**
- `DesignRequestModal` (multilingue) : aspects, description, références, photos, délai → ticket support puis `design_request` liée (`support_ticket_id`).
- Accès depuis la fin du site-builder et Paramètres → Support ; owner/admin uniquement.
- Côté admin : onglet Design de la fiche tenant (5 méthodes, tutoriels pas à pas).

### US-17.04 · Faire créer mon logo
**Statut** : ✅ Livré · **Persona** : Pro (owner/admin)

> En tant que **pro sans logo**, je veux décrire mon activité à un assistant puis commander un logo afin d'avoir une identité professionnelle.

**Critères d'acceptation**
- `POST /logo-requests/chat` : brief conversationnel (IA, multilingue).
- `POST /logo-requests/` puis `/{id}/checkout` (Stripe), owner/admin.
- Suivi `GET /logo-requests/mine` ; traitement côté admin.

**Tickets** : KLT-1602

---

## Tickets

### KLT-1701 · « Failed to fetch » à l'envoi d'une réponse support
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-17.01 · **Réf.** : `5844897` (2026-07-20)

**Cause** — `asyncio.create_task()` dans le handler pouvait interrompre l'envoi de la réponse HTTP.

**Correction** — `BackgroundTasks` (admin et tenant : création et réponse) ; suppression d'un `__import__` fragile.

### KLT-1702 · Exception sur un ticket inexistant
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-17.01 · **Réf.** : `5844897`

**Correction** — `.single()` → `.limit(1)` : 404 au lieu d'une exception supabase-py. Voir KLT-1924.

### KLT-1703 · Messagerie support : corrections diverses
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-17.01 · **Réf.** : `b282195`, `4c2b3ab` (2026-07-20)

**Correction** — Affichage et envoi des messages fiabilisés.

### KLT-1720 · Remplacer le polling du support par du temps réel
**Type** : Performance · **Statut** : 🟡 Partiel · **Priorité** : P3 · **US** : US-17.02 · **Réf.** : non commité (2026-11-03) · `frontend/app/admin/layout.tsx`, `frontend/app/admin/support/`, Paramètres → Support

**Réalisation** — Le polling est suspendu quand l'onglet est masqué (`lib/visibleInterval.ts`), ce qui supprime l'essentiel du coût. Le passage à Supabase Realtime demande des policies RLS de lecture et n'est pas fait.

**Constat** — Chaque onglet admin ou Paramètres ouvert interroge le backend toutes les 10 à 30 s, même sans activité. Le coût croît avec le nombre de tenants connectés et garde le backend Railway éveillé en permanence.

**Proposition** — Supabase Realtime (abonnement sur `support_message` filtré par ticket / tenant, RLS appliquée) ou SSE ; garder un polling lent (2 min) en repli.

**Critères de validation** — Un nouveau message apparaît en moins de 2 s ; aucune requête périodique rapide quand rien ne se passe.

**Estimation** — M
