# EP-08 · Agents IA

**Objectif** : faire travailler l'IA pour le pro : répondre aux visiteurs du site, prendre des RDV et qualifier des demandes sur WhatsApp / Telegram, et lui servir d'assistant personnel.

**Trois agents** (`agent_config.agent_type`) :
| Agent | Canal | Rôle | Plan |
|---|---|---|---|
| `vitrine` | Bulle du site / widget | Répond aux questions des visiteurs | Gratuit pour tous |
| `support_client` (« Agent 2 ») | WhatsApp, Telegram | Prend des RDV, devis, pré-diagnostic photo, suivi post-RDV | Gated |
| `assistant_tenant` (« Agent 3 ») | Telegram du pro | Résumés, #brief, contexte business | Gated |

**Périmètre code** : `backend/app/api/v1/chatbot.py`, `agents.py`, `assistant.py`, `webhook.py`, `backend/app/services/llm.py`, `embeddings.py`, `ocr.py`, `telegram.py`, `whatsapp.py`, `frontend/app/dashboard/agents/page.tsx`, `frontend/components/ChatbotWidget.tsx`, migrations `002_agents_schema`, `010`→`012`, `049`→`053`

**Personas** : Visiteur, Client final, Pro

---

## User stories

### US-08.01 · Répondre automatiquement aux visiteurs du site
**Statut** : ✅ Livré · **Persona** : Visiteur, Pro

> En tant que **visiteur**, je veux poser mes questions à un assistant sur le site afin d'avoir une réponse immédiate, même le soir.

**Critères d'acceptation**
- `POST /chatbot/{slug}` (Gemini), contexte = contenu du site et prestations.
- Limitation de débit avec message traduit.
- Répond dans la langue demandée (`ChatRequest.lang`), y compris avec un prompt personnalisé rédigé en français.
- Sur une intégration externe : exige titre, description, ≥ 1 prestation et un moyen de contact, sinon la bulle n'apparaît pas (EP-13).
- Événements `chatbot_open` / `chatbot_message` pour les analytics.

**Tickets** : KLT-0806, KLT-0807

### US-08.02 · Prendre des RDV par WhatsApp et Telegram
**Statut** : ✅ Livré · **Persona** : Client final, Pro

> En tant que **client**, je veux réserver en conversant sur WhatsApp ou Telegram afin de ne pas remplir de formulaire.

**Critères d'acceptation**
- Webhooks `POST /webhook/telegram/{bot_token}` et WhatsApp (360dialog), signatures vérifiées.
- Proposition de créneaux réels, création du RDV `pending`, acompte via lien PayPal si configuré (EP-05).
- Résumé IA de la conversation enregistré sur le RDV (`conversation_summary`).
- `telegram_bot_token` synchronisé entre `support_client` et `assistant_tenant`.

**Tickets** : KLT-0801, KLT-0802, KLT-0803, KLT-0804, KLT-0821

### US-08.03 · Qualifier une demande de devis en conversation
**Statut** : ✅ Livré · **Persona** : Client final (artisans)

> En tant que **client d'un artisan**, je veux décrire mon besoin pas à pas, photo à l'appui, afin d'obtenir un devis pertinent.

**Critères d'acceptation**
- Flux devis : une question à la fois.
- Pré-diagnostic photo par Gemini Vision (activable).
- Mode diagnostic guidé : questions structurées avant toute solution.

### US-08.04 · Nourrir l'agent avec mes documents (RAG)
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux téléverser mes documents (tarifs, FAQ, protocoles) afin que l'agent réponde avec mes informations exactes.

**Critères d'acceptation**
- PDF / TXT indexés via Gemini `text-embedding-004` + pgvector (endpoints `/agents/rag/*`).
- Onglet Documents dans `Agent2Panel`.

### US-08.05 · Suivre mes clients après le RDV
**Statut** : ✅ Livré · **Persona** : Pro, Client final

> En tant que **pro**, je veux qu'un message de suivi parte automatiquement après chaque RDV confirmé afin de fidéliser sans y penser.

**Critères d'acceptation**
- Message et délai configurables (migration `053`) ; envoi manuel depuis `ApptModal` (`/agents/followup/{appt_id}`).

