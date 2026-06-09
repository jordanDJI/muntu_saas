"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/api";

type Step = "loading" | "form" | "success" | "error";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const ran = useRef(false);

  // Guard : empêche la double-exécution React StrictMode (consomme le code deux fois)
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) {
      setStep("error");
      setErrorMsg("Lien invalide ou expiré. Demandez un nouveau lien depuis la page de connexion.");
      return;
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setStep("error");
        setErrorMsg("Ce lien est expiré ou a déjà été utilisé. Demandez un nouveau lien.");
      } else {
        setStep("form");
      }
    });
  }, []);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirm) {
      setErrorMsg("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setErrorMsg("");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setErrorMsg(error.message);
    } else {
      setStep("success");
      setTimeout(() => router.replace("/dashboard"), 3000);
    }
  };

  const inputStyle: React.CSSProperties = {
    display: "block", width: "100%", background: "rgba(255,255,255,.05)",
    border: "1px solid rgba(170,189,216,.18)", borderRadius: "10px",
    padding: "11px 14px", fontSize: "14px", color: "var(--l-text)",
    outline: "none", transition: "border-color .2s, box-shadow .2s",
    boxSizing: "border-box",
  };

  return (
    <div style={{
      minHeight: "100vh", background: "var(--l-bg)", display: "flex",
      alignItems: "center", justifyContent: "center", position: "relative",
      overflow: "hidden", fontFamily: "var(--font-dm-sans),'DM Sans',sans-serif",
      padding: "80px 16px 40px",
    }}>
      {/* Orbe de fond */}
      <div style={{
        position: "absolute", width: "600px", height: "600px", borderRadius: "50%",
        top: "-150px", left: "-200px",
        background: "radial-gradient(circle, rgba(13,75,88,.7) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Bouton retour */}
      <Link href="/login" style={{
        position: "absolute", top: "20px", left: "20px",
        display: "inline-flex", alignItems: "center", gap: "6px",
        fontSize: "13px", fontWeight: 500, color: "var(--l-text-2)",
        textDecoration: "none", padding: "8px 14px",
        border: "1px solid var(--l-border)", borderRadius: "100px",
        background: "rgba(255,255,255,.04)", backdropFilter: "blur(8px)",
        zIndex: 10,
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Connexion
      </Link>

      <div style={{
        width: "100%", maxWidth: "420px", position: "relative", zIndex: 5,
      }}>
        <div style={{
          background: "rgba(7,26,38,.88)", backdropFilter: "blur(24px)",
          border: "1px solid rgba(170,189,216,.12)",
          borderRadius: "20px", padding: "40px 36px",
          boxShadow: "0 40px 120px rgba(0,0,0,.5), 0 0 0 1px rgba(170,189,216,.06)",
        }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "10px", textDecoration: "none", marginBottom: "20px" }}>
              <img src="/logo.png" alt="Klientys" style={{ height: "32px", width: "auto" }} />
              <span style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontWeight: 700, fontSize: "18px", color: "var(--l-text)",
              }}>Klientys</span>
            </Link>
          </div>

          {step === "loading" && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%", margin: "0 auto 12px",
                border: "2px solid rgba(170,189,216,.2)", borderTopColor: "var(--l-teal-xl)",
                animation: "spin 0.8s linear infinite",
              }} />
              <p style={{ color: "var(--l-text-2)", fontSize: "14px", margin: 0 }}>Vérification du lien…</p>
            </div>
          )}

          {step === "error" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "36px", marginBottom: "16px" }}>⚠️</div>
              <h1 style={{
                fontSize: "20px", fontWeight: 800, color: "var(--l-text)",
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                marginBottom: "10px",
              }}>Lien invalide</h1>
              <p style={{ color: "var(--l-text-2)", fontSize: "14px", marginBottom: "24px" }}>{errorMsg}</p>
              <Link href="/login" className="l-btn l-btn-primary" style={{ display: "inline-flex", justifyContent: "center" }}>
                Retour à la connexion
              </Link>
            </div>
          )}

          {step === "success" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "36px", marginBottom: "16px" }}>✅</div>
              <h1 style={{
                fontSize: "20px", fontWeight: 800, color: "var(--l-text)",
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                marginBottom: "10px",
              }}>Mot de passe mis à jour</h1>
              <p style={{ color: "var(--l-text-2)", fontSize: "14px", margin: 0 }}>
                Redirection vers votre tableau de bord…
              </p>
            </div>
          )}

          {step === "form" && (
            <>
              <h1 style={{
                fontSize: "22px", fontWeight: 800,
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                marginBottom: "6px", color: "var(--l-text)", letterSpacing: "-.02em",
                textAlign: "center",
              }}>
                Nouveau mot de passe
              </h1>
              <p style={{ color: "var(--l-text-2)", fontSize: "14px", textAlign: "center", marginBottom: "24px" }}>
                Choisissez un mot de passe sécurisé (8 caractères minimum).
              </p>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Champ mot de passe avec toggle */}
                <div style={{ position: "relative" }}>
                  <input
                    type={showPwd ? "text" : "password"}
                    placeholder="Nouveau mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                    style={{ ...inputStyle, paddingRight: "42px" }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "var(--l-teal-xl)";
                      e.target.style.boxShadow = "0 0 0 3px rgba(42,143,165,.15)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "rgba(170,189,216,.18)";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPwd(v => !v)}
                    style={{
                      position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", padding: "4px",
                      color: "rgba(170,189,216,.5)",
                    }}
                  >
                    {showPwd
                      ? <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
                {/* Confirmation */}
                <div style={{ position: "relative" }}>
                  <input
                    type={showPwd ? "text" : "password"}
                    placeholder="Confirmer le mot de passe"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    style={{
                      ...inputStyle,
                      borderColor: confirm && confirm === password ? "rgba(74,202,122,.5)" : "rgba(170,189,216,.18)",
                    }}
                    onFocus={(e) => {
                      if (!(confirm && confirm === password)) {
                        e.target.style.borderColor = "var(--l-teal-xl)";
                        e.target.style.boxShadow = "0 0 0 3px rgba(42,143,165,.15)";
                      }
                    }}
                    onBlur={(e) => {
                      if (!(confirm && confirm === password)) {
                        e.target.style.borderColor = "rgba(170,189,216,.18)";
                        e.target.style.boxShadow = "none";
                      }
                    }}
                  />
                  {confirm && confirm === password && (
                    <span style={{
                      position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                      fontSize: "14px", color: "#4ACA7A",
                    }}>✓</span>
                  )}
                </div>
                {errorMsg && (
                  <p style={{
                    color: "#FC8181", fontSize: "13px", margin: 0,
                    background: "rgba(191,51,51,.1)", border: "1px solid rgba(191,51,51,.25)",
                    borderRadius: "8px", padding: "8px 12px",
                  }}>{errorMsg}</p>
                )}
                <button
                  type="submit"
                  disabled={saving || !password || password !== confirm}
                  className="l-btn l-btn-primary"
                  style={{ width: "100%", justifyContent: "center", marginTop: "4px", opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? "Mise à jour…" : "Enregistrer le mot de passe"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
