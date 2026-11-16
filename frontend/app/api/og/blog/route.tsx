import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// Image de partage des articles du blog (aperçus LinkedIn, Facebook, WhatsApp, Google).
// Charte Klientys — marine, teal, or — à la différence de /api/og, conçu pour les
// sites des tenants (ville, étiquettes de services, couleur du site).

const NAVY = "#07222F";
const TEAL = "#0D4B58";
const TEAL_L = "#1A6E82";
const GOLD = "#DDAA40";

/** Police des titres de la landing (Bricolage Grotesque), limitée aux caractères affichés. */
async function loadFont(text: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@${weight}&text=${encodeURIComponent(text)}`)
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null; // police par défaut : l'image reste générée
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = (searchParams.get("title") ?? "Le blog Klientys").slice(0, 110);
  // Majuscules calculées ici, pas par textTransform : la police n'est chargée que pour
  // les caractères listés, une majuscule générée par CSS retomberait sur la police par défaut.
  const category = (searchParams.get("category") ?? "").slice(0, 40).toLocaleUpperCase("fr-FR");
  const logoUrl = new URL("/logo.png", request.url).toString();

  const footer = "Le blog Klientys";
  const domain = "klientys.co/blog";
  const bold = await loadFont(`${title}${category}${footer}${domain}Klientys`, 700);
  const fontFamily = bold ? "Bricolage" : "sans-serif";
  const titleSize = title.length > 80 ? 50 : title.length > 50 ? 58 : 68;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundColor: NAVY,
          backgroundImage: `linear-gradient(135deg, ${NAVY} 0%, ${TEAL} 62%, ${TEAL_L} 100%)`,
          fontFamily,
        }}
      >
        {/* Marque */}
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              padding: "8px 12px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} width={83} height={48} alt="" />
          </div>
          <span style={{ color: "#FFFFFF", fontSize: "30px", fontWeight: 700, letterSpacing: "-0.01em" }}>
            Klientys
          </span>
        </div>

        {/* Catégorie + titre */}
        <div style={{ display: "flex", flexDirection: "column", maxWidth: "1020px" }}>
          {category && (
            <span
              style={{
                color: GOLD,
                fontSize: "24px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                marginBottom: "22px",
              }}
            >
              {category}
            </span>
          )}
          <span
            style={{
              color: "#FFFFFF",
              fontSize: `${titleSize}px`,
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </span>
        </div>

        {/* Pied */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ width: "56px", height: "4px", borderRadius: "2px", backgroundColor: GOLD }} />
            <span style={{ color: "rgba(255,255,255,0.78)", fontSize: "24px", fontWeight: 700 }}>{footer}</span>
          </div>
          <span style={{ color: "rgba(170,189,216,0.8)", fontSize: "22px", fontWeight: 700 }}>{domain}</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: bold ? [{ name: "Bricolage", data: bold, weight: 700, style: "normal" }] : undefined,
    },
  );
}
