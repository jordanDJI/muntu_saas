# EP-11 · Facturation électronique

**Objectif** : permettre au pro d'émettre ses factures depuis Klientys, conformes aux obligations de son pays, sans logiciel de facturation séparé.

**Périmètre code** : `backend/app/api/v1/invoices.py`, `backend/app/services/invoice_legal.py` (fonctions pures), `invoice_pdf.py` (WeasyPrint A4), `invoice_ubl.py` (UBL 2.1 / EN 16931), `backend/tests/test_invoice_fr.py`, `frontend/app/dashboard/invoices/`, Paramètres → Facturation, migrations `048`, `077`

**Personas** : Pro, Client du pro (destinataire)

---

## User stories

### US-11.01 · Paramétrer ma facturation
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux renseigner une fois mes informations légales et mes conditions afin que chaque facture soit complète.

**Critères d'acceptation**
- `tenant.invoice_settings` : identité, SIREN / n° d'entreprise, adresse, pays, TVA, préfixe, IBAN, conditions de paiement, régime de TVA.
- `GET /invoices/settings/compliance` → `{ country, compliant, missing[] }`, affiché dans les paramètres.

### US-11.02 · Créer une facture
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux créer une facture à la main ou en un clic depuis un RDV confirmé afin de facturer sans ressaisie.

