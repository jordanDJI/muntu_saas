import type { Metadata } from "next";
import Link from "next/link";
import { ARTICLES } from "./_articles";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getDbArticles() {
  try {
    const res = await fetch(`${API}/api/v1/public/blog`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    return res.json() as Promise<{ slug: string; title: string; description: string; category: string; metier?: string; reading_minutes: number; published_at: string }[]>;
  } catch {
    return [];
  }
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";

export const metadata: Metadata = {
  title: "Blog — Conseils pour indépendants | Klientys",
  description: "Guides pratiques, comparatifs et conseils pour développer votre activité en ligne. Pour kinés, artisans, infirmiers et tous les indépendants.",
  alternates: { canonical: `${APP_URL}/blog` },
  openGraph: {
    title: "Blog Klientys — Conseils pour indépendants",
    description: "Guides pratiques, comparatifs et conseils pour développer votre activité en ligne.",
    url: `${APP_URL}/blog`,
    type: "website",
    siteName: "Klientys",
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  "Comparatifs": "var(--l-teal-xl)",
  "Prix & ROI": "var(--l-gold)",
  "Acquisition clients": "var(--l-blue-l)",
};

export default async function BlogIndex() {
  const dbArticles = await getDbArticles();
  const dbSlugs = new Set(dbArticles.map((a) => a.slug));

  // DB prend la priorité ; les articles statiques sans équivalent DB complètent la liste
  const staticFallback = ARTICLES.filter((a) => !dbSlugs.has(a.slug)).map((a) => ({
    slug: a.slug, title: a.title, description: a.description,
    category: a.category, metier: a.metier, reading_minutes: a.readingMinutes, published_at: a.publishedAt,
  }));
  const allArticles = [...dbArticles, ...staticFallback];

  return (
    <main className="min-h-screen">

      {/* Header */}
      <section style={{
        background: "linear-gradient(160deg, rgba(13,75,88,.4) 0%, var(--l-bg2) 60%)",
        borderBottom: "1px solid var(--l-border)",
        padding: "80px 24px 64px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>
          <p style={{ fontSize: "11px", color: "var(--l-gold)", fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: "16px" }}>
            ✦ Blog Klientys
          </p>
          <h1 style={{
            fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif",
            fontSize: "clamp(32px, 5vw, 48px)",
            fontWeight: 800,
            color: "var(--l-text)",
            lineHeight: 1.15,
            marginBottom: "20px",
          }}>
            Conseils pour{" "}
            <span style={{ background: "linear-gradient(120deg, var(--l-teal-xl), var(--l-blue), var(--l-gold))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              indépendants
            </span>
          </h1>
          <p style={{ fontSize: "17px", color: "var(--l-text-2)", lineHeight: 1.6 }}>
            Guides pratiques, comparatifs outils et stratégies pour développer votre activité sans dépendre des plateformes.
          </p>
        </div>
      </section>

      {/* Articles */}
      <section style={{ maxWidth: "800px", margin: "0 auto", padding: "64px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {allArticles.map((article) => (
            <Link
              key={article.slug}
              href={`/blog/${article.slug}`}
              style={{ textDecoration: "none" }}
            >
              <div
                className="l-link-card"
                style={{
                  background: "var(--l-bg-card)",
                  border: "1px solid var(--l-border)",
                  borderRadius: "16px",
                  padding: "32px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: CATEGORY_COLORS[article.category] ?? "var(--l-teal-xl)",
                    background: "rgba(42,143,165,.12)",
                    border: "1px solid rgba(42,143,165,.2)",
                    padding: "4px 12px",
                    borderRadius: "100px",
                  }}>
                    {article.category}
                  </span>
                  {article.metier && (
                    <span style={{ fontSize: "11px", color: "var(--l-text-3)", background: "rgba(255,255,255,.05)", border: "1px solid var(--l-border)", padding: "4px 12px", borderRadius: "100px" }}>
                      {article.metier}
                    </span>
                  )}
                  <span style={{ fontSize: "12px", color: "var(--l-text-3)", marginLeft: "auto" }}>
                    {article.reading_minutes} min · {article.published_at}
                  </span>
                </div>

                <h2 style={{
                  fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif",
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "var(--l-text)",
                  lineHeight: 1.3,
                  marginBottom: "12px",
                }}>
                  {article.title}
                </h2>
                <p style={{ fontSize: "14px", color: "var(--l-text-2)", lineHeight: 1.7, marginBottom: "20px" }}>
                  {article.description}
                </p>
                <span style={{ fontSize: "13px", color: "var(--l-teal-xl)", fontWeight: 600 }}>
                  Lire l'article →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{
        borderTop: "1px solid var(--l-border)",
        padding: "80px 24px",
        textAlign: "center",
        background: "linear-gradient(160deg, rgba(13,75,88,.25) 0%, var(--l-bg) 100%)",
      }}>
        <h2 style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: "28px", fontWeight: 800, color: "var(--l-text)", marginBottom: "12px" }}>
          Prêt à développer votre activité ?
        </h2>
        <p style={{ color: "var(--l-text-2)", marginBottom: "32px", fontSize: "15px" }}>
          Site + RDV + CRM en 15 minutes. Sans carte bancaire.
        </p>
        <Link href="/onboarding" className="l-btn l-btn-primary l-btn-lg">
          Créer mon site gratuitement →
        </Link>
      </section>
    </main>
  );
}