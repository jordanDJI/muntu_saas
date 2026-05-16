import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import metiers from "../../../data/metiers.json";
import villes from "../../../data/villes.json";

export const revalidate = 86400;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";

const COMPARATIF_CONS: Record<string, string[]> = {
  Doctolib: [
    "160 €/mois — sans garantie de nouveaux patients",
    "Visibilité limitée à votre ville principale uniquement",
    "Pas de site vitrine : vous dépendez de leur plateforme",
    "Zéro contrôle sur votre image et vos informations",
  ],
  Wix: [
    "Pas d'agenda intégré — il faut un outil séparé",
    "Pas de CRM : vos leads ne sont nulle part",
    "SEO local laborieux à configurer manuellement",
    "Abonnements cumulés : site + RDV + email = 50 €+/mois",
  ],
  Habitatpresto: [
    "15 à 20 % de commission sur chaque devis accepté",
    "Leads partagés avec plusieurs artisans concurrents",
    "Aucune présence propre sur Google",
    "Dépendance totale à la plateforme pour vos clients",
  ],
  "Pages Jaunes": [
    "Coût élevé pour des résultats de plus en plus faibles",
    "Annonce statique — pas de prise de RDV en ligne",
    "Aucune personnalisation de votre image professionnelle",
    "Pas de suivi des leads ni d'analytics",
  ],
  Superprof: [
    "20 % prélevés sur chaque heure de cours",
    "Profil noyé parmi des milliers d'autres profs",
    "Aucun site propre indexé sur Google",
    "Pas de système de réservation autonome",
  ],
  "Mariages.net": [
    "20 % de commission sur chaque réservation",
    "Visibilité conditionnée aux avis sur leur plateforme",
    "Pas de portfolio personnel indexé par Google",
    "Dépendance totale — si la plateforme change, vous perdez tout",
  ],
  Houzz: [
    "Plateforme principalement anglophone — peu visible localement",
    "Commission sur les projets trouvés via la plateforme",
    "Pas d'agenda ni de prise de contact directe",
    "Image partagée avec des agences de décoration haut de gamme",
  ],
};

