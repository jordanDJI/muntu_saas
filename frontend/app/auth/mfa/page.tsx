"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/api";
import { MFA_T } from "../../../lib/mfa";
import { useLanguage } from "../../../contexts/LanguageContext";

/** Saisie du code de double authentification après la connexion (passage aal1 → aal2). */
export default function MfaChallengePage() {
  const { lang } = useLanguage();
  const s = MFA_T[lang as keyof typeof MFA_T] ?? MFA_T.fr;
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const redirect = () => {
    const r = new URLSearchParams(window.location.search).get("redirect") || "/dashboard";
    // Chemin interne uniquement : pas de redirection ouverte via ?redirect=
    return r.startsWith("/") && !r.startsWith("//") ? r : "/dashboard";
  };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.replace("/login"); return; }
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2" || aal?.nextLevel !== "aal2") { window.location.replace(redirect()); return; }
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = (data?.totp ?? []).find((f) => f.status === "verified");
      if (!verified) { window.location.replace(redirect()); return; }
      setFactorId(verified.id);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (err) { setError(s.invalidCode); setBusy(false); setCode(""); return; }
    window.location.replace(redirect());
  };

  const signOut = async () => {
    await supabase.auth.signOut({ scope: "local" });
    window.location.replace("/login");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--l-bg, #071824)", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 400, background: "rgba(7,26,38,.92)", border: "1px solid rgba(170,189,216,.12)", borderRadius: 20, padding: "32px 28px" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#EEF2F5", marginBottom: 8 }}>{s.challengeTitle}</h1>
        <p style={{ fontSize: 13, color: "#8BA5B0", marginBottom: 20 }}>{s.challengeIntro}</p>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" autoFocus required minLength={6} maxLength={6}
            aria-label={s.code} placeholder="000000"
            style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(170,189,216,.25)", background: "rgba(255,255,255,.04)", color: "#EEF2F5", fontSize: 22, letterSpacing: "0.4em", textAlign: "center", fontFamily: "monospace" }}
          />
          {error && <p style={{ fontSize: 13, color: "#FC8181" }}>{error}</p>}
          <button
            type="submit" disabled={busy || !factorId || code.length !== 6}
            style={{ padding: "12px 0", borderRadius: 12, background: "rgba(13,75,88,.6)", border: "1px solid rgba(42,143,165,.4)", color: "#7DD8E8", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: busy || code.length !== 6 ? 0.6 : 1 }}
          >
            {s.verify}
          </button>
        </form>
        <button onClick={signOut} style={{ marginTop: 16, fontSize: 13, color: "#8BA5B0", background: "none", border: "none", cursor: "pointer" }}>{s.signOut}</button>
      </div>
    </div>
  );
}
