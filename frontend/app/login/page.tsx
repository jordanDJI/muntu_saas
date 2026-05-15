"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.replace("/dashboard");
    });
  }, []);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Délai dépassé. Vérifiez votre connexion internet.")), 12000)
    );
    try {
      const { error } = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        timeout,
      ]) as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
      if (error) {
        setError(error.message);
      } else {
        window.location.replace("/dashboard");
      }
    } catch (err: any) {
      setError(err?.message ?? "Erreur de connexion. Vérifiez votre réseau.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "email profile https://www.googleapis.com/auth/analytics.readonly",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  };

  return (
    <div className="d-page">
      <div style={{ width: "100%", maxWidth: "440px", marginTop: "40px" }}>
        <div className="d-card">
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "10px", textDecoration: "none", marginBottom: "20px" }}>
              <img src="/logo.png" alt="Klientys" style={{ height: "36px", width: "auto" }} />
              <span style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: "20px", color: "var(--l-text)" }}>Klientys</span>
            </Link>
            <h1 style={{ fontSize: "22px", fontWeight: 800, fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", marginBottom: "6px", color: "var(--l-text)" }}>
              Connexion
            </h1>
            <p style={{ color: "var(--l-text-2)", fontSize: "14px", margin: 0 }}>Accédez à votre tableau de bord</p>
          </div>

          {/* Google sign-in */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              padding: "10px 16px", borderRadius: "8px", border: "1px solid var(--l-border)",
              background: "var(--l-card)", color: "var(--l-text)", fontSize: "14px", fontWeight: 500,
              cursor: googleLoading ? "wait" : "pointer", opacity: googleLoading ? 0.6 : 1,
              transition: "opacity .2s",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.16C6.51 42.62 14.62 48 24 48z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.5-1.45-.78-3-.78-4.59s.27-3.14.78-4.59l-7.98-6.16C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.75l7.97-6.16z"/>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.97 6.16C12.43 13.72 17.74 9.5 24 9.5z"/>
            </svg>
            {googleLoading ? "Redirection…" : "Continuer avec Google"}
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0" }}>
            <div style={{ flex: 1, height: "1px", background: "var(--l-border)" }} />
            <span style={{ fontSize: "12px", color: "var(--l-text-3)" }}>ou</span>
            <div style={{ flex: 1, height: "1px", background: "var(--l-border)" }} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <input
              className="d-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="d-input"
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p style={{ color: "#FC8181", fontSize: "13px", margin: 0 }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="l-btn l-btn-primary"
              style={{ width: "100%", justifyContent: "center", marginTop: "4px", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Connexion…" : "Se connecter →"}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: "13px", color: "var(--l-text-2)", marginTop: "24px", marginBottom: 0 }}>
            Pas encore de compte ?{" "}
            <Link href="/onboarding" style={{ color: "var(--l-teal-xl)", textDecoration: "none", fontWeight: 600 }}>
              Créer mon espace
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
