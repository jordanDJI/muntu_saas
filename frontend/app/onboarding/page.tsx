"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/api";
import { useLanguage, LangSelector } from "../../contexts/LanguageContext";
import { COUNTRIES } from "../../lib/countries";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const BG_STYLE = `
  @keyframes ob-orb1 {
    0%,100% { transform: translate(0,0) scale(1); opacity:.55; }
    33%      { transform: translate(40px,-30px) scale(1.08); opacity:.7; }
    66%      { transform: translate(-20px,20px) scale(.95); opacity:.5; }
  }
  @keyframes ob-orb2 {
    0%,100% { transform: translate(0,0) scale(1); opacity:.35; }
    40%      { transform: translate(-50px,30px) scale(1.12); opacity:.5; }
    75%      { transform: translate(30px,-40px) scale(.9); opacity:.3; }
  }
  @keyframes ob-orb3 {
    0%,100% { transform: translate(0,0) scale(1); opacity:.25; }
    50%      { transform: translate(25px,35px) scale(1.15); opacity:.4; }
  }
  @keyframes ob-float1 {
    0%,100% { transform: translateY(0) rotate(-1deg); }
    50%      { transform: translateY(-14px) rotate(1.5deg); }
  }
  @keyframes ob-float2 {
    0%,100% { transform: translateY(0) rotate(1deg); }
    50%      { transform: translateY(-10px) rotate(-2deg); }
  }
  @keyframes ob-float3 {
    0%,100% { transform: translateY(0); }
    50%      { transform: translateY(-8px); }
  }
  @keyframes ob-card-in {
    from { opacity:0; transform: translateY(24px) scale(.98); }
    to   { opacity:1; transform: none; }
  }
  @keyframes ob-particle {
    0%   { transform: translateY(0) translateX(0); opacity:0; }
    10%  { opacity:1; }
    90%  { opacity:.6; }
    100% { transform: translateY(-120px) translateX(20px); opacity:0; }
  }
  .ob-particle {
    position:absolute; border-radius:50%;
    animation: ob-particle linear infinite;
  }
  @media (max-width: 900px) { .ob-hidden-mobile { display:none!important; } }
`;

