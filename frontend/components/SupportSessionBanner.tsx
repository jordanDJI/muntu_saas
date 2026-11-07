"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/api";

/** Posée par /auth/impersonate dans l'onglet ouvert depuis le panel admin. */
export const SUPPORT_SESSION_KEY = "klientys_support_session";

/**
 * Bandeau affiché pendant qu'un agent Klientys est connecté à la place du
 * propriétaire : il rappelle que chaque action est faite au nom du client.
 * Lié à l'onglet (sessionStorage), il disparaît à sa fermeture.
 */
export default function SupportSessionBanner() {
  const [agent, setAgent] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SUPPORT_SESSION_KEY);
      if (raw) setAgent(JSON.parse(raw).agent || "support");
    } catch { /* stockage indisponible ou valeur corrompue : pas de bandeau */ }
  }, []);

  if (!agent) return null;

  const end = async () => {
    try { sessionStorage.removeItem(SUPPORT_SESSION_KEY); } catch { /* ignore */ }
    await supabase.auth.signOut({ scope: "local" });
    window.location.href = "/login";
  };

  return (
    <div
      role="status"
      style={{
        position: "sticky", top: 0, zIndex: 60,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap",
        padding: "8px 16px", background: "#DDAA40", color: "#07222F",
        fontSize: 13, fontWeight: 600,
      }}
    >
      <span>Session support — {agent} est connecté à la place du propriétaire. Chaque action est faite en son nom.</span>
      <button
        onClick={end}
        style={{ padding: "4px 12px", borderRadius: 8, border: "1px solid #07222F", background: "transparent", color: "#07222F", fontWeight: 700, cursor: "pointer" }}
      >
        Terminer la session
      </button>
    </div>
  );
}
