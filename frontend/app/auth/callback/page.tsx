"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, api } from "../../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Connexion en cours…");
  const ran = useRef(false); // empêche la double-exécution (StrictMode + router dep)

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const handle = async () => {
      // Échange le code PKCE contre une session (email confirmation + Google OAuth)
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMsg("Lien invalide ou expiré. Redirection…");
          setTimeout(() => router.replace("/login"), 3000);
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMsg("Session introuvable. Redirection…");
        setTimeout(() => router.replace("/login"), 2000);
        return;
      }

      setMsg("Vérification de votre espace…");

      // Vérifier si l'utilisateur a déjà un tenant via le backend (bypasse la RLS)
      let hasTenant = false;
      try {
        const res = await fetch(`${API}/api/v1/auth/me/tenants`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const tenants = await res.json();
          hasTenant = Array.isArray(tenants) && tenants.length > 0;
        }
      } catch { /* fallback : pas de tenant */ }

      if (hasTenant) {
        localStorage.removeItem("klientys_pending_setup");
        localStorage.removeItem("klientys_tenant_id");
        const provider = session.user.app_metadata?.provider;
        if (provider === "google") {
          try {
            await fetch(`${API}/api/v1/auth/ensure-profile`, {
              method: "POST",
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
          } catch { /* non bloquant */ }
          api.logActivity({ action: "Connexion", detail: "Via Google" }).catch(() => {});
        }
        router.replace("/dashboard");
        return;
      }

      // Pas de tenant → step 2 de l'onboarding (informations professionnelles)
      localStorage.removeItem("klientys_pending_setup");
      router.replace("/onboarding?no_tenant=1");
    };

    handle();
  }, []); // [] — s'exécute une seule fois, évite la double-exécution au changement de router

  return (
    <div className="d-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 32, height: 32,
          border: "3px solid var(--l-teal-xl)",
          borderTopColor: "transparent",
          borderRadius: "50%",
          margin: "0 auto 16px",
          animation: "spin 0.8s linear infinite",
        }} />
        <p style={{ color: "var(--l-text-2)", fontSize: "15px" }}>{msg}</p>
      </div>
    </div>
  );
}
