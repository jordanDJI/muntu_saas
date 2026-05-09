"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
