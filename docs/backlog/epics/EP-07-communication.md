# EP-07 · Communication : emails, campagnes, notifications

**Objectif** : tenir le pro et ses clients informés automatiquement, et permettre au pro de relancer sa clientèle sans outil d'emailing externe.

**Périmètre code** : `backend/app/services/email.py`, `push.py`, `backend/app/api/v1/campaigns.py`, `push_notifications.py`, `support.py` (notifications in-app), `scheduler.py`, `frontend/public/sw.js`, `frontend/app/dashboard/campaigns/`, `frontend/app/unsubscribe/`, migrations `039`, `044`, `054`, `055_support_push`, `057`

**Personas** : Pro, Client final, Opérateur Klientys

---

## User stories

### US-07.01 · Recevoir les emails transactionnels
**Statut** : ✅ Livré · **Persona** : Pro, Client final

> En tant que **client**, je veux être notifié par email à chaque étape de mon RDV afin de savoir où en est ma demande.

**Critères d'acceptation**
- Pro : nouveau RDV en attente (`send_appointment_pending_tenant`), nouveau lead.
- Client : confirmation, annulation / refus (avec lien de nouvelle réservation si le RDV était en attente), rappel 24 h.
- HTML inline, CTA via la constante `_BTN`, envoi Resend.

**Tickets** : KLT-0720

### US-07.02 · Être accompagné pendant l'essai
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro en essai**, je veux recevoir un email de bienvenue puis des rappels avant la fin de l'essai afin de ne pas perdre mon espace par oubli.

**Critères d'acceptation**
- Email de bienvenue (3 premières étapes), multilingue.
- Rappels J-7, J-3, J-1 avec résumé d'activité ; déduplication par `trial_reminder_log` (migration `044`).

### US-07.03 · Envoyer une campagne à mes clients
**Statut** : ✅ Livré · **Persona** : Pro (feature `campaigns`, Pro+)

> En tant que **pro**, je veux envoyer un email à un segment de clients afin de les informer d'une nouveauté ou de relancer les inactifs.

**Critères d'acceptation**
- Segments : tous, inactifs, par tag ; envoi Telegram en plus si le contact est lié.
- Les contacts désabonnés sont exclus.
- Historique avec envoyés, taux d'ouverture, de clic, désabonnements.
- Pied de mail « répondre » (mailto ou formulaire du site).

### US-07.04 · Mesurer l'impact de mes campagnes
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux savoir qui a ouvert et cliqué afin d'améliorer mes messages.

**Critères d'acceptation**
- Pixel 1 × 1 par destinataire (`/campaigns/track/open`).
- Redirection de clic (`/campaigns/track/click`) limitée à `http` / `https`.

**Tickets** : KLT-0704

### US-07.05 · Permettre à mes clients de se désabonner
**Statut** : ✅ Livré · **Persona** : Client final

> En tant que **client**, je veux me désabonner en un clic afin de ne plus recevoir de campagnes.

**Critères d'acceptation**
- Token par contact, page publique `/unsubscribe`, header `List-Unsubscribe` dans chaque campagne.
- L'URL pointe vers le frontend de production.

**Tickets** : KLT-0701

### US-07.06 · Recevoir des notifications push
**Statut** : ✅ Livré · **Persona** : Pro, Client final

> En tant que **pro**, je veux une notification sur mon téléphone à chaque nouvelle réservation afin de répondre vite.

**Critères d'acceptation**
- Web Push VAPID (`pywebpush`) ; abonnement depuis Paramètres → Notifications, ou bannière 4 s après le premier login (une seule fois).
- Pro : nouvelle réservation, réponse du support. Client : RDV confirmé / annulé.
- Notification persistante jusqu'au tap, vibration, actions Ouvrir / Ignorer.

**Tickets** : KLT-0702, KLT-0703

### US-07.07 · Recevoir les annonces de Klientys dans mon dashboard
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux voir dans mon dashboard les messages qui me concernent (feature offerte, changement) afin de ne pas les manquer dans ma boîte mail.

**Critères d'acceptation**
- Table `tenant_notification` ; `GET /notifications`, `POST /notifications/{id}/read`.
- Bannière refermable par notification non lue.

### US-07.08 · Recevoir un rapport mensuel
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux recevoir chaque mois un rapport de mon activité afin de mesurer ce que m'apporte Klientys.

**Critères d'acceptation**
- Le 1er du mois, email avec le rapport analytics en PDF (voir EP-09), multilingue.

---

## Tickets

### KLT-0701 · Lien de désabonnement pointant vers le mauvais domaine
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-07.05 · **Réf.** : `1a6625a` (2026-07-20)

**Problème** — Le lien pouvait pointer vers `localhost` ou un domaine non public : un client ne pouvait pas se désabonner, ce qui est une obligation légale.

**Correction** — `_unsubscribe_url` utilise `frontend_url_prod` en priorité.

### KLT-0702 · Le bouton d'activation des notifications ne faisait rien
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-07.06 · **Réf.** : `d6c0a9b` (2026-07-20)

**Cause** — Le service worker n'était pas encore enregistré au moment du clic.

**Correction** — Enregistrement à la demande dans le gestionnaire de clic ; hook `usePushSetup()`.

### KLT-0703 · Erreurs push silencieuses (VAPID non configuré)
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-07.06 · **Réf.** : `d6c0a9b`

**Correction** — Un 503 affiche un état d'erreur et un message sous le bouton au lieu de revenir à l'état initial.

### KLT-0704 · Redirection de clic limitée aux URLs web
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-07.04 · **Réf.** : `64ab655` (2026-07-20)

**Contenu** — Le proxy de clic refuse les schémas autres que `http` / `https` (pas de `javascript:` ni `data:`).

### KLT-0720 · Emails aux clients finaux uniquement en français
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-07.01 · **Réf.** : non commité (2026-11-03) · `email.py`, CLAUDE.md « Langue des widgets » (« Non traduit »)

**Réalisation** — Langue enregistrée sur le RDV (`appointment.lang`, migration `083`), envoyée par le formulaire ; 4 emails clients traduits (`_CLIENT_T` dans `email.py`).

**Constat** — Le site, les widgets, le chatbot et les emails au pro sont multilingues ; les emails reçus par le **client final** (confirmation, annulation, rappel) restent en français. Les tenants belges (défaut `BE`) ont une clientèle néerlandophone et germanophone.

**Proposition**
1. Enregistrer la langue du visiteur à la réservation (`appointment.lang`, depuis `data-saas-lang` ou la langue du site).
2. Traduire les 4 modèles client en fr/en/de/nl ; à défaut, `site.default_language`.

**Critères de validation** — Une réservation faite avec `lang=nl` produit une confirmation et un rappel en néerlandais.

**Estimation** — M

### KLT-0721 · Dates des emails clients dépendantes de la locale du serveur
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-07.01 · **Réf.** : non commité (2026-11-03)

**Problème** — `_fmt_dt` utilisait `%A` : dans le conteneur Docker (locale C), un email français affichait « Monday 13/06/2026 à 09:00 ». Une date naïve (déjà en heure locale du tenant, invariant de stockage) était en plus convertie comme si elle était à l'heure du serveur.

**Correction** — `_fmt_dt_lang()` : noms de jours et de mois par langue, date naïve laissée telle quelle, date avec fuseau convertie dans le fuseau du tenant.
