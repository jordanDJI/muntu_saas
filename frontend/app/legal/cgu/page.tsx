import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation | Klientys",
  description: "Conditions générales d'utilisation de la plateforme Klientys.",
  alternates: { canonical: "https://klientys.co/legal/cgu" },
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
  paddingLeft: "20px",
  marginBottom: "12px",
  marginTop: "0",
};

export default function CguPage() {
  return (
    <main style={{ maxWidth: "760px", margin: "0 auto", padding: "80px 24px 120px" }}>

      <p style={{ fontSize: "11px", color: "var(--l-gold)", fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: "16px" }}>
        Contrat
      </p>
      <h1 style={{
        fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif",
        fontSize: "clamp(28px, 4vw, 40px)",
        fontWeight: 800,
        color: "var(--l-text)",
        lineHeight: 1.2,
        marginBottom: "12px",
      }}>
        Conditions Générales d'Utilisation
      </h1>
      <p style={{ ...P, marginBottom: "56px" }}>
        Dernière mise à jour : 3 juillet 2026 — Klientys SRL, Belgique
      </p>

      <div style={{ borderTop: "1px solid var(--l-border)", paddingTop: "48px" }}>

        <div style={SECTION}>
          <h2 style={H2}>1. Objet</h2>
          <p style={P}>
            Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme
            Klientys, accessible à l'adresse <strong>klientys.co</strong>, éditée par Klientys SRL (Belgique).
          </p>
          <p style={P}>
            En créant un compte, vous acceptez sans réserve les présentes CGU. Si vous n'acceptez pas ces conditions,
            vous ne devez pas utiliser la plateforme.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>2. Description du service</h2>
          <p style={P}>Klientys est une plateforme SaaS (Software as a Service) qui propose :</p>
          <ul style={UL}>
            <li>La création et la publication d'un site vitrine professionnel personnalisé</li>
            <li>Un système de prise de rendez-vous en ligne</li>
            <li>Un CRM léger (gestion des contacts et leads)</li>
            <li>Des agents IA de communication (chatbot vitrine, assistant tenant)</li>
            <li>Un tableau de bord analytics</li>
            <li>Un module de facturation électronique (génération PDF A4 + XML UBL 2.1 conforme EN 16931, envoi par email, suivi des statuts)</li>
            <li>Des intégrations tierces optionnelles (Google Analytics, Telegram, WhatsApp)</li>
          </ul>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>3. Inscription et compte</h2>
          <p style={P}>
            L'accès au service requiert la création d'un compte avec une adresse e-mail valide. Vous êtes responsable
            de la confidentialité de vos identifiants et de toutes les actions effectuées depuis votre compte.
          </p>
          <p style={P}>
            Vous vous engagez à fournir des informations exactes et à les maintenir à jour. Klientys se réserve le droit
            de suspendre tout compte dont les informations sont manifestement inexactes ou frauduleuses.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>4. Période d'essai et abonnements</h2>
          <p style={P}>
            Tout nouveau compte bénéficie d'une période d'essai gratuite de <strong>14 jours</strong> donnant accès
            à l'ensemble des fonctionnalités du plan Essentiel. Aucune carte bancaire n'est requise pendant l'essai.
          </p>
          <p style={P}>
            À l'expiration de l'essai sans souscription, l'accès aux fonctionnalités est suspendu. Vos données sont
            conservées pendant 30 jours supplémentaires avant suppression définitive.
          </p>
          <p style={P}>
            Les tarifs des abonnements sont affichés sur la page <a href="/#pricing" style={{ color: "var(--l-teal-xl)" }}>Tarifs</a>.
            Les abonnements sont renouvelés automatiquement jusqu'à résiliation. Vous pouvez résilier à tout moment
            depuis vos paramètres ; la résiliation prend effet à la fin de la période en cours.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>5. Utilisation autorisée</h2>
          <p style={P}>Vous vous engagez à utiliser Klientys uniquement dans un cadre professionnel légal et à ne pas :</p>
          <ul style={UL}>
            <li>Publier des contenus illégaux, diffamatoires, frauduleux ou portant atteinte aux droits de tiers</li>
            <li>Utiliser le service pour envoyer des communications non sollicitées (spam)</li>
            <li>Tenter d'accéder aux données d'autres utilisateurs</li>
            <li>Contourner ou désactiver les mécanismes de sécurité de la plateforme</li>
            <li>Utiliser des bots ou scripts automatisés non autorisés</li>
          </ul>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>6. Contenu utilisateur</h2>
          <p style={P}>
            Vous conservez la propriété de l'ensemble des contenus que vous publiez sur Klientys (textes, images, logos).
            Vous accordez à Klientys une licence non exclusive, mondiale et gratuite pour héberger, afficher et distribuer
            ce contenu dans le seul but de fournir le service.
          </p>
          <p style={P}>
            Vous êtes seul responsable de la légalité des contenus publiés, notamment du respect du droit à l'image
            et des droits d'auteur pour les photos et images utilisées.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>7. Disponibilité et maintenance</h2>
          <p style={P}>
            Klientys s'engage à fournir un service disponible 99 % du temps sur une base mensuelle, hors maintenances
            planifiées notifiées au moins 24h à l'avance. Klientys ne peut être tenu responsable des interruptions dues
            à des tiers (hébergeurs, fournisseurs d'API, force majeure).
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>8. Limitation de responsabilité</h2>
          <p style={P}>
            Klientys est un outil mis à disposition des professionnels. La relation entre le professionnel et ses
            clients est de la seule responsabilité du professionnel. Klientys ne saurait être tenu responsable
            des rendez-vous manqués, annulations ou litiges commerciaux entre le professionnel et ses clients.
          </p>
          <p style={P}>
            La responsabilité de Klientys est limitée au montant des sommes versées par l'utilisateur au cours
            des 12 derniers mois précédant le dommage.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>9. Protection des données</h2>
          <p style={P}>
            Le traitement des données personnelles est décrit dans notre{" "}
            <a href="/legal/privacy" style={{ color: "var(--l-teal-xl)" }}>Politique de confidentialité</a>.
            En utilisant Klientys, vous reconnaissez en avoir pris connaissance.
          </p>
          <p style={P}>
            En tant que professionnel utilisant Klientys pour gérer les données de vos clients (CRM, rendez-vous),
            vous êtes responsable de traitement au sens du RGPD vis-à-vis de vos propres clients. Klientys agit
            en qualité de sous-traitant.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>10. Résiliation</h2>
          <p style={P}>
            Vous pouvez supprimer votre compte à tout moment depuis vos paramètres. Cette action entraîne la
            suppression définitive de toutes vos données dans un délai de 30 jours.
          </p>
          <p style={P}>
            Klientys peut suspendre ou résilier votre accès en cas de violation des présentes CGU, après mise
            en demeure restée sans effet pendant 48h, sauf en cas de gravité justifiant une suspension immédiate.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>11. Droit applicable et juridiction</h2>
          <p style={P}>
            Les présentes CGU sont régies par le droit belge. Tout litige sera soumis à la juridiction compétente
            du ressort du siège de Klientys SRL, sauf disposition impérative contraire applicable au consommateur.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>12. Modifications des CGU</h2>
          <p style={P}>
            Klientys se réserve le droit de modifier les présentes CGU. Toute modification substantielle sera
            notifiée par e-mail avec un préavis de 15 jours. La poursuite de l'utilisation du service après
            ce délai vaut acceptation des nouvelles conditions.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>13. Accès administrateur pour support et maintenance</h2>
          <p style={P}>
            Dans le cadre de ses obligations de support technique et de maintenance, Klientys SRL peut être amenée
            à accéder à votre espace professionnel (tableau de bord, données CRM, configuration) sans nécessiter
            votre présence ou votre action. Cet accès est strictement encadré :
          </p>
          <ul style={UL}>
            <li>Il est réservé aux administrateurs Klientys identifiés et habilités</li>
            <li>Chaque accès est automatiquement tracé dans un journal d'audit interne horodaté (adresse admin, tenant ciblé, date et heure)</li>
            <li>Une notification par e-mail vous est envoyée automatiquement après chaque accès</li>
            <li>Il est limité au strict nécessaire (diagnostic, correction de bug, assistance demandée)</li>
            <li>Aucune donnée bancaire, mot de passe ou clé privée n'est accessible par ce biais</li>
          </ul>
          <p style={P}>
            Ce mécanisme constitue une pratique standard dans le secteur SaaS (similaire à Stripe, Intercom, Crisp, etc.).
            Si vous recevez une notification d'accès que vous n'avez pas sollicité, contactez-nous immédiatement à{" "}
            <a href="mailto:support@klientys.co" style={{ color: "var(--l-teal-xl)" }}>support@klientys.co</a>.
          </p>
          <p style={P}>
            En acceptant les présentes CGU, vous autorisez Klientys SRL à exercer ce droit d'accès dans les conditions
            décrites ci-dessus.
          </p>
        </div>

      </div>
    </main>
  );
}