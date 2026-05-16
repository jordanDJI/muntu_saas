import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité | Klientys",
  description: "Comment Klientys collecte, utilise et protège vos données personnelles.",
  alternates: { canonical: "https://klientys.co/legal/privacy" },
};

const SECTION: React.CSSProperties = {
  marginBottom: "40px",
};

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

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: "760px", margin: "0 auto", padding: "80px 24px 120px" }}>

      <p style={{ fontSize: "11px", color: "var(--l-gold)", fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: "16px" }}>
        Données personnelles
      </p>
      <h1 style={{
        fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif",
        fontSize: "clamp(28px, 4vw, 40px)",
        fontWeight: 800,
        color: "var(--l-text)",
        lineHeight: 1.2,
        marginBottom: "12px",
      }}>
        Politique de confidentialité
      </h1>
      <p style={{ ...P, marginBottom: "56px" }}>
        Dernière mise à jour : 16 mai 2026 — Klientys SRL, Belgique
      </p>

      <div style={{ borderTop: "1px solid var(--l-border)", paddingTop: "48px" }}>

        <div style={SECTION}>
          <h2 style={H2}>1. Qui sommes-nous ?</h2>
          <p style={P}>
            Klientys (ci-après «&nbsp;nous&nbsp;») est une plateforme SaaS éditée par Klientys SRL, société de droit belge.
            Elle permet aux indépendants et TPE (kinés, infirmiers, artisans, etc.) de créer leur site vitrine, gérer leurs
            rendez-vous et piloter leur relation client depuis un tableau de bord unique.
          </p>
          <p style={P}>
            Contact : <a href="mailto:support@klientys.co" style={{ color: "var(--l-teal-xl)" }}>support@klientys.co</a>
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>2. Données collectées</h2>
          <p style={P}>Nous collectons les catégories de données suivantes :</p>
          <ul style={UL}>
            <li><strong>Données de compte</strong> : adresse e-mail, mot de passe (haché par Supabase Auth), nom, secteur d'activité, pays.</li>
            <li><strong>Données de site vitrine</strong> : titre, description, adresse professionnelle, logo, photos, tarifs, témoignages.</li>
            <li><strong>Données CRM</strong> : contacts et prospects saisis par le professionnel (nom, e-mail, téléphone, notes).</li>
            <li><strong>Données de rendez-vous</strong> : date, heure, statut, contact associé.</li>
            <li><strong>Données d'usage</strong> : événements comportementaux anonymisés sur le site vitrine (type de section consultée, clics CTA) associés à un identifiant de session temporaire.</li>
            <li><strong>Données Google Analytics</strong> : lorsque vous connectez votre compte Google, nous stockons un jeton d'accès, un jeton de rafraîchissement et l'identifiant de propriété GA4 que vous renseignez. Ces données sont utilisées exclusivement pour afficher vos statistiques de visites dans votre tableau de bord Klientys.</li>
          </ul>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>3. Finalités et base légale</h2>
          <ul style={UL}>
            <li><strong>Fourniture du service</strong> (exécution du contrat) : gestion du compte, du site vitrine, des rendez-vous et du CRM.</li>
            <li><strong>Communication transactionnelle</strong> (exécution du contrat) : confirmations de rendez-vous, rappels, notifications par e-mail.</li>
            <li><strong>Amélioration du service</strong> (intérêt légitime) : analyse agrégée et anonymisée des comportements sur les sites vitrine.</li>
            <li><strong>Intégration Google Analytics</strong> (consentement explicite) : affichage de vos données GA4 dans votre tableau de bord, sur votre demande. Vous pouvez révoquer cet accès à tout moment depuis Paramètres → Intégrations.</li>
          </ul>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>4. Données Google Analytics — détail</h2>
          <p style={P}>
            Lorsque vous cliquez «&nbsp;Connecter mon compte Google&nbsp;» dans votre tableau de bord, vous accordez à Klientys
            l'accès en lecture seule à vos propriétés Google Analytics (<code>analytics.readonly</code>).
          </p>
          <ul style={UL}>
            <li><strong>Ce que nous stockons</strong> : jeton d'accès OAuth2, jeton de rafraîchissement OAuth2, identifiant de propriété GA4.</li>
            <li><strong>Où</strong> : dans notre base de données hébergée sur Supabase (serveurs en Union européenne), dans la table <code>google_analytics_connection</code>, accessible uniquement à votre compte.</li>
            <li><strong>Ce que nous ne faisons pas</strong> : nous ne partageons pas ces données avec des tiers, ne les revendons pas, et ne les utilisons pas à d'autres fins qu'afficher vos statistiques dans Klientys.</li>
            <li><strong>Révocation</strong> : dans Paramètres → Intégrations → déconnecter Google Analytics. Vous pouvez aussi révoquer l'accès directement depuis <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" style={{ color: "var(--l-teal-xl)" }}>myaccount.google.com/permissions</a>.</li>
          </ul>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>5. Durée de conservation</h2>
          <ul style={UL}>
            <li>Données de compte : durée de l'abonnement + 3 ans après résiliation.</li>
            <li>Données CRM, rendez-vous, site vitrine : durée de l'abonnement + 1 an après résiliation.</li>
            <li>Événements comportementaux anonymisés : 12 mois glissants.</li>
            <li>Tokens Google Analytics : jusqu'à déconnexion ou révocation par l'utilisateur.</li>
          </ul>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>6. Partage des données</h2>
          <p style={P}>Nous ne vendons ni ne louons vos données personnelles. Nous faisons appel aux sous-traitants suivants :</p>
          <ul style={UL}>
            <li><strong>Supabase</strong> — hébergement base de données et authentification (serveurs EU)</li>
            <li><strong>Vercel</strong> — hébergement frontend (CDN mondial, données traitées selon l'accord DPA Vercel)</li>
            <li><strong>Resend</strong> — envoi d'e-mails transactionnels</li>
            <li><strong>Google LLC</strong> — uniquement si vous activez l'intégration Google Analytics</li>
          </ul>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>7. Cookies et traceurs</h2>
          <p style={P}>
            Klientys utilise uniquement des cookies fonctionnels strictement nécessaires (session Supabase Auth).
            Aucun cookie publicitaire ou de tracking tiers n'est déposé sur notre plateforme sans votre consentement.
          </p>
          <p style={P}>
            Les scripts de tracking que <strong>vous</strong> configurez sur votre site vitrine (GA4, Meta Pixel, GTM) relèvent
            de votre responsabilité en tant que responsable de traitement vis-à-vis de vos visiteurs.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>8. Vos droits (RGPD)</h2>
          <p style={P}>Vous disposez des droits suivants sur vos données :</p>
          <ul style={UL}>
            <li>Droit d'accès, de rectification, d'effacement</li>
            <li>Droit à la portabilité</li>
            <li>Droit d'opposition et de limitation du traitement</li>
            <li>Droit de retirer votre consentement à tout moment (ex. : déconnexion Google Analytics)</li>
          </ul>
          <p style={P}>
            Pour exercer ces droits : <a href="mailto:support@klientys.co" style={{ color: "var(--l-teal-xl)" }}>support@klientys.co</a>.
            Réponse sous 30 jours. En cas de litige, vous pouvez saisir l'
            <a href="https://www.autoriteprotectiondonnees.be" target="_blank" rel="noreferrer" style={{ color: "var(--l-teal-xl)" }}>Autorité de Protection des Données</a> (Belgique).
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>9. Sécurité</h2>
          <p style={P}>
            Les données sont chiffrées en transit (TLS 1.3) et au repos. L'accès aux données est contrôlé par des politiques
            Row-Level Security (RLS) dans Supabase — chaque professionnel ne peut accéder qu'à ses propres données.
            Les tokens Google Analytics sont stockés chiffrés et jamais exposés côté client.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>10. Modifications</h2>
          <p style={P}>
            Toute modification substantielle de cette politique vous sera notifiée par e-mail avec un préavis de 15 jours.
            La date de dernière mise à jour figure en haut de cette page.
          </p>
        </div>

      </div>
    </main>
  );
}