import Link from "next/link";

interface LanguageOption {
  code: string;
  label: string;
  href: string;
  active: boolean;
}

interface Props {
  breadcrumbLabel: string;
  category: string;
  categoryColor?: string;
  readingMinutes: number;
  publishedAt: string;
  title: string;
  description: string;
  children: React.ReactNode;
  ctaTitle?: string;
  ctaDesc?: string;
  relatedLinks: { href: string; label: string }[];
  languages?: LanguageOption[];
}

export default function ArticleLayout({
  breadcrumbLabel,
  category,
  categoryColor = "var(--l-teal-xl)",
  readingMinutes,
  publishedAt,
  title,
  description,
  children,
  ctaTitle = "Essayez Klientys gratuitement",
  ctaDesc = "14 jours d'essai complet. Aucune carte bancaire. Votre site en ligne en 15 minutes.",
  relatedLinks,
  languages,
}: Props) {
  return (
    <main className="min-h-screen">

      {/* Breadcrumb */}
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "24px 24px 0", fontSize: "13px", color: "var(--l-text-3)", display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <Link href="/" style={{ color: "var(--l-text-3)", textDecoration: "none" }} className="hover:text-white">Accueil</Link>
        <span>/</span>
        <Link href="/blog" style={{ color: "var(--l-text-3)", textDecoration: "none" }} className="hover:text-white">Blog</Link>
        <span>/</span>
        <span style={{ color: "var(--l-text-2)" }}>{breadcrumbLabel}</span>
      </div>

      {/* Header */}
      <header style={{
        maxWidth: "760px",
        margin: "0 auto",
        padding: "32px 24px 40px",
        borderBottom: "1px solid var(--l-border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
          <span style={{
            fontSize: "11px",
            fontWeight: 600,
            color: categoryColor,
            background: "rgba(42,143,165,.12)",
            border: "1px solid rgba(42,143,165,.2)",
            padding: "4px 12px",
            borderRadius: "100px",
          }}>
            {category}
          </span>
          <span style={{ fontSize: "12px", color: "var(--l-text-3)", marginLeft: "auto" }}>
            {readingMinutes} min de lecture · {publishedAt}
          </span>
        </div>

        {/* Sélecteur de langue — visible uniquement si l'article existe dans plusieurs langues */}
        {languages && languages.length > 1 && (
          <div style={{ display: "flex", gap: "6px", marginBottom: "20px", flexWrap: "wrap" }}>
            {languages.map((l) =>
              l.active ? (
                <span key={l.code} style={{
                  fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "100px",
                  background: "rgba(221,170,64,.15)", color: "var(--l-gold)", border: "1px solid rgba(221,170,64,.3)",
                }}>
                  {l.label}
                </span>
              ) : (
                <Link key={l.code} href={l.href} style={{
                  fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "100px",
                  background: "rgba(255,255,255,.05)", color: "var(--l-text-3)", border: "1px solid var(--l-border)",
                  textDecoration: "none",
                }}>
                  {l.label}
                </Link>
              )
            )}
          </div>
        )}

        <h1 style={{
          fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
          fontSize: "clamp(26px, 4vw, 38px)",
          fontWeight: 800,
          color: "var(--l-text)",
          lineHeight: 1.2,
          marginBottom: "20px",
        }}>
          {title}
        </h1>
        <p style={{ fontSize: "17px", color: "var(--l-text-2)", lineHeight: 1.65 }}>{description}</p>
      </header>

      {/* Article body — carte blanche pour la lisibilité */}
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "0 24px 64px" }}>
        <div style={{
          background: "rgba(255,255,255,0.97)",
          color: "#111",
          borderRadius: "16px",
          padding: "clamp(28px, 5vw, 56px)",
          marginTop: "32px",
          lineHeight: 1.75,
          fontSize: "16px",
        }}>
          {children}
        </div>
      </div>

      {/* CTA */}
      <section style={{
        background: "linear-gradient(160deg, rgba(13,75,88,.45) 0%, var(--l-bg2) 100%)",
        borderTop: "1px solid var(--l-border)",
        padding: "80px 24px",
        textAlign: "center",
      }}>
        <h2 style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: "28px", fontWeight: 800, color: "var(--l-text)", marginBottom: "12px" }}>
          {ctaTitle}
        </h2>
        <p style={{ color: "var(--l-text-2)", marginBottom: "8px", fontSize: "15px", maxWidth: "480px", margin: "0 auto 32px" }}>
          {ctaDesc}
        </p>
        <Link href="/onboarding" className="l-btn l-btn-primary l-btn-lg">
          Créer mon site gratuitement →
        </Link>
      </section>

      {/* Articles liés */}
      <section style={{ maxWidth: "760px", margin: "0 auto", padding: "56px 24px" }}>
        <h2 style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: "18px", fontWeight: 700, color: "var(--l-text)", marginBottom: "20px" }}>
          Articles liés
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
          {relatedLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: "block",
                background: "var(--l-bg-card)",
                border: "1px solid var(--l-border)",
                borderRadius: "12px",
                padding: "16px 20px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--l-teal-xl)",
                textDecoration: "none",
                transition: "border-color .2s",
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}