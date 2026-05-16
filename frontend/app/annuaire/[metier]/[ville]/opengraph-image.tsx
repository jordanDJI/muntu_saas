import { ImageResponse } from "next/og";
import metiers from "../../../../data/metiers.json";
import villes from "../../../../data/villes.json";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ metier: string; ville: string }>;
}) {
  const { metier: mSlug, ville: vSlug } = await params;
  const m = metiers.find((x) => x.slug === mSlug);
  const v = villes.find((x) => x.slug === vSlug);

  const title = m && v ? `${m.labelPlural} ${v.labelPrep}` : "Annuaire professionnel";
  const subtitle = "Profils vérifiés · Prise de RDV en ligne";

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #4338ca 0%, #1e3a8a 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px",
          position: "relative",
        }}
      >
        {/* Cercles décoratifs */}
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -80,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.07)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -60,
            left: -60,
            width: 280,
            height: 280,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
            display: "flex",
          }}
        />

        {/* Badge annuaire */}
        <div
          style={{
            background: "rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.9)",
            fontSize: 22,
            padding: "8px 24px",
            borderRadius: 40,
            marginBottom: 32,
            display: "flex",
          }}
        >
          Annuaire Klientys
        </div>

        {/* Titre principal */}
        <div
          style={{
            color: "white",
            fontSize: 68,
            fontWeight: 800,
            lineHeight: 1.1,
            textAlign: "center",
            maxWidth: 900,
            display: "flex",
          }}
        >
          {title}
        </div>

        {/* Sous-titre */}
        <div
          style={{
            color: "rgba(255,255,255,0.72)",
            fontSize: 30,
            marginTop: 24,
            textAlign: "center",
            display: "flex",
          }}
        >
          {subtitle}
        </div>

        {/* Badge Klientys */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            right: 60,
            color: "rgba(255,255,255,0.4)",
            fontSize: 22,
            display: "flex",
          }}
        >
          klientys.co
        </div>
      </div>
    ),
    { ...size }
  );
}