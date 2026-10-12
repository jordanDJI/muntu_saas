# DPA des sous-traitants — suivi

Objectif : disposer, pour chaque prestataire, d'une copie datée du contrat de
sous-traitance en vigueur. En cas de contrôle CNIL ou d'audit client, c'est ce
dossier qui prouve que la chaîne de sous-traitance est encadrée (art. 28.4 RGPD).

**Où ranger** : un PDF par prestataire dans ce dossier, nommé
`<prestataire>-dpa-<AAAA-MM-JJ>.pdf`.

> La plupart de ces DPA s'appliquent **automatiquement** dès l'acceptation des
> conditions générales : il n'y a rien à signer, seulement à télécharger et à
> dater. Deux exceptions demandent une action positive, signalées ci-dessous.

| Prestataire | Où le trouver | Action | Obtenu le | Version |
|---|---|---|---|---|
| Supabase | `supabase.com/legal/dpa` — pour les plans payants, signature électronique depuis Dashboard → Organization → Legal / Compliance | Télécharger, signer si proposé | | |
| Vercel | `vercel.com/legal/dpa` | Télécharger | | |
| Resend | `resend.com/legal/dpa` — sinon demander à leur support | Télécharger ou demander | | |
| Stripe | `stripe.com/legal/dpa` — intégré au Stripe Services Agreement | Télécharger | | |
| Google Analytics | Admin GA4 → Paramètres du compte → **Conditions de traitement des données** | **Accepter et renseigner tes coordonnées** — non actif par défaut | | |
| Google / Gemini | Conditions de l'API utilisée (AI Studio ou Google Cloud) → Data Processing Addendum | Accepter si proposé | | |
| OVHcloud | `ovhcloud.com/fr/terms-and-conditions/` → accord de traitement des données | Télécharger | | |
| Telegram | **Aucun DPA entreprise disponible** | Voir note ci-dessous | — | — |

## Ce qu'il faut noter pour chacun

Au-delà du PDF, trois informations à reporter dans le registre des traitements :

1. **La date et la version** récupérées — un DPA sans date ne prouve rien.
2. **L'URL de leur propre liste de sous-traitants**, car ils en ont tous une, et
   c'est elle qui alimente ta propre page `/legal/sous-traitants`.
3. **Le mécanisme de transfert hors UE** retenu : clauses contractuelles types,
   et le cas échéant le module applicable (sous-traitant vers sous-traitant).

## Les deux cas qui demandent une action

**Google Analytics.** Les conditions de traitement des données ne sont pas
acceptées par défaut : il faut entrer dans l'administration GA4, les accepter et
renseigner un contact. Sans cela, l'usage de GA par tes clients repose sur rien.
C'est l'oubli le plus fréquent.

**Telegram.** Aucun contrat de sous-traitance n'est proposé aux entreprises, et
les serveurs sont hors Union européenne. La fonction n'est pas activée par
défaut et suppose que le client connecte lui-même son bot — c'est ce que dit
déjà le DPA. Trois options, à trancher :

- maintenir la fonction en la documentant clairement comme activée par le client,
  sous sa responsabilité, avec un avertissement affiché au moment de la connexion ;
- la restreindre aux secteurs sans données sensibles ;
- la retirer.

Tant que le choix n'est pas fait, c'est le maillon faible de la chaîne.

## Quand recommencer

Ces documents évoluent. À revoir **une fois par an**, et à chaque fois qu'un
prestataire annonce une modification de ses conditions ou de sa liste de
sous-traitants.
