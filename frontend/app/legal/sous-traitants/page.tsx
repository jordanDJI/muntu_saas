import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sous-traitants ultérieurs | Klientys",
  description:
    "Liste des sous-traitants ultérieurs auxquels Klientys recourt pour fournir le service, leur rôle, les données concernées et leur localisation.",
  alternates: { canonical: "https://klientys.co/legal/sous-traitants" },
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

const TABLE: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
  marginBottom: "16px",
};

const TH: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "2px solid var(--l-border)",
  color: "var(--l-text)",
  fontWeight: 700,
  fontSize: "13px",
  verticalAlign: "top",
};

const TD: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--l-border)",
  color: "var(--l-text2)",
  lineHeight: 1.6,
  verticalAlign: "top",
};

/** Sous-traitants auxquels Klientys recourt pour fournir le service. */
const SUBPROCESSORS: {
  name: string;
  role: string;
  data: string;
  location: string;
  transfer: string;
}[] = [
  {
    name: "Supabase Inc.",
    role: "Base de données, authentification et stockage de fichiers",
    data: "Contacts, rendez-vous, échanges, pièces jointes, factures, comptes utilisateurs",
    location: "Union européenne — Francfort (AWS eu-central-1)",
    transfer: "Aucun transfert hors UE pour les données stockées",
  },
  {
    name: "Vercel Inc.",
    role: "Hébergement et diffusion de l'interface web",
    data: "Journaux techniques de connexion, adresses IP",
    location: "États-Unis — réseau de diffusion mondial",
    transfer: "Clauses contractuelles types",
  },
  {
    name: "Resend (Plus Five Five, Inc.)",
    role: "Envoi des e-mails transactionnels et des campagnes",
    data: "Adresse e-mail, nom, contenu des messages envoyés",
    location: "États-Unis",
    transfer: "Clauses contractuelles types",
  },
  {
    name: "Stripe Payments Europe, Ltd.",
    role: "Encaissement des abonnements Klientys",
    data: "Données de facturation de l'abonné. Aucune donnée de ses propres clients",
    location: "Irlande, avec transferts vers les États-Unis",
    transfer: "Clauses contractuelles types",
  },
  {
    name: "Google Ireland Ltd. — Gemini",
    role: "Agents IA de rédaction et de conversation",
    data: "Contenu des messages soumis à l'agent, lorsque la fonction est activée",
    location: "Union européenne et États-Unis",
    transfer: "Clauses contractuelles types — fonction désactivée par défaut",
  },
  {
    name: "Google Ireland Ltd. — Analytics",
    role: "Mesure d'audience du site vitrine",
    data: "Identifiants de navigation des visiteurs du site public",
    location: "Union européenne et États-Unis",
    transfer: "Activé uniquement si le client le configure et si le visiteur y consent",
  },
  {
    name: "Telegram FZ-LLC",
    role: "Canal de messagerie des agents IA",
    data: "Identifiant de conversation et contenu des messages échangés",
    location: "Hors Union européenne",
    transfer: "Activé uniquement si le client connecte un bot",
  },
  {
    name: "OVH SAS",
    role: "Enregistrement des noms de domaine personnalisés",
    data: "Coordonnées du titulaire du domaine",
    location: "France",
    transfer: "Aucun",
  },
];

export default function SousTraitantsPage() {
  return (
    <main style={{ maxWidth: "860px", margin: "0 auto", padding: "80px 24px 120px" }}>

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
        Sous-traitants ultérieurs
      </h1>
      <p style={{ ...P, marginBottom: "56px" }}>
        Dernière mise à jour : 12 octobre 2026 — ADUMIS, éditeur de Klientys.
      </p>

      <div style={{ borderTop: "1px solid var(--l-border)", paddingTop: "48px" }}>

        <div style={SECTION}>
          <h2 style={H2}>Pourquoi cette page</h2>
          <p style={P}>
            Pour fournir le service, Klientys recourt à des prestataires qui traitent des données
            pour son compte. L'article 28 du RGPD impose de vous les communiquer et de vous
            informer de tout changement, afin que vous puissiez vous y opposer.
          </p>
          <p style={P}>
            Chacun de ces prestataires est lié par un contrat comportant des garanties au moins
            équivalentes à celles de notre accord de sous-traitance, et n'accède qu'aux données
            nécessaires à sa prestation.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>Liste au 12 octobre 2026</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={TABLE}>
              <thead>
                <tr>
                  <th style={TH}>Prestataire</th>
                  <th style={TH}>Rôle</th>
                  <th style={TH}>Données concernées</th>
                  <th style={TH}>Localisation</th>
                  <th style={TH}>Transferts</th>
                </tr>
              </thead>
              <tbody>
                {SUBPROCESSORS.map((s) => (
                  <tr key={s.name}>
                    <td style={{ ...TD, fontWeight: 600, color: "var(--l-text)" }}>{s.name}</td>
                    <td style={TD}>{s.role}</td>
                    <td style={TD}>{s.data}</td>
                    <td style={TD}>{s.location}</td>
                    <td style={TD}>{s.transfer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>Point de transparence sur l'hébergement</h2>
          <p style={P}>
            Les données que vous saisissez — contacts, rendez-vous, factures, pièces jointes —
            sont stockées dans l'Union européenne, à Francfort. L'interface web est en revanche
            servie par un réseau de diffusion mondial : la localisation européenne de la base de
            données ne signifie donc pas que l'intégralité des journaux techniques reste dans l'Union.
          </p>
        </div>

        <div style={SECTION}>
          <h2 style={H2}>Changements</h2>
          <p style={P}>
            Tout ajout ou remplacement de sous-traitant est publié sur cette page et notifié par
            e-mail aux administrateurs des comptes concernés au moins trente (30) jours avant sa
            prise d'effet. Vous disposez de ce délai pour formuler une objection motivée à{" "}
            <a href="mailto:support@klientys.co" style={{ color: "var(--l-teal-xl)" }}>support@klientys.co</a>.
            En cas d'objection que nous ne pourrions pas lever, vous pouvez résilier sans frais la
            partie du service concernée.
          </p>
        </div>

      </div>
    </main>
  );
}