**Critères d'acceptation**
- CRUD brouillon ; bouton « Créer facture » sur un RDV confirmé (`service_date` = `scheduled_at` du RDV, sinon date d'émission).
- Identités émetteur et client figées dans la facture (`tenant_*`, `client_*`).
- Échéance calculée par `compute_due_date()`.
- Numérotation continue par série (`invoice_sequence`, `RETURNING`).

**Tickets** : KLT-1104, KLT-1105, KLT-1107, KLT-0202

### US-11.03 · Émettre une facture conforme (France)
**Statut** : ✅ Livré · **Persona** : Pro (FR)

> En tant que **pro français**, je veux que mes factures portent les mentions obligatoires et le bon motif de TVA afin d'être en règle en cas de contrôle.

**Critères d'acceptation**
- Régimes : `standard`, `franchise` (293 B), `medical` (261-4-1°), `reverse_charge`, `intracom`, `export` ; code EN 16931 et mention vont par paire. Un taux > 0 l'emporte sur le régime déclaré.
- Taux nul sans régime → catégorie `Z` **sans** code VATEX, et signalement.
- `POST /invoices/{id}/send` refuse (400) si `issuer_issues()` trouve un manque (identité, adresse émetteur, date de prestation, motif d'exonération) ; `client_issues()` renvoyé en `warnings`.

**Tickets** : KLT-1101, KLT-1102

### US-11.04 · Envoyer la facture et suivre son paiement
**Statut** : ✅ Livré · **Persona** : Pro, Client du pro

> En tant que **pro**, je veux envoyer la facture par email avec ses fichiers et la marquer payée afin de suivre mes encaissements.

**Critères d'acceptation**
- Email avec PDF + XML UBL en pièces jointes.
- UBL : pays (BT-40 / BT-55), identifiant légal (BT-30, `schemeID` `0002` SIRENE ou `0208` Belgique), adresse complète.
- Onglets par statut, téléchargement, « marquer payée ».

**Tickets** : KLT-1103

### US-11.05 · Corriger une facture envoyée par un avoir
**Statut** : ✅ Livré · **Persona** : Pro

> En tant que **pro**, je veux émettre un avoir sur une facture envoyée afin de la corriger légalement plutôt que de la supprimer.

**Critères d'acceptation**
- `cancel` refusé dès `sent_at` posé.
- `POST /invoices/{id}/credit-note` : série `AV`, lignes en négatif, référence à la facture, identités reprises de la facture corrigée.
- Refusé sur un brouillon, sur un avoir, ou si un avoir existe déjà (index unique partiel sur `credit_note_of`).

**Tickets** : KLT-1106

### US-11.06 · Émettre et transmettre des factures électroniques conformes aux normes françaises
**Statut** : 🟡 Partiel · **Persona** : Pro (FR)

> En tant que **pro**, je veux que mes factures soient au format électronique de la réforme française, puis transmises par le circuit officiel, afin de rester conforme à l'obligation du 1er septembre 2027.

**Critères d'acceptation**
- Factur-X EN 16931 : PDF/A-3 avec le XML CII `factur-x.xml` intégré — **livré** (KLT-1120).
- Transmission via une PDP immatriculée, e-reporting, statuts du cycle de vie — à faire (KLT-1121).
- La facturation suit les normes **françaises uniquement** (décision du 3 novembre 2026, KLT-1122) ; un tenant hors de France en est averti.

**Tickets** : KLT-1120, KLT-1121, KLT-1122

---

## Tickets

### KLT-1101 · Factures d'exonérés déclarées en autoliquidation
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-11.03 · **Réf.** : migration `077`, `invoice_legal.py`

**Problème** — Tout taux à 0 produisait `Z` + `VATEX-EU-AE`, c'est-à-dire une autoliquidation, sur des factures de kinés (exonération médicale) et d'auto-entrepreneurs (franchise en base).

**Correction** — Table `VAT_REGIMES`, `resolve_vat_regime`, repli `Z` sans VATEX quand le motif est inconnu. Testé par `tests/test_invoice_fr.py`.

### KLT-1102 · Aucune mention obligatoire française
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-11.03 · **Réf.** : migration `077`

**Problème** — Le PDF et l'UBL se présentaient comme conformes EN 16931 sans l'être.

**Correction** — Mentions figées à l'émission (`vat_regime`, `legal_mentions`), date de prestation, contrôle bloquant avant envoi pour `FR`.

### KLT-1103 · Pays et identifiant légal absents de l'UBL
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-11.04 · **Réf.** : migration `077`

**Problème** — L'UBL ne portait que `StreetName` : un validateur EN 16931 rejetait le fichier.

**Correction** — Adresse complète, pays, SIREN avec `schemeID`.

### KLT-1104 · Date d'échéance fausse, parfois antérieure à la facture
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-11.02 · **Réf.** : migration `077`

**Cause** — `date(y, m, min(day + days, 28))` gardait le mois d'émission : 30 jours accordés le 20 donnaient 8 jours ; accordés le 25, une échéance antérieure.

**Correction** — `compute_due_date()`.

### KLT-1105 · Numérotation exposée à une course
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P1 · **US** : US-11.02 · **Réf.** : migration `077`

**Correction** — `increment_invoice_sequence_series()` avec `RETURNING` au lieu d'un `SELECT` séparé ; l'ancienne fonction délègue à la série par défaut.

### KLT-1106 · Une facture envoyée pouvait être annulée
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-11.05 · **Réf.** : migration `077`

**Correction** — Annulation interdite après envoi ; avoirs avec série distincte.

### KLT-1107 · Champs notes et conditions absents du type Invoice
**Type** : Bug · **Statut** : ✅ Terminé · **Priorité** : P2 · **US** : US-11.02 · **Réf.** : `b186aa9` (2026-07-03)

**Correction** — `notes` et `payment_terms` ajoutés au type TypeScript et au formulaire.

### KLT-1120 · Générer des factures au format Factur-X
**Type** : Conformité · **Statut** : 🟡 Partiel · **Priorité** : P1 · **US** : US-11.06 · **Réf.** : non commité (2026-11-03) · CLAUDE.md « Ce qui n'est toujours pas couvert »

**Réalisation** — `services/invoice_cii.py` produit le XML CII profil EN 16931 (lignes, ventilation de TVA par catégorie et taux, motifs d'exonération, notes de pénalités typées PMD / PMT / AAB, référence à la facture corrigée pour un avoir, IBAN, échéance, date de prestation). `invoice_pdf.generate_facturx_pdf()` rend le PDF en PDF/A-3b (WeasyPrint) et y intègre le XML via la bibliothèque `factur-x` (XMP compris), après **validation contre le XSD officiel**. Toutes les factures générées (envoi et téléchargement) sont désormais au format Factur-X ; l'UBL reste joint. 7 tests unitaires (`tests/test_invoice_cii.py`). **Reste à vérifier en recette** : la conformité PDF/A-3 du fichier produit en production (veraPDF) et les règles métier EN 16931 (schématron, qui demande un serveur Saxon) — en local sous Windows, le moteur PDF de repli ne produit pas un vrai PDF/A.

**Constat** — Klientys produit un PDF et un UBL séparés. La réforme française accepte trois formats (UBL, CII, Factur-X) ; Factur-X (PDF/A-3 avec XML CII embarqué) est celui que les PME attendent, lisible par un humain et par une machine.

**Proposition**
1. Générer le XML CII (profil EN 16931) à partir des mêmes données que l'UBL.
2. Produire un PDF/A-3 (WeasyPrint `pdf_variant="pdf/a-3b"`) avec le XML en pièce jointe (`factur-x.xml`, relation `Data`).
3. Valider avec un validateur Factur-X avant d'envoyer.

**Critères de validation** — Un fichier produit passe la validation Factur-X EN 16931.

**Estimation** — L

### KLT-1121 · Adossement à une PDP et e-reporting (France, échéance 1er septembre 2027)
**Type** : Conformité · **Statut** : ⬜ À faire · **Priorité** : P1 · **US** : US-11.06 · **Réf.** : CLAUDE.md « Facturation : conformité française »

**Constat** — Au 1er septembre 2027, les TPE/PME doivent émettre leurs factures B2B par une plateforme de dématérialisation partenaire (PDP) immatriculée, et transmettre l'e-reporting (B2C, international). Klientys ne peut pas devenir PDP ; sans adossement, le module facturation devient inutilisable en France à cette date.

**Proposition**
1. Choisir une PDP proposant une API d'émission pour éditeurs (critères : prix par facture, API, statuts, réception).
2. Envoyer les factures via la PDP au lieu de l'email ; recevoir les statuts du cycle de vie (déposée, rejetée, encaissée…) et les afficher.
3. Transmettre l'e-reporting des opérations B2C.
4. Calendrier : choix de la PDP au T1 2027, intégration au T2, recette avant juillet 2027.

**Critères de validation** — Une facture de test transite par la PDP en recette et son statut remonte dans Klientys.

**Estimation** — L

### KLT-1122 · Facture électronique : normes françaises à la place de Peppol (Belgique)
**Type** : Conformité · **Statut** : ✅ Terminé · **Priorité** : P0 · **US** : US-11.06 · **Réf.** : non commité (2026-11-03) · `invoice_cii.py`, `invoice_pdf.py`, `invoices.py` (`/settings/compliance`)

**Décision (3 novembre 2026)** — La facturation électronique de Klientys suit les **normes françaises** (réforme 2026-2027 : Factur-X / CII EN 16931, mentions du CGI). L'envoi structuré sur Peppol imposé en Belgique n'est **pas** implémenté.

**Réalisation**
- Format Factur-X EN 16931 pour toutes les factures (voir KLT-1120).
- Le contrôle de conformité renvoie `checked` : hors de France, l'écran Facturation n'affiche plus « ✓ Mentions légales complètes » (rien n'était vérifié pour ces pays) mais indique que les règles suivies sont françaises et invite à vérifier les obligations locales avec un comptable.

**Conséquence à connaître** — Le pays par défaut des tenants reste `BE`. Un pro belge qui facture une entreprise assujettie via Klientys n'est toujours pas couvert par l'obligation belge (Peppol, en vigueur depuis le 1er janvier 2026), et les mentions françaises (CGI) ne s'appliquent pas à sa facture. Si des tenants belges facturent en B2B, il faudra soit rouvrir ce sujet, soit l'écrire dans les CGU et dans l'écran Facturation.