function AnimatedBg() {
  return (
    <>
      {/* Orbes */}
      <div style={{
        position:"absolute", width:"600px", height:"600px", borderRadius:"50%",
        top:"-150px", left:"-200px",
        background:"radial-gradient(circle, rgba(13,75,88,.7) 0%, transparent 70%)",
        animation:"ob-orb1 12s ease-in-out infinite", pointerEvents:"none",
      }}/>
      <div style={{
        position:"absolute", width:"500px", height:"500px", borderRadius:"50%",
        bottom:"-100px", right:"-150px",
        background:"radial-gradient(circle, rgba(170,189,216,.18) 0%, transparent 70%)",
        animation:"ob-orb2 16s ease-in-out infinite", pointerEvents:"none",
      }}/>
      <div style={{
        position:"absolute", width:"350px", height:"350px", borderRadius:"50%",
        top:"50%", left:"60%",
        background:"radial-gradient(circle, rgba(221,170,64,.12) 0%, transparent 70%)",
        animation:"ob-orb3 10s ease-in-out infinite", pointerEvents:"none",
      }}/>

      {/* Grille */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        backgroundImage:"linear-gradient(rgba(170,189,216,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(170,189,216,.07) 1px, transparent 1px)",
        backgroundSize:"48px 48px",
        maskImage:"radial-gradient(ellipse 70% 80% at 50% 50%, black 20%, transparent 75%)",
        WebkitMaskImage:"radial-gradient(ellipse 70% 80% at 50% 50%, black 20%, transparent 75%)",
      }}/>

      {/* Particules */}
      {[
        { left:"15%", bottom:"20%", delay:"0s",  dur:"7s",  color:"var(--l-teal-xl)", size:"3px" },
        { left:"75%", bottom:"15%", delay:"2s",  dur:"9s",  color:"var(--l-blue)",    size:"2px" },
        { left:"42%", bottom:"10%", delay:"4s",  dur:"8s",  color:"var(--l-gold)",    size:"3px" },
        { left:"25%", bottom:"38%", delay:"1s",  dur:"11s", color:"var(--l-teal-xl)", size:"2px" },
        { left:"85%", bottom:"42%", delay:"3s",  dur:"6s",  color:"var(--l-blue)",    size:"2px" },
        { left:"58%", bottom:"28%", delay:"5s",  dur:"10s", color:"var(--l-gold)",    size:"2px" },
      ].map((p, i) => (
        <div key={i} className="ob-particle" style={{
          left:p.left, bottom:p.bottom, width:p.size, height:p.size,
          background:p.color, animationDelay:p.delay, animationDuration:p.dur,
        }}/>
      ))}

      {/* Float cards déco */}
      <div className="ob-hidden-mobile" style={{
        position:"absolute", top:"16%", left:"max(24px, calc(50% - 500px))",
        background:"rgba(7,26,38,.85)", border:"1px solid rgba(221,170,64,.3)",
        borderRadius:"12px", padding:"12px 18px", backdropFilter:"blur(12px)",
        animation:"ob-float1 6s ease-in-out infinite",
        boxShadow:"0 20px 60px rgba(0,0,0,.35)", pointerEvents:"none",
      }}>
        <div style={{ fontSize:"10px", color:"var(--l-text-3)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:"4px" }}>Site créé en</div>
        <div style={{ fontFamily:"var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize:"20px", fontWeight:700, color:"var(--l-gold)" }}>12 min ⚡</div>
        <div style={{ fontSize:"11px", color:"var(--l-text-3)", marginTop:"2px" }}>en ligne immédiatement</div>
      </div>

      <div className="ob-hidden-mobile" style={{
        position:"absolute", bottom:"22%", right:"max(24px, calc(50% - 500px))",
        background:"rgba(7,26,38,.85)", border:"1px solid rgba(170,189,216,.2)",
        borderRadius:"12px", padding:"12px 18px", backdropFilter:"blur(12px)",
        animation:"ob-float2 7s 1s ease-in-out infinite",
        boxShadow:"0 20px 60px rgba(0,0,0,.35)", pointerEvents:"none",
      }}>
        <div style={{ fontSize:"10px", color:"var(--l-text-3)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:"4px" }}>Réservations</div>
        <div style={{ fontFamily:"var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize:"20px", fontWeight:700, color:"var(--l-teal-xl)" }}>↑ 3×</div>
        <div style={{ fontSize:"11px", color:"var(--l-text-3)", marginTop:"2px" }}>plus qu'avant</div>
      </div>

      <div className="ob-hidden-mobile" style={{
        position:"absolute", top:"55%", right:"max(24px, calc(50% - 540px))",
        background:"rgba(7,26,38,.85)", border:"1px solid rgba(13,75,88,.4)",
        borderRadius:"12px", padding:"10px 16px", backdropFilter:"blur(12px)",
        animation:"ob-float3 8s 2s ease-in-out infinite",
        boxShadow:"0 20px 60px rgba(0,0,0,.35)", pointerEvents:"none",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#4ACA7A", flexShrink:0 }}/>
          <div style={{ fontSize:"13px", color:"var(--l-text)", fontWeight:500 }}>Sarah K.</div>
        </div>
        <div style={{ fontSize:"11px", color:"var(--l-text-3)", marginTop:"4px" }}>✂️ Esthéticienne — agenda plein</div>
      </div>
    </>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [isFromGoogle, setIsFromGoogle] = useState(false);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [emailPending, setEmailPending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const SECTORS = [
    { value: "health",   label: t.ob_sector_health },
    { value: "coaching", label: t.ob_sector_coaching },
    { value: "trade",    label: t.ob_sector_trade },
    { value: "beauty",   label: t.ob_sector_beauty },
    { value: "finance",  label: t.ob_sector_finance },
    { value: "other",    label: t.ob_sector_other },
  ];

  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", password: "",
    tenant_name: "", tenant_slug: "", sector: "other", country: "BE",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const slugify = (v: string) => v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") === "google") {
      setIsFromGoogle(true);
      setStep(2);
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setGoogleToken(session.access_token);
          const meta = session.user.user_metadata;
          const fullName = meta.full_name || meta.name || "";
          const parts = fullName.trim().split(" ");
          set("first_name", meta.given_name || parts[0] || "");
          set("last_name", meta.family_name || parts.slice(1).join(" ") || "");
          set("email", session.user.email || "");
        }
      });
    }
  }, []);

  const handleGoogleSignup = async () => {
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

  const submitSetup = async (token: string) => {
    const res = await fetch(`${API}/api/v1/onboarding/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        first_name: form.first_name, last_name: form.last_name,
        tenant_name: form.tenant_name, tenant_slug: form.tenant_slug,
        sector: form.sector, country: form.country,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.detail ?? "Erreur lors de la création de l'espace");
      setLoading(false);
      return;
    }
    await supabase.auth.refreshSession();
    router.push("/dashboard");
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (honeypot) return;
    setError("");
    setLoading(true);

    if (isFromGoogle && googleToken) {
      await submitSetup(googleToken);
      return;
    }

    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          first_name: form.first_name, last_name: form.last_name,
          full_name: `${form.first_name} ${form.last_name}`.trim(), lang,
        },
      },
    });

    if (authError) {
      if (authError.message.toLowerCase().includes("already")) {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (loginError) {
          setError("Email déjà utilisé. Connectez-vous ou utilisez un autre email.");
          setLoading(false);
          return;
        }
      } else {
        setError(authError.message);
        setLoading(false);
        return;
      }
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      localStorage.setItem("klientys_pending_setup", JSON.stringify({
        first_name: form.first_name, last_name: form.last_name,
        tenant_name: form.tenant_name, tenant_slug: form.tenant_slug,
        sector: form.sector, country: form.country,
      }));
      setEmailPending(true);
      setLoading(false);
      return;
    }

    await submitSetup(sessionData.session.access_token);
  };

  const pageWrap = (content: React.ReactNode) => (
    <>
      <style>{BG_STYLE}</style>
      <div style={{
        minHeight:"100vh", background:"var(--l-bg)", display:"flex",
        alignItems:"center", justifyContent:"center", position:"relative",
        overflow:"hidden", fontFamily:"var(--font-dm-sans),'DM Sans',sans-serif",
        padding:"80px 16px 40px",
      }}>
        <AnimatedBg />

        {/* Bouton retour */}
        <Link href="/" style={{
          position:"absolute", top:"20px", left:"20px",
          display:"inline-flex", alignItems:"center", gap:"6px",
          fontSize:"13px", fontWeight:500, color:"var(--l-text-2)",
          textDecoration:"none", padding:"8px 14px",
          border:"1px solid var(--l-border)", borderRadius:"100px",
          background:"rgba(255,255,255,.04)", backdropFilter:"blur(8px)",
          transition:"all .2s", zIndex:10,
        }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.color = "var(--l-text)";
            el.style.borderColor = "var(--l-border-g)";
            el.style.background = "rgba(255,255,255,.08)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.color = "var(--l-text-2)";
            el.style.borderColor = "var(--l-border)";
            el.style.background = "rgba(255,255,255,.04)";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Accueil
        </Link>

        {/* Contenu */}
        <div style={{
          width:"100%", maxWidth:"520px", position:"relative", zIndex:5,
          animation:"ob-card-in .6s cubic-bezier(.16,1,.3,1) both",
        }}>
          {content}
        </div>
      </div>
    </>
  );

  const cardStyle = {
    background:"rgba(7,26,38,.88)", backdropFilter:"blur(24px)",
    border:"1px solid rgba(170,189,216,.12)", borderRadius:"20px",
    padding:"40px 36px",
    boxShadow:"0 40px 120px rgba(0,0,0,.5), 0 0 0 1px rgba(170,189,216,.06)",
  };

  const inputStyle: React.CSSProperties = {
    display:"block", width:"100%", background:"rgba(255,255,255,.05)",
    border:"1px solid rgba(170,189,216,.18)", borderRadius:"10px",
    padding:"11px 14px", fontSize:"14px", color:"var(--l-text)",
    outline:"none", transition:"border-color .2s, box-shadow .2s",
    boxSizing:"border-box",
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = "var(--l-teal-xl)";
    e.target.style.boxShadow = "0 0 0 3px rgba(42,143,165,.15)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = "rgba(170,189,216,.18)";
    e.target.style.boxShadow = "none";
  };

  // ── Email pending ─────────────────────────────────────────────────────────
  if (emailPending) {
    return pageWrap(
      <div style={{ ...cardStyle, textAlign:"center" }}>
        <div style={{ fontSize:"48px", marginBottom:"16px" }}>📧</div>
        <h2 style={{
          fontSize:"22px", fontWeight:800,
          fontFamily:"var(--font-bricolage),'Bricolage Grotesque',sans-serif",
          marginBottom:"12px", color:"var(--l-text)",
        }}>
          Confirmez votre email
        </h2>
        <p style={{ color:"var(--l-text-2)", fontSize:"14px", lineHeight:1.6, marginBottom:"12px" }}>
          Un email de confirmation a été envoyé à{" "}
          <strong style={{ color:"var(--l-text)" }}>{form.email}</strong>.
          Cliquez sur le lien pour activer votre compte.
        </p>
        <p style={{ color:"var(--l-text-3)", fontSize:"13px", margin:0 }}>
          Votre espace sera créé automatiquement dès la confirmation.
        </p>
      </div>
    );
  }

  const totalSteps = isFromGoogle ? 1 : 2;
  const currentDisplayStep = isFromGoogle ? 1 : step;

  return pageWrap(
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"24px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <img src="/logo.png" alt="Klientys" style={{ height:"36px", width:"auto" }} />
          <div>
            <span style={{ display:"block", fontFamily:"var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight:700, fontSize:"18px", color:"var(--l-text)" }}>
              Klientys
            </span>
            <span style={{ fontSize:"12px", color:"var(--l-text-3)" }}>
              {t.ob_step} {currentDisplayStep} {t.ob_of} {totalSteps}
            </span>
          </div>
        </div>
        <LangSelector />
      </div>

      {/* Progress bar */}
      <div style={{ height:"3px", background:"rgba(170,189,216,.1)", borderRadius:"2px", marginBottom:"28px", overflow:"hidden" }}>
        <div style={{
          height:"100%",
          width: isFromGoogle ? "100%" : (step === 1 ? "50%" : "100%"),
          background:"linear-gradient(90deg,var(--l-teal-xl),var(--l-gold))",
          borderRadius:"2px", transition:"width .4s",
        }} />
      </div>

      <h1 style={{
        fontSize:"22px", fontWeight:800,
        fontFamily:"var(--font-bricolage),'Bricolage Grotesque',sans-serif",
        marginBottom:"24px", color:"var(--l-text)", letterSpacing:"-.02em",
      }}>
        {t.ob_title}
      </h1>

      <form
        onSubmit={step === 1 && !isFromGoogle ? (e) => { e.preventDefault(); setStep(2); } : handleSubmit}
        style={{ display:"flex", flexDirection:"column", gap:"14px" }}
      >
        {step === 1 && !isFromGoogle && (
          <>
            <div style={{ position:"absolute", opacity:0, height:0, overflow:"hidden", pointerEvents:"none" }} aria-hidden="true">
              <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
            </div>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={googleLoading}
              style={{
                width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:"10px",
                padding:"11px 16px", borderRadius:"10px",
                border:"1px solid rgba(170,189,216,.18)",
                background:"rgba(255,255,255,.05)", color:"var(--l-text)",
                fontSize:"14px", fontWeight:500,
                cursor:googleLoading ? "wait" : "pointer", opacity:googleLoading ? 0.6 : 1,
                transition:"background .2s",
              }}
              onMouseEnter={(e) => !googleLoading && ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.09)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.05)")}
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.16C6.51 42.62 14.62 48 24 48z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.5-1.45-.78-3-.78-4.59s.27-3.14.78-4.59l-7.98-6.16C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.75l7.97-6.16z"/>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.97 6.16C12.43 13.72 17.74 9.5 24 9.5z"/>
              </svg>
              {googleLoading ? "Redirection…" : "S'inscrire avec Google"}
            </button>

            <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
              <div style={{ flex:1, height:"1px", background:"rgba(170,189,216,.12)" }} />
              <span style={{ fontSize:"12px", color:"var(--l-text-3)" }}>ou</span>
              <div style={{ flex:1, height:"1px", background:"rgba(170,189,216,.12)" }} />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
              <input style={inputStyle} placeholder={t.ob_firstname} value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required onFocus={onFocus} onBlur={onBlur} />
              <input style={inputStyle} placeholder={t.ob_lastname} value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required onFocus={onFocus} onBlur={onBlur} />
            </div>
            <input style={inputStyle} type="email" placeholder={t.ob_email} value={form.email} onChange={(e) => set("email", e.target.value)} required onFocus={onFocus} onBlur={onBlur} />
            <input style={inputStyle} type="password" placeholder={t.ob_password} value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={8} onFocus={onFocus} onBlur={onBlur} />

            <button type="submit" className="l-btn l-btn-primary" style={{ width:"100%", justifyContent:"center", marginTop:"4px" }}>
              {t.ob_continue}
            </button>
          </>
        )}

        {(step === 2 || isFromGoogle) && (
          <>
            <div>
              <label style={{ fontSize:"13px", fontWeight:500, color:"var(--l-text-2)", marginBottom:"6px", display:"block" }}>{t.ob_biz}</label>
              <input
                style={inputStyle}
                placeholder="Ex: Muntu Cura"
                value={form.tenant_name}
                onChange={(e) => { set("tenant_name", e.target.value); set("tenant_slug", slugify(e.target.value)); }}
                required onFocus={onFocus} onBlur={onBlur}
              />
            </div>

            <div>
              <label style={{ fontSize:"13px", fontWeight:500, color:"var(--l-text-2)", marginBottom:"6px", display:"block" }}>{t.ob_url}</label>
              <div style={{
                display:"flex", alignItems:"center",
                background:"rgba(255,255,255,.05)", border:"1px solid rgba(170,189,216,.18)",
                borderRadius:"10px", overflow:"hidden",
              }}>
                <span style={{ padding:"11px 12px", fontSize:"13px", color:"var(--l-text-3)", borderRight:"1px solid rgba(170,189,216,.12)", whiteSpace:"nowrap", flexShrink:0 }}>
                  votre-domaine.com/
                </span>
                <input
                  value={form.tenant_slug}
                  onChange={(e) => set("tenant_slug", slugify(e.target.value))}
                  required
                  style={{ background:"transparent", border:"none", outline:"none", padding:"11px 14px", fontSize:"14px", color:"var(--l-text)", flex:1, minWidth:0 }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize:"13px", fontWeight:500, color:"var(--l-text-2)", marginBottom:"6px", display:"block" }}>{t.ob_sector}</label>
              <select
                value={form.sector}
                onChange={(e) => set("sector", e.target.value)}
                style={{ ...inputStyle, WebkitAppearance:"none", appearance:"none", cursor:"pointer" }}
                onFocus={onFocus} onBlur={onBlur}
              >
                {SECTORS.map((s) => <option key={s.value} value={s.value} style={{ background:"#071824" }}>{s.label}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize:"13px", fontWeight:500, color:"var(--l-text-2)", marginBottom:"6px", display:"block" }}>Pays</label>
              <select
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
                style={{ ...inputStyle, WebkitAppearance:"none", appearance:"none", cursor:"pointer" }}
                onFocus={onFocus} onBlur={onBlur}
              >
                {COUNTRIES.map((c) => <option key={c.code} value={c.code} style={{ background:"#071824" }}>{c.name}</option>)}
              </select>
            </div>

            {error && (
              <p style={{
                color:"#FC8181", fontSize:"13px", margin:0,
                background:"rgba(191,51,51,.1)", border:"1px solid rgba(191,51,51,.25)",
                borderRadius:"8px", padding:"8px 12px",
              }}>
                {error}
              </p>
            )}

            <div style={{ display:"flex", gap:"12px", marginTop:"4px" }}>
              {!isFromGoogle && (
                <button type="button" onClick={() => setStep(1)} className="l-btn l-btn-ghost" style={{ flex:1, justifyContent:"center" }}>
                  {t.ob_back}
                </button>
              )}
              <button type="submit" disabled={loading} className="l-btn l-btn-primary" style={{ flex:1, justifyContent:"center", opacity:loading ? 0.6 : 1 }}>
                {loading ? t.ob_creating : t.ob_create}
              </button>
            </div>
          </>
        )}
      </form>

      <p style={{ textAlign:"center", fontSize:"13px", color:"var(--l-text-2)", marginTop:"24px", marginBottom:0 }}>
        {t.ob_already}{" "}
        <Link href="/login" style={{ color:"var(--l-teal-xl)", textDecoration:"none", fontWeight:600 }}>
          {t.ob_login}
        </Link>
      </p>

      {/* Trust */}
      <p style={{
        textAlign:"center", fontSize:"12px", color:"var(--l-text-3)",
        marginTop:"16px", marginBottom:0,
        display:"flex", alignItems:"center", justifyContent:"center", gap:"8px",
      }}>
        <span>✓ Sans carte bancaire</span>
        <span style={{ color:"var(--l-border)" }}>·</span>
        <span>✓ Prêt en 15 minutes</span>
      </p>
    </div>
  );
}
