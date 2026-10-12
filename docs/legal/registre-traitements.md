# Registre des activités de traitement

**Responsable** : ADUMIS — Jordan Djilla, entrepreneur individuel
14 rue Villa Oddo, 13015 Marseille, France — SIREN 131374936
Contact : support@klientys.co

**Dernière mise à jour** : 12 octobre 2026
**Document interne** — à présenter à la CNIL en cas de contrôle. Ne pas publier.

> Article 30 du RGPD. Deux parties, parce qu'ADUMIS a deux casquettes :
> **responsable de traitement** pour ses propres données (ses clients, son site,
> son support), et **sous-traitant** pour les données que ses clients saisissent
> dans Klientys. Les confondre est l'erreur la plus courante.

---

## Partie 1 — Traitements dont ADUMIS est responsable (art. 30.1)

### 1.1 Gestion des comptes et des abonnements

| | |
|---|---|
| **Finalité** | Créer et gérer les comptes professionnels, facturer l'abonnement, assurer le support |
| **Base légale** | Exécution du contrat (art. 6.1.b) |
| **Personnes concernées** | Clients professionnels et leurs collaborateurs invités |
| **Catégories de données** | Identité, e-mail, téléphone, identifiants de connexion, secteur d'activité, pays, données de facturation, historique d'abonnement |
| **Destinataires** | Supabase (hébergement), Stripe (encaissement), Resend (e-mails) |
| **Transferts hors UE** | Stripe et Resend — clauses contractuelles types |
| **Durée de conservation** | Durée du contrat, puis 3 ans à compter du dernier contact commercial. Pièces comptables : 10 ans |
| **Sécurité** | Chiffrement en transit et au repos, cloisonnement par espace, journalisation des accès, accès de production limités |

### 1.2 Prospection et demandes entrantes

| | |
|---|---|
| **Finalité** | Répondre aux demandes de contact et de démonstration, suivre les prospects |
| **Base légale** | Intérêt légitime (art. 6.1.f) — développement commercial |
| **Personnes concernées** | Prospects professionnels |
| **Catégories de données** | Identité, e-mail, téléphone, entreprise, contenu de la demande |
| **Destinataires** | Supabase, Resend |
| **Transferts hors UE** | Resend — clauses contractuelles types |
| **Durée de conservation** | 3 ans à compter du dernier contact |
| **Sécurité** | Idem 1.1 |

### 1.3 Support et tickets

| | |
|---|---|
| **Finalité** | Traiter les demandes d'assistance et conserver l'historique des échanges |
| **Base légale** | Exécution du contrat (art. 6.1.b) |
| **Personnes concernées** | Clients et leurs collaborateurs |
| **Catégories de données** | Identité, e-mail, contenu des tickets et des réponses, horodatages |
| **Destinataires** | Supabase, Resend |
| **Durée de conservation** | 3 ans après la clôture du ticket |
| **Sécurité** | Idem 1.1 |

### 1.4 Journal d'audit des accès administrateur

| | |
|---|---|
| **Finalité** | Tracer les accès de l'éditeur aux espaces clients, pour la sécurité et la preuve |
| **Base légale** | Obligation légale de sécurité (art. 32) et intérêt légitime |
| **Personnes concernées** | Administrateurs ADUMIS |
| **Catégories de données** | Identifiant et e-mail de l'administrateur, espace ciblé, action, horodatage |
| **Destinataires** | Aucun — usage interne |
| **Durée de conservation** | 1 an |
| **Sécurité** | Table interne, accès par clé de service uniquement, aucune policy publique |

### 1.5 Mesure d'audience du site klientys.co

| | |
|---|---|
| **Finalité** | Mesurer la fréquentation et l'usage du site vitrine de l'éditeur |
| **Base légale** | Consentement (art. 6.1.a) — recueilli par le bandeau cookies |
| **Personnes concernées** | Visiteurs du site |
| **Catégories de données** | Identifiant de session, pages vues, événements d'interaction, adresse IP |
| **Destinataires** | Supabase, Google Analytics si activé |
| **Transferts hors UE** | Google — clauses contractuelles types |
| **Durée de conservation** | 13 mois |
| **Sécurité** | Scripts chargés uniquement après consentement, identifiants de session non nominatifs |

---

## Partie 2 — Traitements effectués pour le compte des clients (art. 30.2)

> ADUMIS agit ici comme **sous-traitant**. Chaque client est responsable de
> traitement pour les données qu'il saisit. Le contrat correspondant est publié
> sur `klientys.co/legal/dpa`.

**Catégories de traitements réalisés pour le compte de chaque client :**

| Traitement | Données traitées | Durée |
|---|---|---|
| Gestion de la relation client (CRM) | Identité, coordonnées, historique des échanges, notes, pièces jointes, champs libres définis par le client | Durée du contrat du client, puis suppression selon l'article 9 du DPA |
| Prise et suivi de rendez-vous | Identité, coordonnées, date et heure, motif éventuel saisi par le client, réponses aux questions du formulaire | Idem |
| Facturation des clients finaux | Identité, adresse, prestations, montants, statuts de règlement | Idem, sous réserve des obligations comptables du client |
| Envoi de messages et campagnes | Adresse e-mail, nom, contenu des messages, statut d'ouverture et de désinscription | Idem |
| Agents conversationnels | Contenu des conversations avec le visiteur ou le client final | Idem — fonction activée par le client |
| Analyse du site vitrine du client | Identifiant de session, pages vues, événements | 13 mois |

**Sous-traitants ultérieurs** : liste publiée et tenue à jour sur
`klientys.co/legal/sous-traitants`, notification 30 jours avant tout changement.

**Transferts hors UE** : encadrés par clauses contractuelles types, détaillés sur
la même page.

**Mesures de sécurité** : voir article 5 du DPA.

---

## Points ouverts

À tenir à jour, et à revoir avec le conseil juridique.

- [ ] **Qualification « données de santé »** pour les clients exerçant une profession de santé. Si retenue, l'article 9 du RGPD s'applique, une analyse d'impact devient obligatoire et la question de l'hébergement certifié HDS se pose. Le DPA exclut aujourd'hui ces données de l'usage prévu ; cette exclusion doit être vérifiée juridiquement et, le cas échéant, assortie d'un contrôle produit.
- [ ] **Analyse d'impact (AIPD)** : à conduire si la qualification ci-dessus est retenue, ou si le volume et la sensibilité des traitements l'imposent.
- [ ] **DPA signés avec les sous-traitants ultérieurs** : récupérer et archiver ceux de Supabase, Vercel, Resend, Stripe, Google, OVH.
- [x] **Politique de sauvegarde** : sauvegarde quotidienne, rétention 7 jours, restauration cible 4 h ouvrées — reportée à l'article 5 du DPA. **Suppose le plan Supabase Pro actif** : sur le plan gratuit il n'existe aucune sauvegarde, et la clause serait fausse.
- [ ] **Restauration à un instant donné (PITR)** : non souscrite. Perte maximale actuelle de 24 h de saisie. À activer si un client exige une tolérance inférieure.
- [ ] **Désignation d'un DPO** : non obligatoire a priori, à réévaluer si le suivi régulier et systématique de personnes à grande échelle se confirme.
