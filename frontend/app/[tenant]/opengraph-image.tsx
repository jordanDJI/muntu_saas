import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const COLOR_HEX: Record<string, string> = {
  indigo: "#4338ca", blue: "#1e3a8a", green: "#15803d", red: "#b91c1c",
  purple: "#7e22ce", slate: "#475569", teal: "#0f766e", cyan: "#155e75",
  emerald: "#166534", amber: "#b45309", orange: "#c2410c", rose: "#be123c",
};

export default async function Image({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;

  let site: any = null;
  try {
    const res = await fetch(`${API_URL}/api/v1/public/site/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) site = await res.json();
  } catch {}

  const color = COLOR_HEX[site?.site_style?.primary_color ?? "indigo"] ?? "#4338ca";
  const title: string = site?.title ?? "Klientys";
  const tagline: string = site?.tagline ?? "";
  const zones: string[] = site?.coverage_zones?.length
    ? site.coverage_zones
    : (site?.service_area ?? []).map((a: any) => a.city).filter(Boolean);

  return new ImageResponse(
    (
      <div
        style={{
          background: color,
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
        {/* Cercle décoratif */}
        <div style={{
          position: "absolute", top: -80, right: -80,
          width: 400, height: 400, borderRadius: "50%",
          background: "rgba(255,255,255,0.08)", display: "flex",
        }} />
        <div style={{
          position: "absolute", bottom: -60, left: -60,
          width: 280, height: 280, borderRadius: "50%",
          background: "rgba(255,255,255,0.05)", display: "flex",
        }} />

        {/* Contenu */}
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", textAlign: "center", gap: "24px",
        }}>
          <div style={{
            color: "white", fontSize: 72, fontWeight: 800,
            lineHeight: 1.1, maxWidth: 900,
          }}>
            {title}
          </div>

          {tagline && (
            <div style={{
              color: "rgba(255,255,255,0.82)", fontSize: 36,
              maxWidth: 800, lineHeight: 1.3,
            }}>
              {tagline}
            </div>
          )}

          {zones.length > 0 && (
            <div style={{
              display: "flex", gap: "12px", flexWrap: "wrap",
              justifyContent: "center", marginTop: 8,
            }}>
              {zones.slice(0, 4).map((z: string) => (
                <div key={z} style={{
                  background: "rgba(255,255,255,0.18)",
                  color: "white", fontSize: 24,
                  padding: "8px 20px", borderRadius: 40,
                }}>
                  {z}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Badge Klientys */}
        <div style={{
          position: "absolute", bottom: 40, right: 60,
          color: "rgba(255,255,255,0.45)", fontSize: 22,
        }}>
          klientys.co
        </div>
      </div>
    ),
    { ...size }
  );
}
