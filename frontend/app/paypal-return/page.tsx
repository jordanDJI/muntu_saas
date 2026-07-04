"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function PaypalReturnPage() {
  const params = useSearchParams();
  const status = params.get("status");
  const slug = params.get("slug");

  const [icon, setIcon] = useState("⏳");
  const [title, setTitle] = useState("Traitement en cours…");
  const [subtitle, setSubtitle] = useState("Veuillez patienter.");
  const [color, setColor] = useState("#0D4B58");

  useEffect(() => {
    if (status === "success") {
      setIcon("✅");
      setTitle("Paiement reçu !");
      setSubtitle(
        "Votre acompte a bien été encaissé. Vous recevrez une confirmation de votre rendez-vous dès validation par le professionnel."
      );
      setColor("#16a34a");
    } else if (status === "cancelled") {
      setIcon("↩️");
      setTitle("Paiement annulé");
      setSubtitle(
        "Vous avez annulé le paiement. Votre rendez-vous n'a pas été enregistré. Vous pouvez reprendre la réservation depuis le début."
      );
      setColor("#d97706");
    } else if (status === "error") {
      setIcon("❌");
      setTitle("Erreur de paiement");
      setSubtitle(
        "Le paiement n'a pas pu être traité. Veuillez réessayer ou contacter directement le professionnel."
      );
      setColor("#dc2626");
    }
  }, [status]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#071824",
      padding: "2rem",
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{
        background: "#0D1B25",
        border: "1px solid rgba(170,189,216,0.10)",
        borderRadius: "1rem",
        padding: "3rem 2.5rem",
        maxWidth: 440,
        width: "100%",
        textAlign: "center",
      }}>
        <div style={{ fontSize: "3.5rem", marginBottom: "1.25rem" }}>{icon}</div>
        <h1 style={{ color, fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>
          {title}
        </h1>
        <p style={{ color: "#8baabe", fontSize: "1rem", lineHeight: 1.6, marginBottom: "2rem" }}>
          {subtitle}
        </p>

        {slug && status === "success" && (
          <Link
            href={`/${slug}`}
            style={{
              display: "inline-block",
              background: "#0D4B58",
              color: "#fff",
              padding: "0.75rem 2rem",
              borderRadius: "0.5rem",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.95rem",
            }}
          >
            Retour au site
          </Link>
        )}

        {status !== "success" && (
          <button
            onClick={() => window.history.back()}
            style={{
              background: "transparent",
              border: "1px solid rgba(170,189,216,0.25)",
              color: "#8baabe",
              padding: "0.65rem 1.75rem",
              borderRadius: "0.5rem",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            ← Retour
          </button>
        )}
      </div>

      <p style={{ color: "#3d5a6a", fontSize: "0.8rem", marginTop: "1.5rem" }}>
        Klientys — paiement sécurisé via PayPal
      </p>
    </div>
  );
}
