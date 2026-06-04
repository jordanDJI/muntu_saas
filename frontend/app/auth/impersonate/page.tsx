"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/api";

export default function ImpersonateRelayPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [otp,   setOtp]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [done,    setDone]    = useState(false);

  useEffect(() => {
    // Les params sont dans le hash pour ne jamais être envoyés au serveur
    const params = new URLSearchParams(window.location.hash.slice(1));
    const e = params.get("email");
    const o = params.get("otp");
    if (!e || !o) { setError("Lien invalide ou incomplet."); return; }
    setEmail(decodeURIComponent(e));
    setOtp(decodeURIComponent(o));
  }, []);

  const connect = async () => {
    if (!email || !otp) return;
    setLoading(true);
    setError("");
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "magiclink",
    });
    if (verifyErr) {
      setError(verifyErr.message === "Token has expired or is invalid"
        ? "Ce lien a expiré. Demande un nouveau lien depuis le panel admin."
        : verifyErr.message);
      setLoading(false);
      return;
    }
    setDone(true);
    router.replace("/dashboard");
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--l-bg, #071824)", fontFamily: "var(--font-dm-sans, sans-serif)",
    }}>
      <div style={{
        width: "100%", maxWidth: 400,
        background: "rgba(7,26,38,.92)", backdropFilter: "blur(20px)",
        border: "1px solid rgba(170,189,216,.12)", borderRadius: 20,
        padding: "36px 32px", boxShadow: "0 40px 100px rgba(0,0,0,.5)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <img src="/logo.png" alt="Klientys" style={{ height: 32 }} />
          <span style={{ fontWeight: 700, fontSize: 16, color: "#EEF2F5" }}>Klientys</span>
        </div>

        {error ? (
          <>
            <p style={{ fontSize: 13, color: "#FC8181", background: "rgba(191,51,51,.1)", border: "1px solid rgba(191,51,51,.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
              {error}
            </p>
            <a href="/admin" style={{ fontSize: 13, color: "#2A8FA5", textDecoration: "none" }}>← Retour au panel admin</a>
          </>
        ) : !email || !otp ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 28, height: 28, border: "2px solid rgba(170,189,216,.2)", borderTopColor: "#1A6E82", borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 14, color: "#8BA5B0" }}>Chargement…</p>
          </div>
        ) : done ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#4ACA7A" }}>✓ Connecté — redirection…</p>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#EEF2F5", marginBottom: 8 }}>
              Connexion admin
            </h1>
            <p style={{ fontSize: 13, color: "#8BA5B0", marginBottom: 4 }}>
              Se connecter en tant que :
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#2A8FA5", marginBottom: 24, wordBreak: "break-all" }}>
              {email}
            </p>

            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(221,170,64,.07)", border: "1px solid rgba(221,170,64,.2)", marginBottom: 24 }}>
              <p style={{ fontSize: 12, color: "#DDAA40", margin: 0 }}>
                ⚠️ Cette connexion remplace la session active dans ce navigateur.
              </p>
            </div>

            <button
              onClick={connect}
              disabled={loading}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 12,
                background: loading ? "rgba(13,75,88,.3)" : "rgba(13,75,88,.5)",
                border: "1px solid rgba(42,143,165,.4)",
                color: "#7DD8E8", fontSize: 14, fontWeight: 600,
                cursor: loading ? "wait" : "pointer",
                transition: "all .2s",
              }}
            >
              {loading ? "Connexion…" : `Se connecter en tant que ce tenant`}
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