### US-08.06 · Avoir un assistant personnel sur Telegram
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux interroger un assistant qui connaît mon activité afin d'avoir un point rapide entre deux rendez-vous.

**Critères d'acceptation**
- Contexte : plan, prestations, statistiques contacts, analytics 7 jours.
- Commande `#brief` : résumé des conversations actives des dernières 24 h.

### US-08.07 · Extraire les informations d'un document (OCR)
**Statut** : ✅ Livré · **Persona** : Pro (santé)

> En tant qu'**infirmière**, je veux envoyer la photo d'une ordonnance afin que ses informations soient résumées sur la fiche du patient.

**Critères d'acceptation**
- Upload ou envoi Telegram → résumé (`ocr_summary`), type de document deviné, lien au contact / RDV.
- **Les résumés, données de santé (art. 9 RGPD), sont chiffrés au repos** — non respecté aujourd'hui (KLT-0820).

**Tickets** : KLT-0820

### US-08.08 · Configurer mes agents
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux régler chaque agent depuis une page claire, y compris sur mobile, afin de les adapter à mon activité.

**Critères d'acceptation**
- `GET/PATCH /agents/config/{type}`, `POST /agents/telegram/setup`.
- Mobile : vue liste / vue panneau, ouverture directe sur le chat de l'assistant ; desktop : deux colonnes.
- Agents gated masqués ou proposés à l'upgrade (`AGENT_FEATURE`, sauf `vitrine`).

**Tickets** : KLT-0805

---

## Tickets

### KLT-0801 · Webhook Telegram acceptant les appels sans jeton secret
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-08.02 · **Réf.** : `5571b58` (2026-10-11)

**Problème** — Un appel sans header `X-Telegram-Bot-Api-Secret-Token` était toléré : contournement complet de la vérification. N'importe qui connaissant l'URL pouvait injecter de faux messages et faire créer des RDV.

**Correction** — Header obligatoire.

### KLT-0802 · Signature WhatsApp acceptée si le secret n'est pas configuré
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-08.02 · **Réf.** : `5571b58`

**Correction** — Échec fermé quand `DIALOG360_WEBHOOK_SECRET` est absent.

### KLT-0803 · Résumé IA des réservations Telegram perdu silencieusement
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-08.02 · **Réf.** : `7efba30`, migration `074`

**Cause** — `appointment.conversation_summary` déclarée depuis la migration `014` mais absente de la base ; `webhook.py` l'écrivait dans un `except` nu qui avalait l'erreur.

**Correction** — Colonne créée par la migration de réconciliation. Illustre KLT-1924 (exceptions avalées).

### KLT-0804 · Bot Telegram ne répondant pas
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-08.02 · **Réf.** : `1c2d362`, `4de97ab` (2026-05-04)

**Correction** — Enregistrement du webhook et traitement des messages corrigés. Prérequis local : `APP_URL` en HTTPS public (ngrok).

### KLT-0805 · Page Agents IA inutilisable sur mobile
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-08.08 · **Réf.** : `951d5cc` (2026-05-11)

**Correction** — Deux vues alternées (liste / panneau) et bouton « ← Agents IA ».

### KLT-0806 · Le chatbot répondait en français à un visiteur étranger
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-08.01 · **Réf.** : `e625116` (2026-10-31)

**Cause** — Un prompt personnalisé rédigé en français imposait sa langue.

**Correction** — Langue demandée prioritaire sur `site.default_language` + consigne « réponds dans la langue du visiteur ».

### KLT-0807 · Chatbot indisponible tant que le site Klientys n'est pas publié
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-08.01 · **Réf.** : `e625116`

**Problème** — Un pro qui n'utilise que les widgets sur son propre site n'avait pas de chatbot.

**Correction** — Indépendant de la publication ; contrôle de complétude (`chatbot-readiness`) à la place.

### KLT-0820 · Résumés OCR (données de santé) stockés en clair
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-08.07 · **Réf.** : non commité (2026-11-03) · `backend/app/api/v1/agents.py:297-303`, `webhook.py:1184`, `webhook.py:1839`, migration `002_agents_schema.sql:62`

