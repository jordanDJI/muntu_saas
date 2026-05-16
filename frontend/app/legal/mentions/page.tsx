import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales | Klientys",
  description: "Mentions légales de la plateforme Klientys.",
  alternates: { canonical: "https://klientys.co/legal/mentions" },
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

export default function MentionsPage() {
  return (
    <main style={{ maxWidth: "760px", margin: "0 auto", padding: "80px 24px 120px" }}>

      <p style={{ fontSize: "11px", color: "var(--l-gold)", fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: "16px" }}>
        Transparence
      </p>
      <h1 style={{
        fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif",
        fontSize: "clamp(28px, 4vw, 40px)",
        fontWeight: 800,
        color: "var(--l-text)",
        lineHeight: 1.2,
        marginBottom: "12px",
      }}>
        Mentions légales
      </h1>
      <p style={{ ...P, marginBottom: "56px" }}>
        Conformément aux obligations légales applicables aux éditeurs de sites web.
      </p>

      <div style={{ borderTop: "1px solid var(--l-border)", paddingTop: "48px" }}>

        <div style={SECTION}>
          <h2 style={H2}>Éditeur du site</h2>
          <p style={P}>
            <strong>Klientys SRL</strong><br />
            Société à responsabilité limitée de droit belge<br />
            Belgique<br />
            E-mail : <a href="mailto:support@klientys.co" style={{ color: "var(--l-teal-xl)" }}>support@klientys.co</a>
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>Directeur de la publication</h2>
          <p style={P}>
            Le directeur de la publication est le représentant légal de Klientys SRL.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>Hébergement</h2>
          <p style={P}>
            <strong>Frontend</strong><br />
            Vercel Inc.<br />
            440 N Barranca Ave #4133, Covina, CA 91723, États-Unis<br />
            <a href="https://vercel.com" target="_blank" rel="noreferrer" style={{ color: "var(--l-teal-xl)" }}>vercel.com</a>
          </p>
          <p style={P}>
            <strong>Base de données & authentification</strong><br />
            Supabase Inc.<br />
            970 Toa Payoh North, #07-04, Singapour 318992<br />
            Serveurs hébergés dans l'Union européenne (Frankfurt, AWS eu-central-1)<br />
            <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: "var(--l-teal-xl)" }}>supabase.com</a>
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>Propriété intellectuelle</h2>
          <p style={P}>
            L'ensemble des éléments constituant le site klientys.co (textes, graphismes, logotype, icônes, code source)
            sont la propriété exclusive de Klientys SRL ou font l'objet de licences d'utilisation accordées à Klientys SRL.
          </p>
          <p style={P}>
            Toute reproduction, représentation, modification ou exploitation non autorisée de tout ou partie de ces éléments
            est strictement interdite et constitue une contrefaçon sanctionnée par le droit applicable.
          </p>
          <p style={P}>
            Les contenus publiés par les professionnels utilisateurs sur leurs sites vitrine (textes, images, logos)
            restent la propriété exclusive de ces utilisateurs.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>Données personnelles</h2>
          <p style={P}>
            Le traitement des données personnelles effectué dans le cadre de l'utilisation de Klientys est décrit
            dans notre{" "}
            <a href="/legal/privacy" style={{ color: "var(--l-teal-xl)" }}>Politique de confidentialité</a>.
          </p>
          <p style={P}>
            Conformément au Règlement Général sur la Protection des Données (RGPD — Règlement UE 2016/679),
            vous disposez d'un droit d'accès, de rectification, d'effacement et de portabilité de vos données.
            Pour exercer ces droits :{" "}
            <a href="mailto:support@klientys.co" style={{ color: "var(--l-teal-xl)" }}>support@klientys.co</a>.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>Cookies</h2>
          <p style={P}>
            Le site klientys.co utilise uniquement des cookies fonctionnels strictement nécessaires au fonctionnement
            du service (maintien de la session utilisateur). Aucun cookie publicitaire ou de tracking tiers n'est
            déposé sans votre consentement explicite.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>Liens hypertextes</h2>
          <p style={P}>
            Klientys ne peut être tenu responsable du contenu des sites tiers vers lesquels des liens sont proposés.
            Ces liens sont fournis à titre informatif uniquement.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>Médiation</h2>
          <p style={P}>
            En cas de litige, vous pouvez contacter en premier lieu notre service client à{" "}
            <a href="mailto:support@klientys.co" style={{ color: "var(--l-teal-xl)" }}>support@klientys.co</a>.
            En l'absence de résolution amiable, vous pouvez saisir le médiateur compétent selon la législation
            belge applicable.
          </p>
        </div>

      </div>
    </main>
  );
}