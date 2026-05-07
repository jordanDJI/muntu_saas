"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";

export default function PreviewBanner({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await api.publishSite(siteId);
      router.push("/dashboard/appointments");
    } catch {
      setPublishing(false);
      alert("Erreur lors de la publication. Veuillez réessayer.");
    }
  };

  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 9999,
      background: "#f59e0b", color: "#1c1917",
      padding: "0.5rem 1rem",
      display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem",
      fontSize: "0.875rem", fontWeight: 600,
    }}>
      <span>👁 Mode Prévisualisation — ce site n&apos;est pas encore publié</span>
      <a
        href="/dashboard/site-builder"
        style={{
          background: "#1c1917", color: "#fef3c7",
          padding: "0.2rem 0.7rem", borderRadius: "0.375rem",
          textDecoration: "none", fontSize: "0.8rem", fontWeight: 600,
        }}
      >
        ✏️ Modifier
      </a>
      <button
        onClick={handlePublish}
        disabled={publishing}
        style={{
          background: "#15803d", color: "#fff",
          padding: "0.2rem 0.7rem", borderRadius: "0.375rem",
          border: "none", cursor: publishing ? "not-allowed" : "pointer",
          fontSize: "0.8rem", fontWeight: 600,
          opacity: publishing ? 0.7 : 1,
        }}
      >
        {publishing ? "Publication…" : "🚀 Publier"}
      </button>
    </div>
  );
}
