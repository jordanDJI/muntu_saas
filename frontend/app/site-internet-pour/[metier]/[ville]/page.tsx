import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import metiers from "../../../../data/metiers.json";
import villes from "../../../../data/villes.json";

export const revalidate = 86400;

type MetierData = typeof metiers[0];
type VilleData = typeof villes[0];

function getMetier(slug: string): MetierData | null {
  return metiers.find((m) => m.slug === slug) ?? null;
}
function getVille(slug: string): VilleData | null {
  return villes.find((v) => v.slug === slug) ?? null;
}

export async function generateStaticParams() {
  return metiers.flatMap((m) =>
    villes.map((v) => ({ metier: m.slug, ville: v.slug }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ metier: string; ville: string }>;
}): Promise<Metadata> {
  const { metier: mSlug, ville: vSlug } = await params;
  const m = getMetier(mSlug);
  const v = getVille(vSlug);
  if (!m || !v) return { title: "Page introuvable" };

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";
  const canonical = `${APP_URL}/site-internet-pour/${mSlug}/${vSlug}`;
  const title = `Site internet pour ${m.label} ${v.labelPrep} — Klientys`;
  const description = `Créez votre site professionnel de ${m.label.toLowerCase()} ${v.labelPrep} en 10 min. Agenda en ligne, zones d'intervention, agents IA. Essai gratuit.`;
  const ogImageUrl = `${APP_URL}/api/og?title=${encodeURIComponent(`${m.label} ${v.labelPrep}`)}&zone=${encodeURIComponent(v.label)}&color=indigo`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      siteName: "Klientys",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImageUrl] },
  };
}

