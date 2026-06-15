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
      // Gère les erreurs Supabase dans le hash (#error=access_denied&error_code=otp_expired...)
      const hash = window.location.hash;
      if (hash.includes("error=")) {
        const hp = new URLSearchParams(hash.slice(1));
        const code = hp.get("error_code") ?? "";
        const desc = hp.get("error_description") ?? "Erreur d'authentification";
        const msg = code === "otp_expired"
          ? "Ce lien de confirmation a expiré. Reconnectez-vous pour en recevoir un nouveau."
          : decodeURIComponent(desc.replace(/\+/g, " "));
        window.history.replaceState(null, "", "/auth/callback");
        router.replace(`/login?auth_error=${encodeURIComponent(msg)}`);
        return;
      }

      // Échange le code PKCE contre une session (email confirmation + Google OAuth + magic link)
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

      // Invitation équipe → retour sur la page /join pour acceptation
      const inviteToken = url.searchParams.get("invite");
      if (inviteToken) {
        router.replace(`/join?token=${inviteToken}`);
        return;
      }

      // Compte support → accès direct au panel admin, jamais d'onboarding
      const meta = session.user.app_metadata ?? {};
      if (meta.support_role === "viewer" || meta.support_role === "support" || meta.is_super_admin) {
        router.replace("/admin");
        return;
      }

      setMsg("Vérification de votre espace…");

      // Vérifier si l'utilisateur a déjà un tenant — avec retry (backend froid, JWKS, réseau)
      let memberships: { id: string; role: string }[] = [];
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (attempt > 0) await new Promise(r => setTimeout(r, 800 * attempt));
          const res = await fetch(`${API}/api/v1/auth/me/tenants`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            memberships = await res.json();
            break; // succès — on sort de la boucle
          }
          if (res.status === 401) break; // token invalide — inutile de retenter
        } catch { /* réseau — on retente */ }
      }

      const hasTenant = Array.isArray(memberships) && memberships.length > 0;
      const isOnlySecretary = hasTenant && memberships.every((m: any) => m.role === "secretary");

      if (hasTenant) {
        localStorage.removeItem("klientys_pending_setup");
        localStorage.removeItem("klientys_tenant_id");
        if (isOnlySecretary) {
          router.replace("/dashboard/secretary");
          return;
        }
        const provider = session.user.app_metadata?.provider;
        if (provider === "google" || provider === "linkedin_oidc" || provider === "facebook") {
          try {
            await fetch(`${API}/api/v1/auth/ensure-profile`, {
              method: "POST",
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
          } catch { /* non bloquant */ }
          const providerLabel = provider === "linkedin_oidc" ? "LinkedIn" : provider === "facebook" ? "Facebook" : "Google";
          api.logActivity({ action: "Connexion", detail: `Via ${providerLabel}` }).catch(() => {});
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
