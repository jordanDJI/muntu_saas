import type { Metadata } from "next";
import ArticleLayout from "../../../components/ArticleLayout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";
const SLUG = "remplir-agenda-en-ligne-sans-plateforme";
const TITLE = "Comment remplir son agenda en ligne sans Habitatpresto ni Superprof";
const DESCRIPTION = "Ces plateformes prennent 15 à 20 % sur chaque mission. Voici comment attirer des clients directement via Google — et garder 100 % de vos revenus.";
const PUBLISHED = "2025-05-16";
const OG_IMAGE = `${APP_URL}/api/og?title=${encodeURIComponent("Agenda en ligne sans plateforme")}&color=teal`;

export const metadata: Metadata = {
  title: `${TITLE} | Klientys`,
  description: DESCRIPTION,
  alternates: { canonical: `${APP_URL}/blog/${SLUG}`, types: { "text/markdown": `${APP_URL}/blog/${SLUG}.md` } },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${APP_URL}/blog/${SLUG}`, type: "article", siteName: "Klientys", images: [{ url: OG_IMAGE, width: 1200, height: 630 }], publishedTime: PUBLISHED },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
};

const jsonLd = [
  { "@context": "https://schema.org", "@type": "Article", headline: TITLE, description: DESCRIPTION, datePublished: PUBLISHED, dateModified: PUBLISHED, author: { "@type": "Organization", name: "Klientys", url: APP_URL }, publisher: { "@type": "Organization", name: "Klientys", url: APP_URL, logo: { "@type": "ImageObject", url: `${APP_URL}/logo.png` } }, mainEntityOfPage: { "@type": "WebPage", "@id": `${APP_URL}/blog/${SLUG}` } },
  { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Accueil", item: APP_URL }, { "@type": "ListItem", position: 2, name: "Blog", item: `${APP_URL}/blog` }, { "@type": "ListItem", position: 3, name: TITLE, item: `${APP_URL}/blog/${SLUG}` }] },
];

const PLATEFORMES = [
  { nom: "Habitatpresto", commission: "15–20 %", probleme: "Leads partagés entre plusieurs pros", cible: "Artisans" },
  { nom: "Superprof", commission: "20 %", probleme: "Profil noyé parmi des milliers", cible: "Profs particuliers" },
  { nom: "Doctolib", commission: "160 €/mois fixe", probleme: "Résiliation = zéro visibilité du jour au lendemain", cible: "Santé" },
  { nom: "Mariages.net", commission: "20 %", probleme: "Concurrence directe sur la plateforme", cible: "Photographes, DJs" },
];

export default function Article() {
  return (
    <>
      {jsonLd.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <ArticleLayout
        breadcrumbLabel="Agenda sans plateforme"
        category="Acquisition clients"
        readingMinutes={8}
        publishedAt={PUBLISHED}
        title={TITLE}
        description={DESCRIPTION}
        relatedLinks={[
          { href: "/blog/doctolib-vs-klientys-kine-infirmier", label: "Doctolib vs Klientys : ce que les kinés ne savent pas" },
          { href: "/blog/cout-site-internet-independant-2025", label: "Combien coûte vraiment un site internet en 2025 ?" },
          { href: "/site-internet-pour/plombier", label: "Site internet pour plombier" },
          { href: "/blog", label: "← Retour au blog" },
        ]}
      >
        <p>Habitatpresto, Superprof, Doctolib, Mariages.net — ces plateformes promettent de vous apporter des clients. Et elles en apportent, c'est vrai. Mais à quel prix ? Et surtout : y a-t-il une alternative plus rentable sur le long terme ?</p>
        <p>Cet article s'adresse aux artisans, professeurs particuliers, photographes, et tous les indépendants qui cherchent à développer leur clientèle sans dépendre — ni payer une commission — à une plateforme tierce.</p>

        <h2>Ce que les plateformes ne vous disent pas</h2>
        <p>Les plateformes intermédiaires ont un modèle économique simple : elles attirent les clients grâce à leur notoriété et leur SEO, puis vous facturent pour y accéder. En apparence, c'est pratique. En réalité, vous financez leur croissance tout en construisant leur actif — pas le vôtre.</p>

        <div style={{ overflowX: "auto", margin: "24px 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "#f8f9fa" }}>
                <th style={{ textAlign: "left", padding: "12px 16px", border: "1px solid #e5e7eb", fontWeight: 600 }}>Plateforme</th>
                <th style={{ padding: "12px 16px", border: "1px solid #e5e7eb", fontWeight: 600, textAlign: "center" }}>Commission</th>
                <th style={{ padding: "12px 16px", border: "1px solid #e5e7eb", fontWeight: 600, textAlign: "left" }}>Problème clé</th>
                <th style={{ padding: "12px 16px", border: "1px solid #e5e7eb", fontWeight: 600, textAlign: "left" }}>Pour qui</th>
              </tr>
            </thead>
            <tbody>
              {PLATEFORMES.map((p) => (
                <tr key={p.nom} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>{p.nom}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center", color: "#dc2626", fontWeight: 700 }}>{p.commission}</td>
                  <td style={{ padding: "12px 16px", color: "#6b7280", fontSize: "13px" }}>{p.probleme}</td>
                  <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: "13px" }}>{p.cible}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>Le calcul que les plateformes évitent</h2>
        <p>Prenons un exemple concret : vous êtes plombier, et vous recevez 10 missions par mois via Habitatpresto, chacune facturée 200 € en moyenne.</p>

        <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "12px", padding: "20px 24px", margin: "24px 0" }}>
          <p style={{ color: "#991b1b", fontWeight: 700, fontSize: "15px", marginBottom: "12px" }}>Ce que vous perdez chaque mois avec Habitatpresto :</p>
          <ul style={{ color: "#b91c1c", fontSize: "14px", margin: 0, paddingLeft: "20px" }}>
            <li style={{ marginBottom: "6px" }}>10 missions × 200 € = 2 000 € de CA</li>
            <li style={{ marginBottom: "6px" }}>Commission 18 % = <strong>360 € reversés à la plateforme</strong></li>
            <li>Sur 12 mois = <strong>4 320 € de commissions annuelles</strong></li>
          </ul>
        </div>

        <p>Pour un artisan ou un indépendant dont la marge est déjà serrée, 4 300 € par an représente souvent plusieurs semaines de travail. C'est aussi exactement ce que vous pourriez investir pour construire un canal d'acquisition qui vous appartient.</p>

        <h2>La vraie alternative : votre propre site indexé sur Google</h2>
        <p>Les plateformes type Habitatpresto ou Superprof ont investi massivement en SEO pour apparaître en tête de Google quand quelqu'un cherche "plombier Paris" ou "prof maths Bordeaux". Ce positionnement leur appartient — pas à vous.</p>
        <p>Mais voici ce que beaucoup d'indépendants ne savent pas : <strong>Google positionne aussi très bien les sites locaux</strong>, à condition qu'ils soient correctement structurés. Une page dédiée à "plombier Lyon 3" avec les bonnes balises SEO, votre adresse, vos zones d'intervention et vos témoignages peut apparaître en première page de Google — sans payer de commission.</p>

        <h3>Ce que Google regarde pour classer un site local</h3>
        <ul>
          <li>✓ <strong>Schema.org LocalBusiness</strong> : balises structurées qui indiquent à Google votre adresse, vos zones d'intervention, vos services et vos avis</li>
          <li>✓ <strong>Contenu local spécifique</strong> : pages dédiées à chaque commune que vous couvrez</li>
          <li>✓ <strong>Avis clients</strong> : note agrégée visible dans les résultats de recherche</li>
          <li>✓ <strong>Vitesse de chargement</strong> : Google pénalise les sites lents, surtout sur mobile</li>
          <li>✓ <strong>Cohérence NAP</strong> : Nom, Adresse, Téléphone identiques partout sur le web</li>
        </ul>

        <h2>Comment Klientys gère tout ça automatiquement</h2>
        <p>Quand vous créez votre site avec Klientys et renseignez vos zones d'intervention, la plateforme génère automatiquement :</p>
        <ul>
          <li>✓ Les balises <strong>Schema.org LocalBusiness</strong> avec toutes vos informations</li>
          <li>✓ Les balises <strong>meta SEO</strong> optimisées pour chaque page</li>
          <li>✓ Des <strong>pages dédiées par zone</strong> d'intervention indexées par Google</li>
          <li>✓ Un <strong>sitemap XML</strong> soumis automatiquement</li>
          <li>✓ Un affichage des <strong>avis clients</strong> visible dans les rich snippets Google</li>
        </ul>
        <p>Résultat : vous êtes visible sur Google pour chaque commune que vous couvrez, pas seulement votre ville principale.</p>

        <h2>Remplir son agenda : les 3 étapes concrètes</h2>

        <h3>Étape 1 : Créer votre site avec zones d'intervention</h3>
        <p>La première étape est de créer une page web à votre nom, avec des informations précises sur les communes que vous couvrez. Ce n'est pas votre ville uniquement — c'est chaque quartier, chaque commune de votre rayon d'intervention.</p>
        <p>Sur Klientys, vous définissez jusqu'à 10 zones. Chaque zone est indexée séparément par Google, multipliant votre surface de visibilité.</p>

        <h3>Étape 2 : Activer la prise de rendez-vous en ligne</h3>
        <p>Un client qui vous trouve sur Google à 22h ne va pas attendre le lendemain matin pour vous appeler. Il va chercher le prochain professionnel disponible. Un bouton "Prendre rendez-vous" ou "Demander un devis" actif 24h/24 capte ces clients que vous rateriez autrement.</p>
        <p>Klientys intègre l'agenda directement dans votre site. Le client réserve, vous recevez une notification, il reçoit une confirmation automatique — sans que vous ayez à intervenir.</p>

        <h3>Étape 3 : Laisser l'agent IA répondre aux questions courantes</h3>
        <p>"Vous intervenez à Vénissieux ?" — "Quel est votre tarif pour une séance ?" — "Avez-vous de la disponibilité la semaine prochaine ?" Ces questions reviennent des dizaines de fois. L'agent IA de Klientys y répond automatiquement sur votre site et via WhatsApp, même quand vous travaillez, dormez ou êtes en rendez-vous.</p>

        <h2>Combien de temps pour voir les premiers résultats ?</h2>
        <p>Google indexe les nouveaux sites en général sous 24 à 72 heures. Le positionnement local sur des requêtes peu concurrentielles (petites communes, métiers spécialisés) arrive souvent dans les 2 à 4 semaines. Sur des marchés plus concurrentiels (grandes villes, métiers très demandés), comptez 4 à 8 semaines.</p>
        <p>Voici ce que rapportent nos utilisateurs :</p>

        <blockquote style={{ borderLeft: "4px solid #4338ca", paddingLeft: "24px", margin: "24px 0", fontStyle: "italic", color: "#374151" }}>
          <p>"J'ai arrêté Habitatpresto. Mon site Klientys me ramène autant de clients, sans payer de commission sur chaque devis."</p>
          <footer style={{ marginTop: "8px", fontSize: "13px", color: "#6b7280", fontStyle: "normal" }}>Karim B. — Plombier, Lyon</footer>
        </blockquote>

        <blockquote style={{ borderLeft: "4px solid #4338ca", paddingLeft: "24px", margin: "24px 0", fontStyle: "italic", color: "#374151" }}>
          <p>"J'ai quitté Superprof et je gagne 20 % de plus par heure. Mes élèves viennent maintenant tous de Google."</p>
          <footer style={{ marginTop: "8px", fontSize: "13px", color: "#6b7280", fontStyle: "normal" }}>Emma R. — Professeure particulière, Paris</footer>
        </blockquote>

        <h2>Faut-il quitter les plateformes du jour au lendemain ?</h2>
        <p>Non. La transition la plus sage est progressive : créez votre site et activez-le. Laissez Habitatpresto ou Superprof tourner en parallèle pendant 4 à 6 semaines. Quand les premiers clients arrivent directement via Google, commencez à réduire votre présence sur les plateformes — ou arrêtez simplement de renouveler votre abonnement.</p>
        <p>Vous construisez ainsi un actif qui vous appartient, sans prendre de risque à court terme sur votre chiffre d'affaires.</p>

        <h2>Conclusion</h2>
        <p>Les plateformes intermédiaires sont un bon point de départ pour un indépendant qui démarre. Elles le sont beaucoup moins pour un professionnel qui veut maximiser ses revenus et construire une clientèle qui lui appartient vraiment.</p>
        <p>Votre site sur Google, avec votre nom de domaine, vos zones d'intervention et votre agenda en ligne : c'est l'actif le plus solide que vous puissiez construire pour votre activité — et il ne prend aucune commission sur vos missions.</p>
      </ArticleLayout>
    </>
  );
}