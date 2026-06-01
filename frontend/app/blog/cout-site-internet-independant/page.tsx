import type { Metadata } from "next";
import ArticleLayout from "../../../components/ArticleLayout";

export const revalidate = 86400; // ISR — revalide chaque jour, l'année se met à jour sans redéploiement

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";
const SLUG = "cout-site-internet-independant";
const YEAR = new Date().getFullYear();
const TITLE = `Combien coûte vraiment un site internet pour indépendant en ${YEAR} ?`;
const DESCRIPTION = "Wix, Squarespace, site sur mesure, tout-en-un : comparaison honnête des coûts réels pour un indépendant ou une TPE. Avec le calcul que personne ne fait.";
const PUBLISHED = "2025-05-16";
const DATE_MODIFIED = `${YEAR}-01-01`;
const OG_IMAGE = `${APP_URL}/api/og?title=${encodeURIComponent("Coût site internet indépendant")}&color=indigo`;

export const metadata: Metadata = {
  title: `${TITLE} | Klientys`,
  description: DESCRIPTION,
  alternates: { canonical: `${APP_URL}/blog/${SLUG}` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${APP_URL}/blog/${SLUG}`, type: "article", siteName: "Klientys", images: [{ url: OG_IMAGE, width: 1200, height: 630 }], publishedTime: PUBLISHED, modifiedTime: DATE_MODIFIED },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
};

const jsonLd = [
  { "@context": "https://schema.org", "@type": "Article", headline: TITLE, description: DESCRIPTION, datePublished: PUBLISHED, dateModified: DATE_MODIFIED, author: { "@type": "Organization", name: "Klientys", url: APP_URL }, publisher: { "@type": "Organization", name: "Klientys", url: APP_URL, logo: { "@type": "ImageObject", url: `${APP_URL}/logo.png` } }, mainEntityOfPage: { "@type": "WebPage", "@id": `${APP_URL}/blog/${SLUG}` } },
  { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Accueil", item: APP_URL }, { "@type": "ListItem", position: 2, name: "Blog", item: `${APP_URL}/blog` }, { "@type": "ListItem", position: 3, name: TITLE, item: `${APP_URL}/blog/${SLUG}` }] },
];

const OUTILS = [
  { nom: "Site Wix Pro", prix: 17, note: "Sans agenda ni CRM" },
  { nom: "Calendly Standard", prix: 10, note: "Prise de RDV basique" },
  { nom: "Pipedrive Essential", prix: 15, note: "CRM minimum viable" },
  { nom: "Mailchimp Essentials", prix: 13, note: "Emails automatiques" },
  { nom: "Domaine .fr/.be", prix: 2, note: "En sus de l'hébergement" },
  { nom: "TOTAL", prix: 57, note: "Sans compter le temps de configuration", bold: true },
];

export default function Article() {
  return (
    <>
      {jsonLd.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <ArticleLayout
        breadcrumbLabel="Coût site internet indépendant"
        category="Prix & ROI"
        readingMinutes={7}
        publishedAt={PUBLISHED}
        title={TITLE}
        description={DESCRIPTION}
        relatedLinks={[
          { href: "/blog/doctolib-vs-klientys-kine-infirmier", label: "Doctolib vs Klientys : ce que les kinés ne savent pas" },
          { href: "/blog/remplir-agenda-en-ligne-sans-plateforme", label: "Remplir son agenda sans Habitatpresto ni Superprof" },
          { href: "/site-internet-pour", label: "Site internet par métier" },
          { href: "/blog", label: "← Retour au blog" },
        ]}
      >
        <p>"Mon site Wix coûte 15 €/mois." C'est la réponse que donnent beaucoup d'indépendants quand on leur demande combien ils dépensent pour leur présence en ligne. C'est aussi la réponse la plus fausse qu'ils puissent donner — pas parce qu'ils mentent, mais parce que le site seul ne suffit jamais.</p>
        <p>Cet article fait le calcul que personne ne fait : le vrai coût mensuel d'une présence en ligne opérationnelle pour un indépendant ou une TPE en {YEAR}.</p>

        <h2>Le mythe du "site à 15 €/mois"</h2>
        <p>Wix, Squarespace, WordPress hébergé — ces plateformes affichent des prix attractifs. Mais un site vitrine seul ne vous rapporte rien si vous ne pouvez pas recevoir des réservations, gérer vos contacts, ou relancer vos prospects automatiquement.</p>
        <p>Un indépendant qui veut une présence <em>opérationnelle</em> a besoin d'au minimum :</p>
        <ul>
          <li>Un site vitrine visible sur Google</li>
          <li>Un système de prise de rendez-vous en ligne</li>
          <li>Un CRM pour gérer ses prospects et clients</li>
          <li>Un outil d'emails automatiques (confirmation, rappel, relance)</li>
          <li>Un nom de domaine professionnel</li>
        </ul>
        <p>Additionnez tout ça — voici ce que ça donne réellement :</p>

        <div style={{ overflowX: "auto", margin: "24px 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "#f8f9fa" }}>
                <th style={{ textAlign: "left", padding: "12px 16px", border: "1px solid #e5e7eb", fontWeight: 600 }}>Outil</th>
                <th style={{ padding: "12px 16px", border: "1px solid #e5e7eb", fontWeight: 600, textAlign: "center" }}>Prix/mois</th>
                <th style={{ padding: "12px 16px", border: "1px solid #e5e7eb", fontWeight: 600, textAlign: "left" }}>Note</th>
              </tr>
            </thead>
            <tbody>
              {OUTILS.map((o) => (
                <tr key={o.nom} style={{ borderBottom: "1px solid #e5e7eb", background: o.bold ? "#fff5f5" : "transparent" }}>
                  <td style={{ padding: "12px 16px", fontWeight: o.bold ? 700 : 500, color: o.bold ? "#991b1b" : "#374151" }}>{o.nom}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: o.bold ? 700 : 500, color: o.bold ? "#b91c1c" : "#374151" }}>{o.prix} €</td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", color: o.bold ? "#dc2626" : "#9ca3af" }}>{o.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "8px", fontStyle: "italic" }}>* Prix relevés en janvier {YEAR}, abonnements annuels, hors TVA.</p>
        </div>

        <p><strong>57 €/mois minimum</strong> pour un setup basique — et encore, sans agent IA, sans analytics, sans domaine personnalisé compris, et sans le temps que vous passez à faire communiquer ces outils entre eux.</p>

        <h2>Le coût invisible : votre temps</h2>
        <p>Chaque outil a son interface, ses mises à jour, ses bugs. Quand un client réserve sur Calendly, l'information n'arrive pas automatiquement dans votre CRM Pipedrive — vous le rentrez à la main, ou vous payez Zapier (20 €/mois de plus) pour l'automatiser.</p>
        <p>Les indépendants que nous accompagnons estiment passer entre <strong>2 et 4 heures par semaine</strong> à gérer des tâches administratives liées à ces outils — temps qui n'est pas facturé, temps qui n'est pas passé avec vos clients.</p>

        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "12px", padding: "20px 24px", margin: "24px 0" }}>
          <p style={{ color: "#92400e", fontWeight: 600, fontSize: "15px", margin: 0 }}>Si votre taux horaire est de 50 €, 3h/semaine de gestion administrative = 600 €/mois de manque à gagner.</p>
        </div>

        <h2>Le coût d'un site sur mesure</h2>
        <p>L'autre option classique : faire appel à une agence ou un freelance pour créer votre site. Voici les tarifs réalistes en {YEAR} :</p>
        <ul>
          <li><strong>Site vitrine simple (5 pages)</strong> : 1 500 – 3 500 €</li>
          <li><strong>Site avec agenda intégré</strong> : 3 000 – 6 000 €</li>
          <li><strong>Maintenance annuelle</strong> : 500 – 1 200 €</li>
          <li><strong>Mises à jour de contenu</strong> : 80 – 150 €/h</li>
        </ul>
        <p>Un site sur mesure peut valoir l'investissement pour une PME avec un budget marketing conséquent. Pour un indépendant ou une TPE qui démarre ou veut optimiser ses coûts, c'est rarement le choix le plus rationnel.</p>

        <h2>Le calcul avec Klientys</h2>
        <p>Klientys est une plateforme tout-en-un qui remplace l'empilement d'outils. Site vitrine SEO + agenda en ligne + CRM + emails automatiques + agent IA + analytics — dans un seul abonnement, sans configuration entre outils.</p>

        <div style={{ overflowX: "auto", margin: "24px 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "#f8f9fa" }}>
                <th style={{ textAlign: "left", padding: "12px 16px", border: "1px solid #e5e7eb", fontWeight: 600 }}>Ce que vous payez</th>
                <th style={{ padding: "12px 16px", border: "1px solid #e5e7eb", fontWeight: 600, textAlign: "center" }}>5 outils séparés</th>
                <th style={{ padding: "12px 16px", border: "1px solid #e5e7eb", color: "#4338ca", fontWeight: 700, textAlign: "center" }}>Klientys</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Site vitrine professionnel", "✅ Wix 17 €", "✅ Inclus"],
                ["Agenda de réservation", "✅ Calendly 10 €", "✅ Inclus"],
                ["CRM", "✅ Pipedrive 15 €", "✅ Inclus"],
                ["Emails automatiques", "✅ Mailchimp 13 €", "✅ Inclus"],
                ["Domaine personnalisé", "✅ +2 €/mois", "✅ Inclus Pro"],
                ["Agent IA (WhatsApp, chatbot)", "❌ Non disponible", "✅ Inclus"],
                ["SEO local automatique", "❌ Manuel", "✅ Automatique"],
                ["Analytics comportementaux", "❌ Partiel", "✅ Inclus"],
                ["Support", "❌ Par outil", "✅ Centralisé"],
                ["TOTAL mensuel", "57 €+ (sans IA)", "Dès 29,90 €"],
              ].map(([feature, old, klientys], i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e5e7eb", background: i === 9 ? "#eef2ff" : "transparent" }}>
                  <td style={{ padding: "12px 16px", fontWeight: i === 9 ? 700 : 500 }}>{feature}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center", color: "#9ca3af" }}>{old}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center", color: "#4338ca", fontWeight: i === 9 ? 700 : 500 }}>{klientys}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>Le ROI : combien votre site vous rapporte ?</h2>
        <p>La question du coût est importante, mais la vraie question est celle du retour sur investissement. Voici des exemples concrets basés sur nos utilisateurs :</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", margin: "24px 0" }}>
          {[
            { metier: "Infirmière libérale", gain: "+4 nouveaux patients/mois", valeur: "~400 €/mois", delai: "3 semaines" },
            { metier: "Plombier artisan", gain: "+3 demandes de devis/semaine", valeur: "~900 €/mois", delai: "1 mois" },
            { metier: "Coach sportif", gain: "+6 nouveaux clients/mois", valeur: "~540 €/mois", delai: "1 mois" },
          ].map((ex) => (
            <div key={ex.metier} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "12px", padding: "20px" }}>
              <p style={{ fontWeight: 600, color: "#166534", fontSize: "14px", marginBottom: "8px" }}>{ex.metier}</p>
              <p style={{ color: "#15803d", fontSize: "14px", marginBottom: "4px" }}>{ex.gain}</p>
              <p style={{ color: "#16a34a", fontWeight: 700, fontSize: "15px", marginBottom: "8px" }}>{ex.valeur}</p>
              <p style={{ color: "#4ade80", fontSize: "12px" }}>Sous {ex.delai}</p>
            </div>
          ))}
        </div>

        <p>Un abonnement Klientys à 29,90 €/mois est remboursé dès le premier client supplémentaire. Pour la plupart des indépendants que nous suivons, le ROI positif arrive dans les 30 premiers jours.</p>

        <h2>Conclusion : le vrai calcul</h2>
        <p>Un site seul ne coûte pas 15 €/mois si vous voulez qu'il soit opérationnel. Le coût réel d'une présence en ligne fonctionnelle pour un indépendant oscille entre <strong>57 € et 80 €/mois</strong> avec des outils séparés, ou entre 1 500 € et 6 000 € pour un site sur mesure.</p>
        <p>Un outil tout-en-un comme Klientys réduit ce coût à <strong>29,90 €/mois</strong> tout en éliminant les heures de gestion administrative. Pour un indépendant dont le temps est directement facturé, c'est souvent le calcul le plus rationnel.</p>
      </ArticleLayout>
    </>
  );
}
