import type { Metadata } from "next";
import DemandTool from "./DemandTool";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";

export const metadata: Metadata = {
  title: "Votre métier est-il recherché dans votre région ? — Outil gratuit | Klientys",
  description:
    "Mesurez gratuitement la demande Google pour votre activité dans votre région : indice sur 12 mois, classement des régions, recherches de vos futurs clients. Résultat immédiat, sans inscription.",
  alternates: { canonical: `${APP_URL}/outils/demande-locale` },
  openGraph: {
    title: "Votre métier est-il recherché dans votre région ?",
    description: "Outil gratuit : la demande Google pour votre activité, région par région.",
    url: `${APP_URL}/outils/demande-locale`,
    type: "website",
  },
};

export default function DemandeLocalePage() {
  return (
    <main>
      <section style={{
        background: "linear-gradient(160deg, rgba(13,75,88,.4) 0%, var(--l-bg2) 60%)",
        borderBottom: "1px solid var(--l-border)",
        padding: "64px 16px 48px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <p style={{ fontSize: "11px", color: "var(--l-gold)", fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: "16px" }}>
            ✦ Outil gratuit
          </p>
          <h1 style={{
            fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif",
            fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-.02em", margin: "0 0 16px",
          }}>
            Votre métier est-il recherché dans votre région&nbsp;?
          </h1>
          <p style={{ fontSize: "16px", color: "var(--l-text-2)", lineHeight: 1.6, margin: 0 }}>
            Indiquez votre activité et votre région : vous voyez tout de suite où elle se situe face aux autres régions
            sur Google, comment évolue la demande, et ce que tapent vos futurs clients. Sans inscription.
          </p>
        </div>
      </section>

      <section style={{ padding: "40px 16px 72px" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <DemandTool />
        </div>
      </section>
    </main>
  );
}
