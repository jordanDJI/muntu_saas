import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const COLORS: Record<string, string> = {
  indigo: "#4338ca",
  blue: "#1e3a8a",
  green: "#15803d",
  red: "#b91c1c",
  purple: "#7e22ce",
  slate: "#475569",
  teal: "#0f766e",
  cyan: "#155e75",
  emerald: "#166534",
  amber: "#b45309",
  orange: "#c2410c",
  rose: "#be123c",
  primary: "#4338ca",
  secondary: "#0f766e",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = (searchParams.get("title") ?? "Site professionnel").slice(0, 70);
  const zone = (searchParams.get("zone") ?? "").slice(0, 40);
  const colorName = searchParams.get("color") ?? "indigo";
  const bg = COLORS[colorName] ?? COLORS.indigo;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: bg,
          padding: "64px",
        }}
      >
        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "32px",
            opacity: 0.7,
          }}
        >
          <span style={{ color: "white", fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Klientys
          </span>
        </div>

        {/* Business name */}
        <h1
          style={{
            color: "white",
            fontSize: title.length > 40 ? "52px" : "64px",
            fontWeight: 800,
            textAlign: "center",
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
          }}
        >
          {title}
        </h1>

        {/* Zone */}
        {zone && (
          <p
            style={{
              color: "rgba(255,255,255,0.65)",
              fontSize: "28px",
              marginTop: "20px",
              textAlign: "center",
            }}
          >
            📍 {zone}
          </p>
        )}

        {/* Pills */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: "40px",
          }}
        >
          {["📅 RDV en ligne", "🤖 Agent IA", "🌐 Site professionnel"].map((label) => (
            <div
              key={label}
              style={{
                backgroundColor: "rgba(255,255,255,0.15)",
                color: "white",
                fontSize: "18px",
                padding: "10px 22px",
                borderRadius: "100px",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}