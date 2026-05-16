"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Connexion en cours…");

  useEffect(() => {
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

      // Sauvegarder les tokens Google Analytics si connexion via Google
      if (session.provider_token && session.user.app_metadata?.provider === "google") {
        try {
          await fetch(`${API}/api/v1/analytics/google/connect`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              access_token: session.provider_token,
              refresh_token: session.provider_refresh_token ?? null,
            }),
          });
        } catch { /* non bloquant */ }
      }

      // Vérifier si l'utilisateur a déjà un tenant
      const { data: membership } = await supabase
        .from("membership")
        .select("id")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle();

      if (membership) {
        // Compte complet — vider le localStorage et aller au dashboard
        localStorage.removeItem("klientys_pending_setup");
        localStorage.removeItem("klientys_tenant_id");
        router.replace("/dashboard");
      } else {
        // Pas de tenant → compléter l'onboarding
        const pending = localStorage.getItem("klientys_pending_setup");
        if (pending) {
          try {
            const setup = JSON.parse(pending);
            const res = await fetch(`${API}/api/v1/onboarding/setup`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify(setup),
            });
            if (res.ok) {
              localStorage.removeItem("klientys_pending_setup");
              localStorage.removeItem("klientys_tenant_id");
              await supabase.auth.refreshSession();
              router.replace("/dashboard");
              return;
            }
          } catch { /* fallback */ }
          localStorage.removeItem("klientys_pending_setup");
          localStorage.removeItem("klientys_tenant_id");
        }
        // Connexion Google sans compte → compléter l'onboarding
        router.replace("/onboarding?from=google");
      }
    };

    handle();
  }, [router]);

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
