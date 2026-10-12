import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accord de sous-traitance (DPA) | Klientys",
  description:
    "Accord de traitement des données à caractère personnel conclu entre le client, responsable de traitement, et ADUMIS, éditeur de Klientys, sous-traitant au sens de l'article 28 du RGPD.",
  alternates: { canonical: "https://klientys.co/legal/dpa" },
};

const SECTION: React.CSSProperties = { marginBottom: "40px" };

const H2: React.CSSProperties = {
  fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif",
  fontSize: "20px",
  fontWeight: 700,
  color: "var(--l-text)",
  marginBottom: "12px",
  marginTop: "0",
};

const H3: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
  color: "var(--l-text)",
  marginBottom: "8px",
  marginTop: "20px",
};

const P: React.CSSProperties = {
  color: "var(--l-text2)",
  fontSize: "15px",
  lineHeight: "1.75",
  marginBottom: "12px",
  marginTop: "0",
};

const UL: React.CSSProperties = {
  color: "var(--l-text2)",
  fontSize: "15px",
  lineHeight: "1.75",
  marginBottom: "12px",
  paddingLeft: "22px",
};

const NOTE: React.CSSProperties = {
  background: "var(--l-surface-2, rgba(13,75,88,.06))",
  border: "1px solid var(--l-border)",
  borderRadius: "8px",
  padding: "16px 18px",
  marginBottom: "40px",
};

