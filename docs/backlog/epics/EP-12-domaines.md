# EP-12 · Domaines personnalisés

**Objectif** : permettre au pro de publier son site sur son propre nom de domaine, en connectant un domaine existant ou en l'achetant directement depuis Klientys.

**Périmètre code** : `backend/app/api/v1/domains.py`, `backend/app/services/vercel_domains.py`, `ovh_domains.py`, `frontend/proxy.ts` (routage), Paramètres → Domaine, migrations `021`, `022`

**Personas** : Pro (owner/admin), Visiteur

> **Ne fonctionne pas en local** : `add_domain` exige `VERCEL_API_TOKEN` / `VERCEL_PROJECT_ID`, et le vrai token ajoute le domaine au projet Vercel de production.

---

## User stories

### US-12.01 · Connecter un domaine que je possède déjà
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux connecter mon domaine et savoir exactement quoi configurer chez mon registraire afin que mon site s'affiche à mon adresse.

**Critères d'acceptation**
- `POST /domains/connect` ajoute le domaine au projet Vercel et renvoie les instructions DNS.
- Sous-domaine → CNAME `cname.vercel-dns.com` ; domaine racine → enregistrement A (IP recommandée par Vercel, repli `216.198.79.1`).
- Domaine portant une intégration active → 409 `integration_conflict`, confirmation requise (EP-13).
- Feature `custom_domain` (addon, EP-10).

**Tickets** : KLT-1201, KLT-1202

### US-12.02 · Suivre la vérification DNS
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux voir si mon domaine est actif afin de savoir quand mon site est en ligne à son adresse.

**Critères d'acceptation**
- `GET /domains/status` : `pending | active | error` (`vercel_status`, `dns_record_*`).
- Au passage en `active`, les intégrations du même domaine sont désactivées (`disabled_reason = "custom_domain"`).

### US-12.03 · Acheter un domaine sans quitter Klientys
**Statut** : ✅ Livré · **Persona** : Owner, Admin

> En tant que **pro non technicien**, je veux chercher et acheter un domaine directement afin d'éviter la configuration DNS.

**Critères d'acceptation**
- `GET /domains/search` (OVH), `POST /domains/purchase` (owner/admin) via Stripe.
- Enregistrement OVH déclenché seulement après encaissement réel ; DNS configurés automatiquement.
- `auto_renew` activé par défaut.
- Échec OVH après paiement → remboursement Stripe + `payment_incident` + alerte opérateur.

**Tickets** : KLT-1007, KLT-1203

### US-12.04 · Déconnecter mon domaine
**Statut** : ✅ Livré · **Persona** : Pro, Opérateur

> En tant que **pro**, je veux retirer mon domaine afin de revenir à l'adresse Klientys.

**Critères d'acceptation**
- `DELETE /domains/my` ; côté support : `POST /admin/tenants/{id}/reset-domain`.

### US-12.05 · Afficher le bon site sur un domaine personnalisé
**Statut** : ✅ Livré · **Persona** : Visiteur

> En tant que **visiteur**, je veux arriver sur le site du pro quand je tape son adresse afin de le trouver directement.

**Critères d'acceptation**
- `proxy.ts` : hostname hors domaines principaux → `GET /domains/resolve?domain=` → réécriture vers `/{slug}`.
- Limitation de débit par domaine (appel serveur à serveur).

**Tickets** : KLT-1204

---

## Tickets

### KLT-1201 · CNAME sur la racine refusé par les registraires
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-12.01 · **Réf.** : `e625116` (2026-10-31)

**Problème** — `connect_domain` renvoyait un CNAME sur `@` pour tous les domaines ; la plupart des registraires le refusent, le pro restait bloqué.

**Correction** — Enregistrement A pour une racine, IP lue via `v6/domains/{d}/config`.

### KLT-1202 · Domaine personnalisé non fonctionnel
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-12.01 · **Réf.** : `6339605`, `3ee9575` (2026-05-18)

**Correction** — Première intégration Vercel et corrections du routage.

### KLT-1203 · Échec OVH après paiement : client débité sans domaine
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-12.03 · **Réf.** : `7efba30` (2026-10-04)

**Problème** — L'échec était journalisé et le webhook répondait 200 : argent encaissé, rien livré, personne prévenu.

**Correction** — `stripe.Refund`, `payment_incident`, `send_payment_incident_admin()`.

### KLT-1204 · Résolution de domaine sans limitation de débit
**Type** : Sécurité · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-12.05 · **Réf.** : `5571b58` (2026-10-11)

**Correction** — Limite par domaine (et non par IP : l'appelant est toujours le serveur Next.js).

### KLT-1220 · Empêcher qu'un environnement local modifie le projet Vercel de production
**Type** : Qualité · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-12.01 · **Réf.** : non commité (2026-11-03) · CLAUDE.md (« connecter un domaine depuis sa machine l'ajoute au projet Vercel de production »)

**Réalisation** — `live_domain_ops_allowed()` (`vercel_domains.py`) : hors `APP_ENV=production`, ajout / retrait / DNS simulés et achat OVH refusé, sauf `ALLOW_LIVE_DOMAINS=true`.

**Constat** — Le seul garde-fou est l'absence du token en local. Avec un `.env` copié de la production, un test local ajoute ou retire des domaines du vrai projet, et peut casser le site d'un client.

**Proposition**
1. Variable `ENVIRONMENT` (`local | staging | production`).
2. Hors production, `vercel_domains` et `ovh_domains` passent en mode simulé (réponses factices réalistes) sauf `ALLOW_LIVE_DOMAINS=1` explicite.
3. Log d'avertissement au démarrage quand des tokens de production sont détectés hors production.

**Critères de validation** — En local avec le token de production, `POST /domains/connect` ne crée rien chez Vercel et renvoie des instructions simulées.

**Estimation** — S
