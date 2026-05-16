import type { Metadata } from "next";
import Link from "next/link";
import metiers from "../../data/metiers.json";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";

export const metadata: Metadata = {
  title: "Site internet pour indépendants — par métier | Klientys",
  description: "Créez votre site professionnel en 10 minutes. Choisissez votre métier et découvrez comment Klientys vous aide à être trouvé localement sur Google.",
  alternates: { canonical: `${APP_URL}/site-internet-pour` },
};

const FAMILLES: Record<string, { label: string; emoji: string }> = {
  sante:    { label: "Santé libérale",     emoji: "🩺" },
  artisan:  { label: "Artisanat & BTP",    emoji: "🔧" },
  services: { label: "Services & conseil", emoji: "💼" },
};

export default function HubSiteInternetPour() {
  const grouped = metiers.reduce<Record<string, typeof metiers>>((acc, m) => {
    (acc[m.famille] ??= []).push(m);
    return acc;
  }, {});

  return (
    <main className="min-h-screen">

      {/* Hero */}
      <section style={{
        background: "linear-gradient(160deg, rgba(13,75,88,.4) 0%, var(--l-bg2) 60%)",
        borderBottom: "1px solid var(--l-border)",
        padding: "80px 24px 64px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>
          <p style={{ fontSize: "11px", color: "var(--l-gold)", fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: "16px" }}>
            ✦ Par métier
          </p>
          <h1 style={{
            fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif",
            fontSize: "clamp(32px, 5vw, 48px)",
            fontWeight: 800,
            color: "var(--l-text)",
            lineHeight: 1.15,
            marginBottom: "20px",
          }}>
            Site internet pour{" "}
            <span style={{ background: "linear-gradient(120deg, var(--l-teal-xl), var(--l-blue), var(--l-gold))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              indépendants
            </span>
          </h1>
          <p style={{ fontSize: "17px", color: "var(--l-text-2)", lineHeight: 1.6, marginBottom: "32px" }}>
            Choisissez votre métier. Créez votre site en 10 minutes. Soyez trouvé par vos clients locaux sur Google.
          </p>
          <Link href="/onboarding" className="l-btn l-btn-primary l-btn-lg">
            Créer mon site gratuitement →
          </Link>
        </div>
      </section>

      {/* Familles de métiers */}
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "64px 24px" }}>
        {Object.entries(grouped).map(([famille, list]) => (
          <div key={famille} style={{ marginBottom: "56px" }}>
            <h2 style={{
              fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif",
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--l-text)",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}>
              <span>{FAMILLES[famille]?.emoji}</span>
              <span>{FAMILLES[famille]?.label}</span>
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
              {list.map((m) => (
                <Link
                  key={m.slug}
                  href={`/site-internet-pour/${m.slug}`}
                  className="l-link-card"
                  style={{
                    display: "block",
                    background: "var(--l-bg-card)",
                    border: "1px solid var(--l-border)",
                    borderRadius: "12px",
                    padding: "20px 24px",
                    textDecoration: "none",
                  }}
                >
                  <p style={{ fontWeight: 600, color: "var(--l-text)", marginBottom: "6px", fontSize: "15px" }}>
                    {m.label}
                  </p>
                  <p style={{ fontSize: "13px", color: "var(--l-text-3)", marginBottom: "12px", lineHeight: 1.5 }}>
                    {m.description}
                  </p>
                  <p style={{ fontSize: "12px", color: "var(--l-teal-xl)", fontWeight: 600 }}>
                    {(m.kw_monthly_fr + m.kw_monthly_be).toLocaleString()} recherches/mois →
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* CTA bas de page */}
      <section style={{
        background: "linear-gradient(160deg, rgba(13,75,88,.25) 0%, var(--l-bg) 100%)",
        borderTop: "1px solid var(--l-border)",
        padding: "80px 24px",
        textAlign: "center",
      }}>
        <h2 style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: "26px", fontWeight: 800, color: "var(--l-text)", marginBottom: "12px" }}>
          Votre métier n'est pas dans la liste ?
        </h2>
        <p style={{ color: "var(--l-text-2)", marginBottom: "32px", fontSize: "15px" }}>
          Klientys fonctionne pour tout indépendant qui couvre une zone géographique.
        </p>
        <Link href="/onboarding" className="l-btn l-btn-primary l-btn-lg">
          Essayer gratuitement →
        </Link>
      </section>
    </main>
  );
}