**Réalisation** — Chiffrement Fernet via `core/crypto.py` sur les trois chemins d'écriture ; les résumés sont supprimés à l'anonymisation RGPD du contact. Lignes existantes : `scripts/encrypt_existing_secrets.py --apply`.

**Constat** — La migration `002` annonce « Données de santé Article 9 RGPD → `summary_encrypted` via pgcrypto ». En réalité les trois chemins d'écriture insèrent le texte **en clair** dans `summary_encrypted` ; le commentaire de `agents.py` suppose un chiffrement côté SQL qui n'existe pas. Le nom de la colonne laisse croire à une protection absente — y compris dans un audit ou une réponse à un client B2B.

**Risque** — Résumés d'ordonnances lisibles par toute personne ayant accès à la base (service role, dump, sauvegarde). Incompatible avec les engagements du DPA pour les tenants santé.

**Proposition**
1. Chiffrement applicatif (Fernet / AES-GCM) avec une clé hors base (`OCR_ENCRYPTION_KEY`), dans un helper unique utilisé par les trois chemins.
2. Déchiffrement à la lecture uniquement.
3. Migration des lignes existantes (script ponctuel).
4. Vérifier que l'anonymisation RGPD et l'export couvrent ces lignes.
5. À traiter avec KLT-1820 (même helper pour les autres secrets).

**Critères de validation** — `select summary_encrypted from ocr_summary` ne renvoie que du chiffré ; l'interface affiche toujours les résumés.

**Estimation** — M

### KLT-0821 · Jeton du bot Telegram exposé dans l'URL du webhook
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-08.02 · **Réf.** : non commité (2026-11-03) · `webhook.py:107` (`@router.post("/telegram/{bot_token}")`)

**Réalisation** — Route `/webhook/telegram/w/{telegram_webhook_id}` (migration `081`), recherche du bot par empreinte ; ancienne route conservée. `scripts/resync_telegram_webhooks.py` bascule les bots existants.

**Constat** — Le jeton du bot du tenant fait partie du chemin : il apparaît dans les logs d'accès (uvicorn, Railway, proxy). Quiconque lit ces logs peut prendre le contrôle du bot (envoyer des messages aux clients au nom du pro). La vérification du secret (KLT-0801) protège le webhook, pas le bot.

**Proposition**
1. Nouvelle route `/webhook/telegram/{webhook_id}` avec un identifiant aléatoire stocké dans `agent_config`.
2. Réenregistrer les webhooks existants (`setWebhook`) au déploiement ; garder l'ancienne route le temps de la migration, puis la retirer.

**Critères de validation** — Aucun jeton de bot dans les logs d'accès après un échange Telegram.

**Estimation** — S

### KLT-0822 · Suivre la consommation IA par tenant
**Type** : Amélioration · **Statut** : ✅ Terminé · **Priorité** : P3 · **US** : US-08.01, US-08.02 · **Réf.** : non commité (2026-11-03) · `services/llm.py`

**Réalisation** — Table `ai_usage_daily` + RPC `record_ai_usage` (migration `085`), contexte posé par `llm.set_ai_context()` aux points d'entrée, carte « IA — 30 derniers jours » dans la fiche tenant admin. Pas encore de seuil d'alerte.

**Constat** — Le chatbot vitrine est gratuit pour tous les plans et les appels Gemini ne sont rattachés à aucun compteur par tenant. Le coût d'un tenant très actif (ou d'un abus contournant la limitation par IP) est invisible.

**Proposition** — Journaliser par tenant et par jour le nombre d'appels et de tokens ; l'afficher dans la fiche tenant admin ; seuil d'alerte opérateur.

**Critères de validation** — La fiche tenant admin affiche la consommation des 30 derniers jours.

**Estimation** — M

### KLT-0823 · Notification Telegram du pro jamais envoyée pour une réservation Telegram
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-08.02 · **Réf.** : non commité (2026-11-03), `webhook.py` (`_do_notify_pending`)

**Problème** — `send_message` n'était pas importé dans la fonction : chaque notification levait `NameError`, avalée par un `except` qui ne laissait qu'un avertissement dans les logs. Le pro n'était jamais prévenu sur Telegram d'une réservation faite via son bot.

**Correction** — Import ajouté. Trouvé par pyflakes, désormais exécuté en CI (KLT-1920).
