"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, api } from "../../lib/api";
import { useLanguage, LangSelector } from "../../contexts/LanguageContext";

const LOCKOUT_KEY = "klientys_login_lockout";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 60 * 1000;

function getLockout(): { attempts: number; until: number } {
  try {
    return JSON.parse(localStorage.getItem(LOCKOUT_KEY) || "{}");
  } catch { return { attempts: 0, until: 0 }; }
}
function setLockout(data: { attempts: number; until: number }) {
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify(data));
}

export default function LoginPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const redirectAfterLogin = typeof window !== "undefined"
    ? (new URLSearchParams(window.location.search).get("redirect") ?? "/dashboard")
    : "/dashboard";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkedInLoading, setLinkedInLoading] = useState(false);
  const [facebookLoading, setFacebookLoading] = useState(false);
  const [lockedMins, setLockedMins] = useState(0);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const authError = p.get("auth_error");
    if (authError) setError(decodeURIComponent(authError));
  }, []);

  useEffect(() => {
    const check = () => {
      const { until } = getLockout();
      const remaining = until - Date.now();
      if (remaining > 0) {
        setLockedMins(Math.ceil(remaining / 60000));
      } else {
        setLockedMins(0);
      }
    };
    check();
    const iv = setInterval(check, 10000);
    return () => clearInterval(iv);
  }, []);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const lockout = getLockout();
    if (lockout.until > Date.now()) {
      const mins = Math.ceil((lockout.until - Date.now()) / 60000);
      setLockedMins(mins);
      setError(t.login_locked.replace("{m}", String(mins)));
      return;
    }
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
        const attempts = (lockout.attempts || 0) + 1;
        if (attempts >= MAX_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_MS;
          setLockout({ attempts, until });
          setLockedMins(30);
          setError(t.login_locked.replace("{m}", "30"));
        } else {
          setLockout({ attempts, until: 0 });
          setError(error.message);
        }
      } else {
        setLockout({ attempts: 0, until: 0 });
        api.logActivity({ action: "Connexion", detail: "Via email/mot de passe" }).catch(() => {});
        window.location.replace(redirectAfterLogin);
      }
    } catch (err: any) {
      setError(err?.message ?? "Erreur de connexion. Vérifiez votre réseau.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setForgotError("");
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setForgotLoading(false);
    if (error) {
      setForgotError(error.message);
    } else {
      setForgotSent(true);
    }
  };

  const handleLinkedIn = async () => {
    setLinkedInLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "linkedin_oidc",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "openid profile email",
      },
    });
  };

  const handleFacebook = async () => {
    setFacebookLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "email",
      },
    });
  };

  return (
    <>
      <style>{`
        @keyframes login-orb1 {
          0%,100% { transform: translate(0,0) scale(1); opacity:.55; }
          33%      { transform: translate(40px,-30px) scale(1.08); opacity:.7; }
          66%      { transform: translate(-20px,20px) scale(.95); opacity:.5; }
        }
        @keyframes login-orb2 {
          0%,100% { transform: translate(0,0) scale(1); opacity:.35; }
          40%      { transform: translate(-50px,30px) scale(1.12); opacity:.5; }
          75%      { transform: translate(30px,-40px) scale(.9); opacity:.3; }
        }
        @keyframes login-orb3 {
          0%,100% { transform: translate(0,0) scale(1); opacity:.25; }
          50%      { transform: translate(25px,35px) scale(1.15); opacity:.4; }
        }
        @keyframes login-float1 {
          0%,100% { transform: translateY(0) rotate(-2deg); }
          50%      { transform: translateY(-14px) rotate(1deg); }
        }
        @keyframes login-float2 {
          0%,100% { transform: translateY(0) rotate(1deg); }
          50%      { transform: translateY(-10px) rotate(-2deg); }
        }
        @keyframes login-float3 {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        @keyframes login-card-in {
          from { opacity:0; transform: translateY(24px) scale(.98); }
          to   { opacity:1; transform: none; }
        }
        @keyframes login-particle {
          0%   { transform: translateY(0) translateX(0); opacity:0; }
          10%  { opacity:1; }
          90%  { opacity:.6; }
          100% { transform: translateY(-120px) translateX(20px); opacity:0; }
        }
        .login-particle {
          position:absolute;
          width:2px; height:2px;
          border-radius:50%;
          background:var(--l-teal-xl);
          animation: login-particle linear infinite;
        }
      `}</style>

      <div style={{
        minHeight: "100vh", background: "var(--l-bg)", display: "flex",
        alignItems: "center", justifyContent: "center", position: "relative",
        overflow: "hidden", fontFamily: "var(--font-dm-sans),'DM Sans',sans-serif",
        padding: "80px 16px 40px",
      }}>

        {/* ── Orbes de fond animées ── */}
        <div style={{
          position: "absolute", width: "600px", height: "600px",
          borderRadius: "50%", top: "-150px", left: "-200px",
          background: "radial-gradient(circle, rgba(13,75,88,.7) 0%, transparent 70%)",
          animation: "login-orb1 12s ease-in-out infinite",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", width: "500px", height: "500px",
          borderRadius: "50%", bottom: "-100px", right: "-150px",
          background: "radial-gradient(circle, rgba(170,189,216,.18) 0%, transparent 70%)",
          animation: "login-orb2 16s ease-in-out infinite",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", width: "350px", height: "350px",
          borderRadius: "50%", top: "50%", left: "60%",
          background: "radial-gradient(circle, rgba(221,170,64,.12) 0%, transparent 70%)",
          animation: "login-orb3 10s ease-in-out infinite",
          pointerEvents: "none",
        }} />

        {/* ── Grille subtile ── */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "linear-gradient(rgba(170,189,216,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(170,189,216,.07) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 70% 80% at 50% 50%, black 20%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 80% at 50% 50%, black 20%, transparent 75%)",
        }} />

        {/* ── Particules flottantes ── */}
        {[
          { left:"18%", bottom:"20%", delay:"0s",  dur:"7s",  color:"var(--l-teal-xl)" },
          { left:"72%", bottom:"15%", delay:"2s",  dur:"9s",  color:"var(--l-blue)" },
          { left:"45%", bottom:"10%", delay:"4s",  dur:"8s",  color:"var(--l-gold)" },
          { left:"28%", bottom:"35%", delay:"1s",  dur:"11s", color:"var(--l-teal-xl)" },
          { left:"82%", bottom:"40%", delay:"3s",  dur:"6s",  color:"var(--l-blue)" },
          { left:"60%", bottom:"25%", delay:"5s",  dur:"10s", color:"var(--l-gold)" },
        ].map((p, i) => (
          <div key={i} className="login-particle" style={{
            left: p.left, bottom: p.bottom, width: i % 2 === 0 ? "3px" : "2px", height: i % 2 === 0 ? "3px" : "2px",
            background: p.color, animationDelay: p.delay, animationDuration: p.dur,
          }} />
        ))}

        {/* ── Floating stat cards (déco) ── */}
        <div style={{
          position: "absolute", top: "18%", left: "max(24px, calc(50% - 480px))",
          background: "rgba(7,26,38,.85)", border: "1px solid rgba(221,170,64,.3)",
          borderRadius: "12px", padding: "12px 18px", backdropFilter: "blur(12px)",
          animation: "login-float1 6s ease-in-out infinite",
          boxShadow: "0 20px 60px rgba(0,0,0,.35)",
          pointerEvents: "none",
        }} className="hidden-mobile">
          <div style={{ fontSize: "10px", color: "var(--l-text-3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "4px" }}>Nouveaux RDV</div>
          <div style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: "20px", fontWeight: 700, color: "var(--l-gold)" }}>↑ +12</div>
          <div style={{ fontSize: "11px", color: "var(--l-text-3)", marginTop: "2px" }}>cette semaine</div>
        </div>

        <div style={{
          position: "absolute", bottom: "22%", right: "max(24px, calc(50% - 480px))",
          background: "rgba(7,26,38,.85)", border: "1px solid rgba(170,189,216,.2)",
          borderRadius: "12px", padding: "12px 18px", backdropFilter: "blur(12px)",
          animation: "login-float2 7s 1s ease-in-out infinite",
          boxShadow: "0 20px 60px rgba(0,0,0,.35)",
          pointerEvents: "none",
        }} className="hidden-mobile">
          <div style={{ fontSize: "10px", color: "var(--l-text-3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "4px" }}>Taux satisfaction</div>
          <div style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: "20px", fontWeight: 700, color: "var(--l-teal-xl)" }}>97%</div>
          <div style={{ fontSize: "11px", color: "var(--l-text-3)", marginTop: "2px" }}>sur 12 mois</div>
        </div>

        <div style={{
          position: "absolute", top: "55%", right: "max(24px, calc(50% - 520px))",
          background: "rgba(7,26,38,.85)", border: "1px solid rgba(13,75,88,.4)",
          borderRadius: "12px", padding: "10px 16px", backdropFilter: "blur(12px)",
          animation: "login-float3 8s 2s ease-in-out infinite",
          boxShadow: "0 20px 60px rgba(0,0,0,.35)",
          pointerEvents: "none",
        }} className="hidden-mobile">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4ACA7A", flexShrink: 0 }} />
            <div style={{ fontSize: "13px", color: "var(--l-text)", fontWeight: 500 }}>Marie Dupont</div>
          </div>
          <div style={{ fontSize: "11px", color: "var(--l-text-3)", marginTop: "4px" }}>🩺 Nouveau lead · il y a 2 min</div>
        </div>

        {/* ── Bouton retour landing ── */}
        <Link href="/" style={{
          position: "absolute", top: "20px", left: "20px",
          display: "inline-flex", alignItems: "center", gap: "6px",
          fontSize: "13px", fontWeight: 500, color: "var(--l-text-2)",
          textDecoration: "none", padding: "8px 14px",
          border: "1px solid var(--l-border)", borderRadius: "100px",
          background: "rgba(255,255,255,.04)", backdropFilter: "blur(8px)",
          transition: "all .2s", zIndex: 10,
        }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--l-text)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--l-border-g)";
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.08)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--l-text-2)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--l-border)";
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Accueil
        </Link>

        {/* ── Card principale ── */}
        <div style={{
          width: "100%", maxWidth: "420px", position: "relative", zIndex: 5,
          animation: "login-card-in .6s cubic-bezier(.16,1,.3,1) both",
        }}>
          <div style={{
            background: "rgba(7,26,38,.88)", backdropFilter: "blur(24px)",
            border: "1px solid rgba(170,189,216,.12)",
            borderRadius: "20px", padding: "40px 36px",
            boxShadow: "0 40px 120px rgba(0,0,0,.5), 0 0 0 1px rgba(170,189,216,.06)",
          }}>

            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
                <LangSelector />
              </div>
              <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "10px", textDecoration: "none", marginBottom: "24px" }}>
                <img src="/logo.png" alt="Klientys" style={{ height: "36px", width: "auto" }} />
                <span style={{
                  fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                  fontWeight: 700, fontSize: "20px", color: "var(--l-text)",
                }}>Klientys</span>
              </Link>
              <h1 style={{
                fontSize: "24px", fontWeight: 800,
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                marginBottom: "6px", color: "var(--l-text)", letterSpacing: "-.02em",
              }}>
                {t.login_title}
              </h1>
              <p style={{ color: "var(--l-text-2)", fontSize: "14px", margin: 0 }}>
                {t.login_subtitle}
              </p>
            </div>

            {/* OAuth — LinkedIn */}
            <button
              type="button"
              onClick={handleLinkedIn}
              disabled={linkedInLoading || loading}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                padding: "11px 16px", borderRadius: "10px",
                border: "1px solid rgba(170,189,216,.18)",
                background: "rgba(255,255,255,.05)", color: "var(--l-text)",
                fontSize: "14px", fontWeight: 500, cursor: linkedInLoading ? "wait" : "pointer",
                opacity: linkedInLoading ? 0.6 : 1, transition: "background .2s, border-color .2s",
              }}
              onMouseEnter={(e) => !linkedInLoading && ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.09)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.05)")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <rect width="24" height="24" rx="3" fill="#0A66C2"/>
                <path fill="#fff" d="M7.2 9.6h2v8h-2v-8zm1-3.4a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4zM11 9.6h1.9v1.1c.3-.6 1.1-1.3 2.4-1.3 2.1 0 3.2 1.4 3.2 3.5V17.6h-2v-4.1c0-1-.3-2-1.5-2s-2 .9-2 2.1V17.6H11V9.6z"/>
              </svg>
              {linkedInLoading ? "…" : t.login_linkedin}
            </button>
            {/* Facebook — en attente validation Meta
            <button onClick={handleFacebook} ... />
            */}

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0" }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(170,189,216,.12)" }} />
              <span style={{ fontSize: "12px", color: "var(--l-text-3)" }}>ou</span>
              <div style={{ flex: 1, height: "1px", background: "rgba(170,189,216,.12)" }} />
            </div>

            {/* Form — mode normal ou mode "mot de passe oublié" */}
            {forgotMode ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ textAlign: "center", marginBottom: "4px" }}>
                  <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--l-text)", margin: "0 0 6px" }}>
                    {t.login_forgot}
                  </p>
                  <p style={{ fontSize: "13px", color: "var(--l-text-2)", margin: 0 }}>
                    {t.login_forgot_subtitle}
                  </p>
                </div>
                {forgotSent ? (
                  <div style={{
                    background: "rgba(74,202,122,.1)", border: "1px solid rgba(74,202,122,.3)",
                    borderRadius: "10px", padding: "14px 16px", textAlign: "center",
                  }}>
                    <p style={{ color: "#4ACA7A", fontSize: "14px", margin: "0 0 4px", fontWeight: 600 }}>
                      {t.login_forgot_sent_title}
                    </p>
                    <p style={{ color: "var(--l-text-2)", fontSize: "13px", margin: 0 }}>
                      {t.login_forgot_sent_desc}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleForgot} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <input
                      type="email"
                      placeholder="votre@email.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      autoFocus
                      style={{
                        display: "block", width: "100%", background: "rgba(255,255,255,.05)",
                        border: "1px solid rgba(170,189,216,.18)", borderRadius: "10px",
                        padding: "11px 14px", fontSize: "14px", color: "var(--l-text)",
                        outline: "none", transition: "border-color .2s, box-shadow .2s",
                        boxSizing: "border-box",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "var(--l-teal-xl)";
                        e.target.style.boxShadow = "0 0 0 3px rgba(42,143,165,.15)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "rgba(170,189,216,.18)";
                        e.target.style.boxShadow = "none";
                      }}
                    />
                    {forgotError && (
                      <p style={{
                        color: "#FC8181", fontSize: "13px", margin: 0,
                        background: "rgba(191,51,51,.1)", border: "1px solid rgba(191,51,51,.25)",
                        borderRadius: "8px", padding: "8px 12px",
                      }}>{forgotError}</p>
                    )}
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="l-btn l-btn-primary"
                      style={{ width: "100%", justifyContent: "center", opacity: forgotLoading ? 0.7 : 1 }}
                    >
                      {forgotLoading ? t.login_forgot_sending : t.login_forgot_submit}
                    </button>
                  </form>
                )}
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setForgotSent(false); setForgotError(""); }}
                  style={{
                    background: "none", border: "none", color: "var(--l-text-2)",
                    fontSize: "13px", cursor: "pointer", textAlign: "center", padding: "4px",
                  }}
                >
                  {t.login_forgot_back}
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <input
                    type="email"
                    placeholder={t.login_email}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{
                      display: "block", width: "100%", background: "rgba(255,255,255,.05)",
                      border: "1px solid rgba(170,189,216,.18)", borderRadius: "10px",
                      padding: "11px 14px", fontSize: "14px", color: "var(--l-text)",
                      outline: "none", transition: "border-color .2s, box-shadow .2s",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "var(--l-teal-xl)";
                      e.target.style.boxShadow = "0 0 0 3px rgba(42,143,165,.15)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "rgba(170,189,216,.18)";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <input
                      type="password"
                      placeholder={t.login_password}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{
                        display: "block", width: "100%", background: "rgba(255,255,255,.05)",
                        border: "1px solid rgba(170,189,216,.18)", borderRadius: "10px",
                        padding: "11px 14px", fontSize: "14px", color: "var(--l-text)",
                        outline: "none", transition: "border-color .2s, box-shadow .2s",
                        boxSizing: "border-box",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "var(--l-teal-xl)";
                        e.target.style.boxShadow = "0 0 0 3px rgba(42,143,165,.15)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "rgba(170,189,216,.18)";
                        e.target.style.boxShadow = "none";
                      }}
                    />
                    <div style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => { setForgotMode(true); setForgotEmail(email); }}
                        style={{
                          background: "none", border: "none", color: "var(--l-teal-xl)",
                          fontSize: "12px", cursor: "pointer", padding: "2px 0",
                          fontWeight: 500,
                        }}
                      >
                        {t.login_forgot}
                      </button>
                    </div>
                  </div>
                  {error && (
                    <p style={{
                      color: "#FC8181", fontSize: "13px", margin: 0,
                      background: "rgba(191,51,51,.1)", border: "1px solid rgba(191,51,51,.25)",
                      borderRadius: "8px", padding: "8px 12px",
                    }}>
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="l-btn l-btn-primary"
                    style={{ width: "100%", justifyContent: "center", marginTop: "4px", opacity: loading ? 0.7 : 1 }}
                  >
                    {loading ? t.login_loading : t.login_submit}
                  </button>
                </form>

                {lockedMins > 0 && (
                  <p style={{ textAlign: "center", fontSize: "12px", color: "#FC8181", marginTop: "8px", marginBottom: 0 }}>
                    🔒 {t.login_locked.replace("{m}", String(lockedMins))}
                  </p>
                )}
                <p style={{ textAlign: "center", fontSize: "13px", color: "var(--l-text-2)", marginTop: "24px", marginBottom: 0 }}>
                  {t.login_no_account}{" "}
                  <Link href="/onboarding" style={{ color: "var(--l-teal-xl)", textDecoration: "none", fontWeight: 600 }}>
                    {t.login_signup}
                  </Link>
                </p>
              </>
            )}
          </div>

          {/* Trust line sous la card */}
          <p style={{
            textAlign: "center", fontSize: "12px", color: "var(--l-text-3)",
            marginTop: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          }}>
            <span>🔒 Connexion sécurisée</span>
            <span style={{ color: "var(--l-border)" }}>·</span>
            <span>Données chiffrées</span>
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .hidden-mobile { display: none !important; }
        }
      `}</style>
    </>
  );
}