export async function generateStaticParams() {
  return metiers.map((m) => ({ metier: m.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ metier: string }>;
}): Promise<Metadata> {
  const { metier: mSlug } = await params;
  const m = metiers.find((x) => x.slug === mSlug);
  if (!m) return { title: "Page introuvable" };

  const title = `Site internet pour ${m.label} — Klientys`;
  const description = `Créez votre site de ${m.label.toLowerCase()} en 10 min. ${m.description}. Agenda en ligne, SEO local, agent IA. Essai gratuit.`;
  const ogImageUrl = `${APP_URL}/api/og?title=${encodeURIComponent(`Site pour ${m.label}`)}&color=indigo`;

  return {
    title,
    description,
    alternates: { canonical: `${APP_URL}/site-internet-pour/${mSlug}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `${APP_URL}/site-internet-pour/${mSlug}`,
      siteName: "Klientys",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImageUrl] },
  };
}

export default async function MetierPage({
  params,
}: {
  params: Promise<{ metier: string }>;
}) {
  const { metier: mSlug } = await params;
  const m = metiers.find((x) => x.slug === mSlug);
  if (!m) notFound();

  const villesFR = villes.filter((v) => v.pays === "FR").slice(0, 20);
  const villesBE = villes.filter((v) => v.pays === "BE").slice(0, 10);

  const comparatifCons = COMPARATIF_CONS[m.comparatif] ?? [
    "Outils séparés à connecter manuellement",
    "Pas de SEO local optimisé pour votre métier",
    "Aucun agent IA pour répondre à vos clients",
    "Coûts cumulés de plusieurs abonnements",
  ];

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: APP_URL },
      { "@type": "ListItem", position: 2, name: "Site internet par métier", item: `${APP_URL}/site-internet-pour` },
      { "@type": "ListItem", position: 3, name: m.label, item: `${APP_URL}/site-internet-pour/${mSlug}` },
    ],
  };

  return (
    <main className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Breadcrumb */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px 24px 0", fontSize: "13px", color: "var(--l-text-3)", display: "flex", gap: "8px" }}>
        <Link href="/site-internet-pour" style={{ color: "var(--l-text-3)", textDecoration: "none" }} className="hover:text-white">Tous les métiers</Link>
        <span>/</span>
        <span style={{ color: "var(--l-text-2)" }}>{m.label}</span>
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
          ✦ Site internet pour
        </p>
        <h1 style={{
          fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
          fontSize: "clamp(32px, 5vw, 52px)",
          fontWeight: 800,
          color: "var(--l-text)",
          lineHeight: 1.15,
          marginBottom: "20px",
        }}>
          Site internet pour {m.label.toLowerCase()}
        </h1>
        <p style={{ fontSize: "18px", color: "var(--l-text-2)", maxWidth: "640px", margin: "0 auto 12px", lineHeight: 1.6 }}>
          {m.description} — Soyez trouvé localement sur Google.
        </p>
        <p style={{ fontSize: "13px", color: "var(--l-text-3)", marginBottom: "32px" }}>
          {(m.kw_monthly_fr + m.kw_monthly_be).toLocaleString()} recherches/mois en France et Belgique
        </p>
        <Link href="/onboarding" className="l-btn l-btn-primary l-btn-lg">
          Créer mon site gratuitement →
        </Link>
      </section>

      {/* Problèmes & atouts */}
      <section style={{ maxWidth: "900px", margin: "0 auto", padding: "64px 24px" }}>
        <h2 style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: "24px", fontWeight: 700, color: "var(--l-text)", marginBottom: "24px" }}>
          Le problème de visibilité des {m.labelPlural.toLowerCase()}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "20px" }}>
          {m.painPoints.map((p: string, i: number) => (
            <div key={i} style={{ background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.18)", borderRadius: "12px", padding: "16px", fontSize: "14px", color: "#fca5a5" }}>
              ❌ {p}
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          {m.keyFeatures.map((f: string, i: number) => (
            <div key={i} style={{ background: "rgba(22,163,74,.08)", border: "1px solid rgba(22,163,74,.18)", borderRadius: "12px", padding: "16px", fontSize: "14px", color: "#86efac" }}>
              ✅ {f}
            </div>
          ))}
        </div>
      </section>

      {/* Témoignage */}
      <section style={{
        background: "linear-gradient(160deg, rgba(13,75,88,.45) 0%, var(--l-bg2) 100%)",
        borderTop: "1px solid var(--l-border)",
        borderBottom: "1px solid var(--l-border)",
        padding: "56px 24px",
        textAlign: "center",
      }}>
        <p style={{ fontSize: "18px", fontStyle: "italic", color: "var(--l-text-2)", maxWidth: "640px", margin: "0 auto 16px", lineHeight: 1.7 }}>
          &quot;{m.testimonialQuote}&quot;
        </p>
        <p style={{ fontSize: "13px", color: "var(--l-text-3)" }}>
          {m.testimonialName} — {m.label} à {m.testimonialCity}
        </p>
      </section>

      {/* Comparaison */}
      <section style={{ maxWidth: "900px", margin: "0 auto", padding: "64px 24px" }}>
        <h2 style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: "24px", fontWeight: 700, color: "var(--l-text)", marginBottom: "8px", textAlign: "center" }}>
          Klientys vs {m.comparatif}
        </h2>
        <p style={{ textAlign: "center", color: "var(--l-text-3)", marginBottom: "40px", fontSize: "14px" }}>
          Pourquoi les {m.labelPlural.toLowerCase()} quittent {m.comparatif} pour Klientys
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
          <div style={{ background: "rgba(220,38,38,.06)", border: "1px solid rgba(220,38,38,.2)", borderRadius: "16px", padding: "24px" }}>
            <h3 style={{ fontWeight: 700, fontSize: "15px", color: "#fca5a5", marginBottom: "20px" }}>❌ {m.comparatif}</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {comparatifCons.map((con: string, i: number) => (
                <li key={i} style={{ display: "flex", gap: "8px", fontSize: "14px", color: "#fca5a5", marginBottom: "12px" }}>
                  <span style={{ flexShrink: 0 }}>✗</span>
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          </div>
          <div style={{ background: "rgba(22,163,74,.06)", border: "1px solid rgba(22,163,74,.2)", borderRadius: "16px", padding: "24px" }}>
            <h3 style={{ fontWeight: 700, fontSize: "15px", color: "#86efac", marginBottom: "20px" }}>✅ Klientys</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {m.keyFeatures.map((f: string, i: number) => (
                <li key={i} style={{ display: "flex", gap: "8px", fontSize: "14px", color: "#86efac", marginBottom: "12px" }}>
                  <span style={{ flexShrink: 0 }}>✓</span>
                  <span>{f}</span>
                </li>
              ))}
              <li style={{ display: "flex", gap: "8px", fontSize: "14px", color: "#86efac", marginBottom: "12px" }}>
                <span style={{ flexShrink: 0 }}>✓</span>
                <span>Essai 14 jours gratuit — sans carte bancaire</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Social proof */}
        <div style={{ marginTop: "40px", background: "rgba(42,143,165,.08)", border: "1px solid rgba(42,143,165,.2)", borderRadius: "16px", padding: "32px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: "20px", fontWeight: 700, color: "var(--l-teal-xl)", marginBottom: "8px" }}>
            {(m.kw_monthly_fr + m.kw_monthly_be).toLocaleString()} personnes cherchent un {m.label.toLowerCase()} chaque mois
          </p>
          <p style={{ fontSize: "14px", color: "var(--l-text-3)", marginBottom: "24px" }}>
            Chaque mois sans site, c'est autant de clients potentiels qui vont chez un concurrent.
          </p>
          <Link href="/onboarding" className="l-btn l-btn-primary">
            Créer mon site {m.label.toLowerCase()} →
          </Link>
        </div>
      </section>

      {/* Grille villes */}
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "48px 24px 64px", borderTop: "1px solid var(--l-border)" }}>
        <h2 style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: "22px", fontWeight: 700, color: "var(--l-text)", marginBottom: "8px" }}>
          Site internet pour {m.label.toLowerCase()} par ville
        </h2>
        <p style={{ fontSize: "13px", color: "var(--l-text-3)", marginBottom: "32px" }}>
          Cliquez sur votre ville pour voir les spécificités locales.
        </p>

        <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--l-text-2)", marginBottom: "12px" }}>🇫🇷 France</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px", marginBottom: "32px" }}>
          {villesFR.map((v) => (
            <Link
              key={v.slug}
              href={`/site-internet-pour/${mSlug}/${v.slug}`}
              style={{
                display: "block",
                background: "var(--l-bg-card)",
                border: "1px solid var(--l-border)",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "13px",
                textAlign: "center",
                color: "var(--l-text-2)",
                textDecoration: "none",
                transition: "border-color .15s, color .15s",
              }}
              className="hover:text-white"
            >
              {v.label}
            </Link>
          ))}
        </div>

        <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--l-text-2)", marginBottom: "12px" }}>🇧🇪 Belgique</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px" }}>
          {villesBE.map((v) => (
            <Link
              key={v.slug}
              href={`/site-internet-pour/${mSlug}/${v.slug}`}
              style={{
                display: "block",
                background: "var(--l-bg-card)",
                border: "1px solid var(--l-border)",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "13px",
                textAlign: "center",
                color: "var(--l-text-2)",
                textDecoration: "none",
                transition: "border-color .15s, color .15s",
              }}
              className="hover:text-white"
            >
              {v.label}
            </Link>
          ))}
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
          Commencez gratuitement
        </h2>
        <p style={{ color: "var(--l-text-2)", marginBottom: "32px", fontSize: "15px" }}>
          Aucune carte bancaire requise. Site en ligne en 10 minutes.
        </p>
        <Link href="/onboarding" className="l-btn l-btn-primary l-btn-lg">
          Créer mon site {m.label.toLowerCase()} →
        </Link>
      </section>
    </main>
  );
}