import type { Metadata } from "next";
import ArticleLayout from "../../../components/ArticleLayout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";
const SLUG = "doctolib-vs-klientys-kine-infirmier";
const TITLE = "Doctolib vs Klientys : ce que les kinés et infirmiers ne savent pas";
const DESCRIPTION = "Doctolib coûte 160 €/mois et vous rend invisible en dehors de votre ville principale. Voici pourquoi de plus en plus de libéraux font le switch.";
const PUBLISHED = "2025-05-16";
const OG_IMAGE = `${APP_URL}/api/og?title=${encodeURIComponent("Doctolib vs Klientys")}&color=indigo`;

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

export default function Article() {
  return (
    <>
      {jsonLd.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <ArticleLayout
        breadcrumbLabel="Doctolib vs Klientys"
        category="Comparatifs"
        readingMinutes={6}
        publishedAt={PUBLISHED}
        title={TITLE}
        description={DESCRIPTION}
        relatedLinks={[
          { href: "/blog/cout-site-internet-independant-2025", label: "Combien coûte vraiment un site internet en 2025 ?" },
          { href: "/blog/remplir-agenda-en-ligne-sans-plateforme", label: "Agenda en ligne sans Habitatpresto ni Superprof" },
          { href: "/site-internet-pour/kinesitherapeute", label: "Site internet pour kinésithérapeute" },
          { href: "/blog", label: "← Retour au blog" },
        ]}
      >
        <p>Si vous êtes kiné, infirmier libéral, ostéopathe ou sage-femme, vous connaissez Doctolib. Peut-être que vous y êtes déjà abonné. Peut-être que vous hésitez à vous y inscrire. Dans les deux cas, cet article va vous donner des chiffres précis et un point de comparaison honnête.</p>

        <h2>Ce que Doctolib fait bien</h2>
        <p>Soyons honnêtes : Doctolib a révolutionné la prise de rendez-vous médicale en France. La plateforme a des millions d'utilisateurs actifs qui cherchent <em>directement sur Doctolib</em> — pas sur Google. Pour les médecins généralistes et spécialistes en ville, c'est un canal d'acquisition puissant.</p>
        <p>Doctolib offre aussi une application mobile bien faite pour les patients, des rappels de RDV automatiques, et une notoriété qui rassure les patients âgés moins à l'aise avec internet.</p>

        <h2>Les limites que Doctolib ne dit pas</h2>

        <h3>1. Le prix réel : 160 €/mois sans garantie</h3>
        <p>L'abonnement Doctolib pour un professionnel libéral tourne autour de <strong>160 €/mois</strong>, soit 1 920 € par an. C'est un budget marketing conséquent, avec une dépendance totale : si vous quittez la plateforme, vous perdez votre visibilité du jour au lendemain.</p>

        <h3>2. Vous êtes invisible en dehors de votre ville principale</h3>
        <p>Doctolib référence votre cabinet à votre adresse principale. Si vous êtes infirmière libérale et que vous intervenez dans 5 communes autour de Lyon, les patients de Villeurbanne ou Vénissieux qui cherchent une infirmière <em>dans leur commune</em> ne vous trouvent pas.</p>
        <p>Sur Google en revanche, une page dédiée à chaque zone d'intervention vous rend visible partout où vous travaillez.</p>

        <h3>3. Vous ne possédez pas votre présence en ligne</h3>
        <p>Sur Doctolib, vous êtes un profil parmi des milliers. Pas de site à votre nom, pas de SEO qui vous appartient, pas de page indexée sur Google sous votre identité. Si Doctolib change ses tarifs ou ferme votre segment, vous repartez de zéro.</p>

        <h3>4. Pas de CRM ni de communication autonome</h3>
        <p>Doctolib gère les RDV. Mais vos patients ne deviennent pas "vos clients" dans un sens marketing : pas de base de contacts exportable, pas d'emails automatiques personnalisés, pas d'agent IA pour répondre hors heures.</p>

        <h2>Klientys vs Doctolib : comparaison directe</h2>

        <div style={{ overflowX: "auto", margin: "24px 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "#f8f9fa" }}>
                <th style={{ textAlign: "left", padding: "12px 16px", border: "1px solid #e5e7eb", fontWeight: 600 }}>Critère</th>
                <th style={{ padding: "12px 16px", border: "1px solid #e5e7eb", color: "#4338ca", fontWeight: 700, textAlign: "center" }}>Klientys</th>
                <th style={{ padding: "12px 16px", border: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 600, textAlign: "center" }}>Doctolib</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Prix mensuel", "Dès 29,90 €/mois", "~160 €/mois"],
                ["Site vitrine à votre nom", "✅ Inclus", "❌ Non"],
                ["Zones d'intervention multiples", "✅ Jusqu'à 10 zones", "❌ Ville principale uniquement"],
                ["SEO Google à votre nom", "✅ Automatique", "❌ Profil Doctolib uniquement"],
                ["Prise de RDV en ligne", "✅ Inclus", "✅ Inclus"],
                ["Rappels automatiques", "✅ Email inclus", "✅ Email + SMS"],
                ["Agent IA (WhatsApp, Telegram)", "✅ Inclus", "❌ Non"],
                ["CRM / base clients exportable", "✅ Inclus", "❌ Non"],
                ["Commission sur les RDV", "0 %", "0 % (abonnement fixe)"],
                ["Domaine personnalisé", "✅ Inclus Pro", "❌ Non"],
              ].map(([f, k, d]) => (
                <tr key={f} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 500 }}>{f}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center", color: "#15803d", fontWeight: 500 }}>{k}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center", color: "#9ca3af" }}>{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>Quand choisir Doctolib ?</h2>
        <p>Doctolib reste pertinent si vous êtes <strong>médecin généraliste ou spécialiste en zone urbaine dense</strong>, que votre patientèle cherche activement sur la plateforme, et que le flux de patients entrants couvre largement les 160 €/mois.</p>

        <h2>Quand Klientys est meilleur pour vous ?</h2>
        <ul>
          <li>✓ Vous intervenez dans <strong>plusieurs communes</strong> (tournées infirmières, kiné à domicile, ostéo mobile)</li>
          <li>✓ Vous voulez être trouvé <strong>sur Google</strong> et pas seulement sur Doctolib</li>
          <li>✓ Vous cherchez à <strong>réduire votre dépendance</strong> à une plateforme tierce</li>
          <li>✓ Vous voulez un <strong>site à votre nom</strong>, avec votre identité visuelle</li>
          <li>✓ Votre budget est serré et 160 €/mois est difficile à justifier</li>
        </ul>

        <h2>Ce que disent nos utilisateurs qui ont switché</h2>

        <blockquote style={{ borderLeft: "4px solid #4338ca", paddingLeft: "24px", margin: "24px 0", fontStyle: "italic", color: "#374151" }}>
          <p>"Mon site Klientys me rapporte maintenant plus de nouveaux patients que Doctolib. Et je ne paie plus 160 €/mois."</p>
          <footer style={{ marginTop: "8px", fontSize: "13px", color: "#6b7280", fontStyle: "normal" }}>Thomas L. — Kinésithérapeute, Bordeaux</footer>
        </blockquote>

        <blockquote style={{ borderLeft: "4px solid #4338ca", paddingLeft: "24px", margin: "24px 0", fontStyle: "italic", color: "#374151" }}>
          <p>"En 3 semaines, 4 nouveaux patients m'ont trouvée en tapant 'infirmière' suivi de leur commune. Jamais eu ça avec Doctolib seul."</p>
          <footer style={{ marginTop: "8px", fontSize: "13px", color: "#6b7280", fontStyle: "normal" }}>Sandrine M. — Infirmière libérale, Lyon</footer>
        </blockquote>

        <h2>Conclusion</h2>
        <p>Doctolib et Klientys ne s'excluent pas forcément. Mais si vous cherchez à <strong>construire une présence en ligne qui vous appartient</strong>, être visible sur Google dans toutes vos zones, et payer un tarif proportionnel à votre activité, Klientys est une alternative sérieuse à 29,90 €/mois au lieu de 160 €.</p>
        <p>L'essai est gratuit 14 jours, sans carte bancaire. Votre site est en ligne en 15 minutes.</p>
      </ArticleLayout>
    </>
  );
}