export default function DpaPage() {
  return (
    <main style={{ maxWidth: "760px", margin: "0 auto", padding: "80px 24px 120px" }}>

      <p style={{ fontSize: "11px", color: "var(--l-gold)", fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: "16px" }}>
        Protection des données
      </p>
      <h1 style={{
        fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif",
        fontSize: "clamp(28px, 4vw, 40px)",
        fontWeight: 800,
        color: "var(--l-text)",
        lineHeight: 1.2,
        marginBottom: "12px",
      }}>
        Accord de sous-traitance
      </h1>
      <p style={{ ...P, marginBottom: "40px" }}>
        Article 28 du RGPD — version du 12 octobre 2026.
      </p>

      <div style={NOTE}>
        <p style={{ ...P, marginBottom: 0 }}>
          Cet accord s'applique dès lors que vous utilisez Klientys pour traiter des données
          concernant vos propres clients, patients ou prospects. Vous en êtes le responsable de
          traitement ; nous agissons sur vos instructions. Il complète les conditions générales
          d'utilisation et prévaut sur elles en cas de contradiction portant sur les données
          personnelles.
        </p>
      </div>

      <div style={{ borderTop: "1px solid var(--l-border)", paddingTop: "48px" }}>

        <div style={SECTION}>
          <h2 style={H2}>1. Parties</h2>
          <p style={P}>
            <strong>Le Client</strong>, titulaire du compte Klientys, agissant en qualité de
            responsable de traitement.
          </p>
          <p style={P}>
            <strong>ADUMIS</strong>, Jordan Djilla, entrepreneur individuel, 14 rue Villa Oddo,
            13015 Marseille, France, SIREN 131374936, éditeur de Klientys, agissant en qualité de
            sous-traitant (ci-après «&nbsp;Klientys&nbsp;»).
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>2. Objet, durée et nature du traitement</h2>
          <p style={P}>
            Klientys traite des données à caractère personnel pour le seul compte du Client, aux
            fins de lui fournir la plateforme : gestion de la relation client, prise et suivi de
            rendez-vous, envoi de messages, facturation, site vitrine et fonctions d'analyse.
          </p>
          <p style={P}>
            Le traitement dure aussi longtemps que le contrat d'abonnement, et se poursuit pendant
            la période de restitution et de suppression prévue à l'article 9.
          </p>

          <h3 style={H3}>Catégories de personnes concernées</h3>
          <ul style={UL}>
            <li>Clients, patients et prospects du Client</li>
            <li>Utilisateurs de l'espace professionnel du Client (ses collaborateurs)</li>
            <li>Visiteurs du site vitrine publié par le Client</li>
          </ul>

          <h3 style={H3}>Catégories de données</h3>
          <ul style={UL}>
            <li>Identité et coordonnées : nom, prénom, adresse postale, téléphone, e-mail</li>
            <li>Données de relation : historique des échanges, notes, rendez-vous, pièces jointes</li>
            <li>Données de facturation : prestations, montants, statuts de règlement</li>
            <li>Données de connexion des utilisateurs de l'espace professionnel</li>
            <li>Champs libres créés par le Client, dont il détermine seul le contenu</li>
          </ul>

          <h3 style={H3}>Données sensibles</h3>
          <p style={P}>
            Klientys n'est pas conçu pour héberger des données de santé au sens de l'article 9 du
            RGPD, ni aucune autre catégorie particulière de données. Il appartient au Client de ne
            pas en saisir, notamment dans les champs libres et les notes. Le Client qui exerce une
            profession de santé reconnaît que la nature des informations qu'il saisit relève de sa
            responsabilité et s'engage à vérifier la compatibilité de son usage avec les
            obligations propres à son secteur.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>3. Instructions du Client</h2>
          <p style={P}>
            Klientys ne traite les données que sur instruction documentée du Client. Constituent
            de telles instructions l'utilisation des fonctionnalités de la plateforme, les
            paramètres choisis dans l'espace professionnel, et toute demande adressée au support.
          </p>
          <p style={P}>
            Klientys informe le Client s'il estime qu'une instruction constitue une violation du
            RGPD ou d'une autre disposition relative à la protection des données.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>4. Confidentialité</h2>
          <p style={P}>
            Les personnes autorisées à traiter les données sont tenues à une obligation de
            confidentialité contractuelle, et leurs accès sont nominatifs, individualisés et
            limités au nécessaire. Chaque accès administrateur à un espace client est tracé dans
            un journal horodaté et notifié au Client, dans les conditions prévues aux conditions
            générales d'utilisation.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>5. Sécurité</h2>
          <p style={P}>
            Compte tenu de l'état de l'art et des risques, Klientys met en œuvre notamment :
          </p>
          <ul style={UL}>
            <li>le chiffrement des données en transit (TLS) et au repos ;</li>
            <li>le cloisonnement des espaces clients au niveau de la base de données, par des règles d'accès appliquées à chaque enregistrement ;</li>
            <li>l'authentification des utilisateurs par jetons signés à durée limitée ;</li>
            <li>la journalisation horodatée des accès aux fiches et des actions d'administration ;</li>
            <li>une sauvegarde automatique quotidienne de la base de données, conservée sept (7) jours, restaurable à la demande, avec un délai de restauration cible de quatre (4) heures ouvrées ;</li>
            <li>la séparation des environnements et la limitation des accès de production aux profils habilités.</li>
          </ul>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>6. Sous-traitants ultérieurs</h2>
          <p style={P}>
            Le Client autorise Klientys à recourir aux sous-traitants ultérieurs listés sur la page{" "}
            <a href="/legal/sous-traitants" style={{ color: "var(--l-teal-xl)" }}>Sous-traitants ultérieurs</a>,
            qui fait partie intégrante du présent accord.
          </p>
          <p style={P}>
            Tout ajout ou remplacement est publié sur cette page et notifié par e-mail au moins
            trente (30) jours avant sa prise d'effet. Le Client peut formuler une objection motivée
            pendant ce délai ; à défaut de solution, il peut résilier sans frais la partie du
            service concernée. Chaque sous-traitant ultérieur est lié par des obligations au moins
            équivalentes à celles du présent accord.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>7. Transferts hors Union européenne</h2>
          <p style={P}>
            Les données saisies par le Client sont stockées dans l'Union européenne, à Francfort.
            Certains sous-traitants ultérieurs sont établis hors de l'Union ou y opèrent des
            traitements techniques ; ces transferts sont encadrés par les clauses contractuelles
            types de la Commission européenne, comme indiqué sur la page des sous-traitants.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>8. Assistance au Client</h2>
          <p style={P}>
            Klientys assiste le Client, dans la mesure du possible et compte tenu de la nature du
            traitement :
          </p>
          <ul style={UL}>
            <li>pour répondre aux demandes d'exercice des droits des personnes concernées : la plateforme permet au Client d'exporter, de rectifier et de supprimer lui-même les données, sans intervention de Klientys ;</li>
            <li>pour la réalisation d'une analyse d'impact, par la communication des informations techniques en sa possession ;</li>
            <li>pour la démonstration du respect de ses obligations, par la mise à disposition des informations prévues à l'article 10.</li>
          </ul>
          <h3 style={H3}>Violation de données</h3>
          <p style={P}>
            Klientys notifie au Client toute violation de données à caractère personnel le
            concernant dans les meilleurs délais et au plus tard <strong>quarante-huit (48)
            heures</strong> après en avoir pris connaissance, par e-mail aux administrateurs du
            compte, en précisant la nature de la violation, les catégories et le nombre approximatif
            de personnes et d'enregistrements concernés, les conséquences probables et les mesures
            prises. Il appartient au Client de notifier l'autorité de contrôle.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>9. Sort des données en fin de contrat</h2>
          <p style={P}>
            Le Client peut à tout moment exporter ses données depuis son espace, sans demande
            préalable et sans intervention de Klientys.
          </p>
          <p style={P}>
            À la fin du contrat, l'accès en lecture seule est maintenu pendant trente (30) jours.
            Au terme de ce délai, les données sont supprimées dans un délai de trente (30) jours ;
            les sauvegardes résiduelles sont purgées selon le cycle de rétention de l'hébergeur.
            Klientys ne conserve ensuite que ce qu'une obligation légale lui impose de conserver,
            notamment les pièces comptables.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>10. Audit</h2>
          <p style={P}>
            Klientys met à la disposition du Client les informations nécessaires pour démontrer le
            respect de ses obligations. Le Client peut demander un audit, au maximum une fois par
            an, moyennant un préavis de trente (30) jours, pendant les heures ouvrées, et sans
            perturber l'exploitation. Les coûts d'un audit conduit par un tiers sont à la charge du
            Client, sauf si l'audit révèle un manquement substantiel.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>11. Durée, droit applicable et contact</h2>
          <p style={P}>
            Le présent accord s'applique pendant toute la durée de l'abonnement. Il est régi par le
            droit français. L'autorité de contrôle compétente est la{" "}
            <a href="https://www.cnil.fr" target="_blank" rel="noreferrer" style={{ color: "var(--l-teal-xl)" }}>CNIL</a>.
          </p>
          <p style={P}>
            Contact pour toute question relative à la protection des données :{" "}
            <a href="mailto:support@klientys.co" style={{ color: "var(--l-teal-xl)" }}>support@klientys.co</a>.
          </p>
          <p style={P}>
            Un exemplaire signé peut être adressé sur demande aux clients dont les procédures
            internes l'exigent.
          </p>
        </div>

      </div>
    </main>
  );
}
