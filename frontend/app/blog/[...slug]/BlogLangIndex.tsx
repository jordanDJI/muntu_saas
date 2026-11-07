import Link from "next/link";

// Page de liste du blog pour en / de / nl (/blog/{lang}). Le français garde
// app/blog/page.tsx, qui mêle aussi les articles statiques historiques.

export type IndexLang = "en" | "de" | "nl";

export const INDEX_T: Record<IndexLang, { title: string; description: string; kicker: string; heading: string; intro: string; read: string; empty: string; frLink: string }> = {
  en: {
    title: "Blog — Advice for independent professionals",
    description: "Practical guides and advice to grow your business online: website, online booking, customer follow-up.",
    kicker: "✦ Klientys blog",
    heading: "Advice for independent professionals",
    intro: "Practical guides, tool comparisons and strategies to grow your business without depending on platforms.",
    read: "Read the article →",
    empty: "No articles in English yet.",
    frLink: "See the articles in French →",
  },
  de: {
    title: "Blog — Tipps für Selbstständige",
    description: "Praktische Leitfäden und Tipps, um Ihr Geschäft online auszubauen: Website, Online-Terminbuchung, Kundenbetreuung.",
    kicker: "✦ Klientys-Blog",
    heading: "Tipps für Selbstständige",
    intro: "Praktische Leitfäden, Tool-Vergleiche und Strategien, um Ihr Geschäft ohne Plattformabhängigkeit auszubauen.",
    read: "Artikel lesen →",
    empty: "Noch keine Artikel auf Deutsch.",
    frLink: "Artikel auf Französisch ansehen →",
  },
  nl: {
    title: "Blog — Advies voor zelfstandigen",
    description: "Praktische gidsen en advies om uw zaak online te laten groeien: website, online afspraken, klantopvolging.",
    kicker: "✦ Klientys-blog",
    heading: "Advies voor zelfstandigen",
    intro: "Praktische gidsen, vergelijkingen van tools en strategieën om uw zaak te laten groeien zonder afhankelijk te zijn van platformen.",
    read: "Artikel lezen →",
    empty: "Nog geen artikels in het Nederlands.",
    frLink: "Bekijk de Franse artikels →",
  },
};

type Post = { slug: string; title: string; description?: string; category?: string; reading_minutes?: number; published_at?: string };

export default function BlogLangIndex({ lang, posts }: { lang: IndexLang; posts: Post[] }) {
  const t = INDEX_T[lang];
  return (
    <main className="min-h-screen" lang={lang}>
      <section style={{
        background: "linear-gradient(160deg, rgba(13,75,88,.4) 0%, var(--l-bg2) 60%)",
        borderBottom: "1px solid var(--l-border)",
        padding: "80px 24px 64px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>
          <p style={{ fontSize: "11px", color: "var(--l-gold)", fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: "16px" }}>
            {t.kicker}
          </p>
          <h1 style={{
            fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif",
            fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 800, color: "var(--l-text)", lineHeight: 1.15, marginBottom: "20px",
          }}>
            {t.heading}
          </h1>
          <p style={{ fontSize: "17px", color: "var(--l-text-2)", lineHeight: 1.6 }}>{t.intro}</p>
        </div>
      </section>

      <section style={{ maxWidth: "800px", margin: "0 auto", padding: "64px 24px" }}>
        {posts.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--l-text-2)" }}>
            <p style={{ marginBottom: "16px" }}>{t.empty}</p>
            <Link href="/blog" style={{ color: "var(--l-teal-xl)", fontWeight: 600 }}>{t.frLink}</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {posts.map((post) => (
              <Link key={post.slug} href={`/blog/${lang}/${post.slug}`} style={{ textDecoration: "none" }}>
                <div className="l-link-card" style={{ background: "var(--l-bg-card)", border: "1px solid var(--l-border)", borderRadius: "16px", padding: "32px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
                    {post.category && (
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--l-teal-xl)", background: "rgba(42,143,165,.12)", border: "1px solid rgba(42,143,165,.2)", padding: "4px 12px", borderRadius: "100px" }}>
                        {post.category}
                      </span>
                    )}
                    <span style={{ fontSize: "12px", color: "var(--l-text-3)", marginLeft: "auto" }}>
                      {post.reading_minutes ?? 5} min{post.published_at ? ` · ${post.published_at}` : ""}
                    </span>
                  </div>
                  <h2 style={{ fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif", fontSize: "20px", fontWeight: 700, color: "var(--l-text)", lineHeight: 1.3, marginBottom: "12px" }}>
                    {post.title}
                  </h2>
                  {post.description && (
                    <p style={{ fontSize: "14px", color: "var(--l-text-2)", lineHeight: 1.7, marginBottom: "20px" }}>{post.description}</p>
                  )}
                  <span style={{ fontSize: "13px", color: "var(--l-teal-xl)", fontWeight: 600 }}>{t.read}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
