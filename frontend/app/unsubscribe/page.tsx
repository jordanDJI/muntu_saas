"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type State = "loading" | "success" | "error";

function UnsubscribeContent() {
  const params = useSearchParams();
  const token = params.get("t");
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (!token) { setState("error"); return; }
    fetch(`${API_URL}/api/v1/campaigns/unsubscribe?t=${encodeURIComponent(token)}`)
      .then((r) => { setState(r.ok ? "success" : "error"); })
      .catch(() => setState("error"));
  }, [token]);

  return (
    <>
      {state === "loading" && (
        <>
          <div style={{
            width: "48px", height: "48px", border: "4px solid #e5e7eb",
            borderTopColor: "#0D4B58", borderRadius: "50%",
            margin: "0 auto 20px", animation: "spin 0.8s linear infinite",
          }} />
          <p style={{ color: "#6b7280", fontSize: "15px" }}>Traitement en cours…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
      )}

      {state === "success" && (
        <>
          <div style={{
            width: "56px", height: "56px", borderRadius: "50%",
            background: "#f0fdf4", margin: "0 auto 20px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="28" height="28" fill="none" stroke="#16a34a" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 style={{ fontSize: "20px", fontWeight: "700", color: "#111827", marginBottom: "12px" }}>
            Vous avez été désabonné
          </h1>
          <p style={{ color: "#6b7280", fontSize: "14px", lineHeight: "1.6", marginBottom: "28px" }}>
            Vous ne recevrez plus d&apos;emails marketing de ce professionnel.
            <br />
            Les emails de confirmation de rendez-vous ou de rappels resteront actifs.
          </p>
          <p style={{ color: "#9ca3af", fontSize: "12px" }}>
            Une erreur ? Contactez directement le professionnel.
          </p>
        </>
      )}

      {state === "error" && (
        <>
          <div style={{
            width: "56px", height: "56px", borderRadius: "50%",
            background: "#fef2f2", margin: "0 auto 20px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="28" height="28" fill="none" stroke="#dc2626" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 style={{ fontSize: "20px", fontWeight: "700", color: "#111827", marginBottom: "12px" }}>
            Lien invalide
          </h1>
          <p style={{ color: "#6b7280", fontSize: "14px", lineHeight: "1.6", marginBottom: "28px" }}>
            Ce lien de désabonnement est invalide ou a déjà été utilisé.
          </p>
        </>
      )}

      <Link href="/" style={{ color: "#0D4B58", fontSize: "13px", textDecoration: "none" }}>
        ← Retour à l&apos;accueil
      </Link>
    </>
  );
}

export default function UnsubscribePage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg,#07222F 0%,#0D4B58 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui,sans-serif",
      padding: "24px",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: "20px",
        padding: "48px 40px",
        maxWidth: "420px",
        width: "100%",
        textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{ marginBottom: "24px" }}>
          <span style={{ fontSize: "28px", fontWeight: "800", color: "#07222F", letterSpacing: "-0.5px" }}>
            Klientys
          </span>
        </div>
        <Suspense fallback={<p style={{ color: "#6b7280" }}>Chargement…</p>}>
          <UnsubscribeContent />
        </Suspense>
      </div>
    </div>
  );
}