export default async function ProgrammaticPage({
  params,
}: {
  params: Promise<{ metier: string; ville: string }>;
}) {
  const { metier: mSlug, ville: vSlug } = await params;
  const m = getMetier(mSlug);
  const v = getVille(vSlug);
  if (!m || !v) notFound();

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";
  const demandeEstimee = Math.round((m.kw_monthly_fr + m.kw_monthly_be) * (v.population / 1_000_000) * 12);
  const rayonKm = v.population > 200_000 ? 15 : v.population > 80_000 ? 20 : 30;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Klientys",
    applicationCategory: "BusinessApplication",
    description: `Site internet et agenda en ligne pour ${m.labelPlural.toLowerCase()} ${v.labelPrep}`,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", description: "Essai gratuit" },
    areaServed: { "@type": "City", name: v.label, containedInPlace: { "@type": "AdministrativeArea", name: v.region } },
    audience: { "@type": "Audience", audienceType: m.label },
  };

  const faqItems = [
    {
      q: `Combien coûte un site internet pour ${m.labelArticle} ${v.labelPrep} ?`,
      a: `Klientys propose un essai gratuit complet. Les abonnements commencent à 29 €/mois — bien moins qu'un site sur mesure (1 500–5 000 €) ou les commissions des plateformes comme ${m.comparatif} (jusqu'à 160 €/mois).`,
    },
    {
      q: `Comment être trouvé sur Google en tant que ${m.labelArticle} ${v.labelPrep} ?`,
      a: `Klientys génère automatiquement les balises SEO, le Schema.org LocalBusiness et vos zones d'intervention. La plupart des professionnels apparaissent dans les résultats locaux Google sous 2 à 4 semaines après publication.`,
    },
    {
      q: `Puis-je gérer plusieurs communes autour de ${v.label} ?`,
      a: `Oui. Vous pouvez définir jusqu'à 10 zones d'intervention. Chaque zone est affichée sur votre site et indexée par Google, ce qui vous rend visible dans un rayon d'environ ${rayonKm} km autour de ${v.label}.`,
    },
  ];

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: APP_URL },
      { "@type": "ListItem", position: 2, name: "Site internet par métier", item: `${APP_URL}/site-internet-pour` },
      { "@type": "ListItem", position: 3, name: m.label, item: `${APP_URL}/site-internet-pour/${mSlug}` },
      { "@type": "ListItem", position: 4, name: v.label, item: `${APP_URL}/site-internet-pour/${mSlug}/${vSlug}` },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <main className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* Breadcrumb */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px 24px 0", fontSize: "13px", color: "var(--l-text-3)", display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <Link href="/site-internet-pour" style={{ color: "var(--l-text-3)", textDecoration: "none" }} className="hover:text-white">Tous les métiers</Link>
        <span>/</span>
        <Link href={`/site-internet-pour/${mSlug}`} style={{ color: "var(--l-text-3)", textDecoration: "none" }} className="hover:text-white">{m.label}</Link>
        <span>/</span>
        <span style={{ color: "var(--l-text-2)" }}>{v.label}</span>
      </div>

      {/* Hero */}
      <section style={{
        background: "linear-gradient(160deg, rgba(13,75,88,.55) 0%, var(--l-bg2) 70%)",
        borderBottom: "1px solid var(--l-border)",
        padding: "80px 24px 72px",
        textAlign: "center",
        marginTop: "8px",
      }}>
        <p style={{ fontSize: "11px", color: "var(--l-gold)", fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: "16px" }}>
          ✦ Klientys — Site internet pour
        </p>
        <h1 style={{
          fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
          fontSize: "clamp(28px, 4.5vw, 48px)",
          fontWeight: 800,
          color: "var(--l-text)",
          lineHeight: 1.15,
          marginBottom: "20px",
          maxWidth: "760px",
          margin: "0 auto 20px",
        }}>
          Site internet pour {m.label.toLowerCase()} {v.labelPrep}
        </h1>
        <p style={{ fontSize: "18px", color: "var(--l-text-2)", maxWidth: "560px", margin: "0 auto 12px", lineHeight: 1.6 }}>
          Prêt en 10 minutes. Visible sur Google sous 48h.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "24px", flexWrap: "wrap", color: "var(--l-text-3)", fontSize: "13px", marginBottom: "32px" }}>
          <span>📍 Zones d'intervention affichées</span>
          <span>📅 Agenda en ligne inclus</span>
          <span>🤖 Agent IA WhatsApp</span>
        </div>
        <Link href="/onboarding" className="l-btn l-btn-primary l-btn-lg">
          Créer mon site gratuitement →
        </Link>
      </section>

      {/* Pourquoi ce métier dans cette ville */}
      <section style={{ maxWidth: "900px", margin: "0 auto", padding: "64px 24px" }}>
        <h2 style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: "24px", fontWeight: 700, color: "var(--l-text)", marginBottom: "32px" }}>
          Pourquoi {m.labelArticle} {v.labelPrep} a besoin d'un site ?
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          {m.painPoints.map((p: string, i: number) => (
            <div key={i} style={{ background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.18)", borderRadius: "12px", padding: "16px", fontSize: "14px", color: "#fca5a5" }}>
              ❌ {p}
            </div>
          ))}
        </div>
        <div style={{ background: "rgba(42,143,165,.08)", border: "1px solid rgba(42,143,165,.2)", borderRadius: "12px", padding: "24px" }}>
          <p style={{ color: "var(--l-text-2)", lineHeight: 1.7, fontSize: "15px", margin: 0 }}>
            À {v.label} ({v.population.toLocaleString()} habitants), on estime à{" "}
            <strong style={{ color: "var(--l-teal-xl)" }}>{demandeEstimee.toLocaleString()} recherches annuelles</strong>{" "}
            les requêtes du type &quot;{m.label.toLowerCase()} {v.label}&quot; et communes alentour.
            Ces recherches ont une intention d'achat de 95 % — ce sont des clients prêts à vous appeler.
          </p>
        </div>
      </section>

      {/* Ce que Klientys fait */}
      <section style={{ background: "var(--l-bg2)", borderTop: "1px solid var(--l-border)", borderBottom: "1px solid var(--l-border)", padding: "64px 24px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: "22px", fontWeight: 700, color: "var(--l-text)", marginBottom: "32px", textAlign: "center" }}>
            Ce que Klientys fait pour les {m.labelPlural.toLowerCase()} {v.labelPrep}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            {m.keyFeatures.map((f: string, i: number) => (
              <div key={i} style={{ background: "var(--l-bg-card)", border: "1px solid var(--l-border)", borderRadius: "12px", padding: "20px" }}>
                <p style={{ color: "var(--l-teal-xl)", fontWeight: 700, marginBottom: "8px" }}>✓</p>
                <p style={{ color: "var(--l-text-2)", fontSize: "14px", lineHeight: 1.6, margin: 0 }}>{f}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 étapes */}
      <section style={{ maxWidth: "900px", margin: "0 auto", padding: "64px 24px" }}>
        <h2 style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: "22px", fontWeight: 700, color: "var(--l-text)", marginBottom: "40px", textAlign: "center" }}>
          Votre site en 3 étapes
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "24px" }}>
          {[
            { n: "1", title: "Choisissez votre template", desc: `Template optimisé pour les ${m.labelPlural.toLowerCase()}` },
            { n: "2", title: `Renseignez vos zones autour de ${v.label}`, desc: `Jusqu'à 10 communes dans un rayon de ~${rayonKm} km` },
            { n: "3", title: "Publiez", desc: "Votre site est indexé par Google sous 48h" },
          ].map((step) => (
            <div key={step.n} style={{ textAlign: "center" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--l-teal)", color: "#fff", fontWeight: 800, fontSize: "20px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                {step.n}
              </div>
              <h3 style={{ fontWeight: 600, color: "var(--l-text)", marginBottom: "8px", fontSize: "15px" }}>{step.title}</h3>
              <p style={{ color: "var(--l-text-3)", fontSize: "13px" }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Témoignage */}
      <section style={{
        background: "linear-gradient(160deg, rgba(13,75,88,.45) 0%, var(--l-bg2) 100%)",
        borderTop: "1px solid var(--l-border)",
        borderBottom: "1px solid var(--l-border)",
        padding: "64px 24px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: "4px", marginBottom: "24px" }}>
            {[1,2,3,4,5].map((i) => <span key={i} style={{ color: "var(--l-gold)", fontSize: "22px" }}>★</span>)}
          </div>
          <p style={{ fontSize: "18px", fontStyle: "italic", color: "var(--l-text-2)", lineHeight: 1.7, marginBottom: "20px" }}>
            &quot;{m.testimonialQuote}&quot;
          </p>
          <p style={{ fontSize: "13px", color: "var(--l-text-3)", fontWeight: 600 }}>
            {m.testimonialName} — {m.label} à {m.testimonialCity}
          </p>
        </div>
      </section>

      {/* Comparatif */}
      <section style={{ maxWidth: "900px", margin: "0 auto", padding: "64px 24px" }}>
        <h2 style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: "22px", fontWeight: 700, color: "var(--l-text)", marginBottom: "40px", textAlign: "center" }}>
          Klientys vs {m.comparatif}
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "var(--l-bg2)" }}>
                <th style={{ textAlign: "left", padding: "12px 16px", border: "1px solid var(--l-border)", color: "var(--l-text-2)", fontWeight: 600 }}></th>
                <th style={{ padding: "12px 16px", border: "1px solid var(--l-border)", color: "var(--l-teal-xl)", fontWeight: 700, textAlign: "center" }}>Klientys</th>
                <th style={{ padding: "12px 16px", border: "1px solid var(--l-border)", color: "var(--l-text-3)", fontWeight: 600, textAlign: "center" }}>{m.comparatif}</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Site vitrine professionnel", "✅", "❌"],
                ["Zones d'intervention affichées", "✅", "❌"],
                ["Agenda de réservation", "✅", "✅"],
                ["SEO local automatique", "✅", "❌"],
                ["Agent IA WhatsApp", "✅", "❌"],
                ["Prix mensuel", "Dès 29 €/mois", "~160 €/mois"],
                ["Commission sur RDV", "0 %", "Oui"],
              ].map(([feature, klientys, comp]) => (
                <tr key={feature} style={{ borderBottom: "1px solid var(--l-border)" }}>
                  <td style={{ padding: "12px 16px", color: "var(--l-text-2)", fontWeight: 500 }}>{feature}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center", color: "#86efac", fontWeight: 500 }}>{klientys}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center", color: "var(--l-text-3)" }}>{comp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ locale */}
      <section style={{ background: "var(--l-bg2)", borderTop: "1px solid var(--l-border)", padding: "64px 24px" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: "22px", fontWeight: 700, color: "var(--l-text)", marginBottom: "32px" }}>
            Questions fréquentes
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {faqItems.map((item) => (
              <div key={item.q} style={{ background: "var(--l-bg-card)", border: "1px solid var(--l-border)", borderRadius: "12px", padding: "24px" }}>
                <h3 style={{ fontWeight: 600, color: "var(--l-text)", marginBottom: "12px", fontSize: "15px" }}>{item.q}</h3>
                <p style={{ color: "var(--l-text-2)", fontSize: "14px", lineHeight: 1.7, margin: 0 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section style={{
        background: "linear-gradient(160deg, rgba(13,75,88,.45) 0%, var(--l-bg2) 100%)",
        borderTop: "1px solid var(--l-border)",
        padding: "80px 24px",
        textAlign: "center",
      }}>
        <h2 style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: "28px", fontWeight: 800, color: "var(--l-text)", marginBottom: "12px" }}>
          Prêt à être trouvé {v.labelPrep} ?
        </h2>
        <p style={{ color: "var(--l-text-2)", marginBottom: "32px", fontSize: "15px", maxWidth: "480px", margin: "0 auto 32px" }}>
          Rejoignez les {m.labelPlural.toLowerCase()} qui utilisent Klientys pour attirer des clients locaux sans dépendre des plateformes.
        </p>
        <Link href="/onboarding" className="l-btn l-btn-primary l-btn-lg">
          Créer mon site — essai gratuit →
        </Link>
      </section>
    </main>
  );
}