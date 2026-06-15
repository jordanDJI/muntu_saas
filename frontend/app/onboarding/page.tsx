"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/api";
import { useLanguage, LangSelector } from "../../contexts/LanguageContext";
import { COUNTRIES } from "../../lib/countries";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function OnboardingPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [isFromGoogle, setIsFromGoogle] = useState(false);
  const [emailPending, setEmailPending] = useState(false);
  const [linkedInLoading, setLinkedInLoading] = useState(false);
  const [facebookLoading, setFacebookLoading] = useState(false);

  const SECTORS = [
    { value: "health",      label: t.ob_sector_health },
    { value: "coaching",    label: t.ob_sector_coaching },
    { value: "trade",       label: t.ob_sector_trade },
    { value: "beauty",      label: t.ob_sector_beauty },
    { value: "finance",     label: t.ob_sector_finance },
    { value: "restaurant",  label: t.ob_sector_restaurant },
    { value: "commerce",    label: t.ob_sector_commerce },
    { value: "other",       label: t.ob_sector_other },
  ];

  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", password: "", confirm_password: "",
    tenant_name: "", tenant_slug: "", sector: "other", country: "BE",
  });
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const slugify = (v: string) => v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromGoogle = params.get("from") === "google";
    const noTenant = params.get("no_tenant") === "1";

    if (fromGoogle || noTenant) {
      setIsFromGoogle(true);
      if (noTenant) setEmailConfirmed(true);

      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) { setStep(2); return; }

        // Filet de sécurité : les comptes support n'ont jamais de tenant à créer
        const appMeta = session.user.app_metadata ?? {};
        if (appMeta.support_role || appMeta.is_super_admin) {
          window.location.replace("/admin");
          return;
        }

        // Re-vérifier si le tenant existe déjà (le renvoi sur /onboarding peut être
        // dû à une erreur transitoire du backend au moment du login, pas à une vraie absence)
        if (noTenant) {
          try {
            const res = await fetch(`${API}/api/v1/auth/me/tenants`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (res.ok) {
              const memberships = await res.json();
              if (Array.isArray(memberships) && memberships.length > 0) {
                const isOnlySecretary = memberships.every((m: any) => m.role === "secretary");
                window.location.replace(isOnlySecretary ? "/dashboard/secretary" : "/dashboard");
                return;
              }
            }
          } catch { /* backend inaccessible — on continue vers le formulaire */ }
        }

        // Pré-remplir le formulaire avec les données disponibles
        setStep(2);
        const meta = session.user.user_metadata || {};
        const fullName = meta.full_name || meta.name || "";
        const parts = fullName.trim().split(" ");
        if (!form.first_name) set("first_name", meta.given_name || parts[0] || "");
        if (!form.last_name)  set("last_name",  meta.family_name || parts.slice(1).join(" ") || "");
        if (!form.email)      set("email",       session.user.email || "");
        if (meta.pending_tenant_name && !form.tenant_name) {
          set("tenant_name", meta.pending_tenant_name);
          set("tenant_slug", meta.pending_tenant_slug || slugify(meta.pending_tenant_name));
        }
        if (meta.pending_sector)  set("sector",  meta.pending_sector);
        if (meta.pending_country) set("country", meta.pending_country);
      });
    }
  }, []);

  const handleLinkedInSignup = async () => {
    setLinkedInLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "linkedin_oidc",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "openid profile email",
      },
    });
  };

  const handleFacebookSignup = async () => {
    setFacebookLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "email",
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
    // Conversions — compte créé avec succès
    if (typeof window !== "undefined") {
      const provider = (await supabase.auth.getSession()).data.session?.user?.app_metadata?.provider;
      const method = provider === "google" ? "google" : provider === "linkedin_oidc" ? "linkedin" : "email";
      if ((window as any).fbq) (window as any).fbq("track", "CompleteRegistration");
      if ((window as any).gtag) (window as any).gtag("event", "sign_up", { method });
    }
    await supabase.auth.refreshSession();
    // Rediriger vers le site-builder avec ?template=auto pour pré-remplir selon le secteur
    router.push(`/dashboard/site-builder?template=auto`);
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (honeypot) return;
    setError("");
    setLoading(true);

    // Flux post-confirmation email ou Google OAuth : créer le tenant directement
    if (isFromGoogle) {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        setError("Session expirée. Veuillez recommencer.");
        setLoading(false);
        return;
      }
      await submitSetup(currentSession.access_token);
      return;
    }

    // Flux email step 1 : créer le compte, l'utilisateur remplira step 2 après confirmation
    if (form.password.length < 8 || !/\d/.test(form.password) || !/[^a-zA-Z0-9]/.test(form.password)) {
      setError("Le mot de passe doit contenir au moins 8 caractères, 1 chiffre et 1 caractère spécial.");
      setLoading(false);
      return;
    }
    if (form.password !== form.confirm_password) {
      setError("Les mots de passe ne correspondent pas.");
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          first_name: form.first_name,
          last_name: form.last_name,
          full_name: `${form.first_name} ${form.last_name}`.trim(),
          lang,
        },
      },
    });

    if (authError) {
      const msg = authError.message.toLowerCase();
      if (msg.includes("rate limit") || msg.includes("too many") || msg.includes("over_email")) {
        setError("Trop d'emails envoyés. Attendez 1 à 2 minutes puis réessayez.");
      } else if (msg.includes("already")) {
        setError("Cet email est déjà utilisé. Connectez-vous ou utilisez un autre email.");
      } else {
        setError(authError.message);
      }
      setLoading(false);
      return;
    }

    // Email de confirmation envoyé — step 2 se fera après confirmation
    setEmailPending(true);
    setLoading(false);
  };

  const totalSteps = 1; // step 2 (business) se fait après confirmation email, pas ici

  return (
    <>
      <style>{`
        @keyframes ob-orb1{0%,100%{transform:translate(0,0) scale(1);opacity:.55}33%{transform:translate(40px,-30px) scale(1.08);opacity:.7}66%{transform:translate(-20px,20px) scale(.95);opacity:.5}}
        @keyframes ob-orb2{0%,100%{transform:translate(0,0) scale(1);opacity:.35}40%{transform:translate(-50px,30px) scale(1.12);opacity:.5}75%{transform:translate(30px,-40px) scale(.9);opacity:.3}}
        @keyframes ob-orb3{0%,100%{transform:translate(0,0) scale(1);opacity:.25}50%{transform:translate(25px,35px) scale(1.15);opacity:.4}}
        @keyframes ob-f1{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-14px) rotate(1.5deg)}}
        @keyframes ob-f2{0%,100%{transform:translateY(0) rotate(1deg)}50%{transform:translateY(-10px) rotate(-2deg)}}
        @keyframes ob-f3{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes ob-in{from{opacity:0;transform:translateY(24px) scale(.98)}to{opacity:1;transform:none}}
        @keyframes ob-pt{0%{transform:translateY(0);opacity:0}10%{opacity:1}90%{opacity:.6}100%{transform:translateY(-120px) translateX(20px);opacity:0}}
        .ob-pt{position:absolute;border-radius:50%;animation:ob-pt linear infinite;}
        @media(max-width:900px){.ob-hm{display:none!important}}
      `}</style>

      <div style={{
        minHeight:"100vh", background:"var(--l-bg)", display:"flex",
        alignItems:"center", justifyContent:"center", position:"relative",
        overflow:"hidden", fontFamily:"var(--font-dm-sans),'DM Sans',sans-serif",
        padding:"80px 16px 40px",
      }}>

        {/* Orbes */}
        <div style={{ position:"absolute", width:"600px", height:"600px", borderRadius:"50%", top:"-150px", left:"-200px", background:"radial-gradient(circle,rgba(13,75,88,.7) 0%,transparent 70%)", animation:"ob-orb1 12s ease-in-out infinite", pointerEvents:"none" }} />
        <div style={{ position:"absolute", width:"500px", height:"500px", borderRadius:"50%", bottom:"-100px", right:"-150px", background:"radial-gradient(circle,rgba(170,189,216,.18) 0%,transparent 70%)", animation:"ob-orb2 16s ease-in-out infinite", pointerEvents:"none" }} />
        <div style={{ position:"absolute", width:"350px", height:"350px", borderRadius:"50%", top:"50%", left:"60%", background:"radial-gradient(circle,rgba(221,170,64,.12) 0%,transparent 70%)", animation:"ob-orb3 10s ease-in-out infinite", pointerEvents:"none" }} />

        {/* Grille */}
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", backgroundImage:"linear-gradient(rgba(170,189,216,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(170,189,216,.07) 1px,transparent 1px)", backgroundSize:"48px 48px", maskImage:"radial-gradient(ellipse 70% 80% at 50% 50%,black 20%,transparent 75%)", WebkitMaskImage:"radial-gradient(ellipse 70% 80% at 50% 50%,black 20%,transparent 75%)" }} />

        {/* Particules */}
        {([ ["15%","20%","0s","7s","var(--l-teal-xl)","3px"], ["75%","15%","2s","9s","var(--l-blue)","2px"], ["42%","10%","4s","8s","var(--l-gold)","3px"], ["25%","38%","1s","11s","var(--l-teal-xl)","2px"], ["85%","42%","3s","6s","var(--l-blue)","2px"], ["58%","28%","5s","10s","var(--l-gold)","2px"] ] as const).map(([l,b,d,dur,c,s], i) => (
          <div key={i} className="ob-pt" style={{ left:l, bottom:b, width:s, height:s, background:c, animationDelay:d, animationDuration:dur }} />
        ))}

        {/* Float cards */}
        <div className="ob-hm" style={{ position:"absolute", top:"16%", left:"max(24px,calc(50% - 500px))", background:"rgba(7,26,38,.85)", border:"1px solid rgba(221,170,64,.3)", borderRadius:"12px", padding:"12px 18px", backdropFilter:"blur(12px)", animation:"ob-f1 6s ease-in-out infinite", boxShadow:"0 20px 60px rgba(0,0,0,.35)", pointerEvents:"none" }}>
          <div style={{ fontSize:"10px", color:"var(--l-text-3)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:"4px" }}>Site créé en</div>
          <div style={{ fontFamily:"var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize:"20px", fontWeight:700, color:"var(--l-gold)" }}>12 min ⚡</div>
          <div style={{ fontSize:"11px", color:"var(--l-text-3)", marginTop:"2px" }}>en ligne immédiatement</div>
        </div>

        <div className="ob-hm" style={{ position:"absolute", bottom:"22%", right:"max(24px,calc(50% - 500px))", background:"rgba(7,26,38,.85)", border:"1px solid rgba(170,189,216,.2)", borderRadius:"12px", padding:"12px 18px", backdropFilter:"blur(12px)", animation:"ob-f2 7s 1s ease-in-out infinite", boxShadow:"0 20px 60px rgba(0,0,0,.35)", pointerEvents:"none" }}>
          <div style={{ fontSize:"10px", color:"var(--l-text-3)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:"4px" }}>Réservations</div>
          <div style={{ fontFamily:"var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize:"20px", fontWeight:700, color:"var(--l-teal-xl)" }}>↑ 3×</div>
          <div style={{ fontSize:"11px", color:"var(--l-text-3)", marginTop:"2px" }}>plus qu&apos;avant</div>
        </div>

        <div className="ob-hm" style={{ position:"absolute", top:"55%", right:"max(24px,calc(50% - 540px))", background:"rgba(7,26,38,.85)", border:"1px solid rgba(13,75,88,.4)", borderRadius:"12px", padding:"10px 16px", backdropFilter:"blur(12px)", animation:"ob-f3 8s 2s ease-in-out infinite", boxShadow:"0 20px 60px rgba(0,0,0,.35)", pointerEvents:"none" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#4ACA7A", flexShrink:0 }} />
            <div style={{ fontSize:"13px", color:"var(--l-text)", fontWeight:500 }}>Sarah K.</div>
          </div>
          <div style={{ fontSize:"11px", color:"var(--l-text-3)", marginTop:"4px" }}>✂️ Esthéticienne — agenda plein</div>
        </div>

        {/* Bouton retour */}
        <Link href="/" style={{ position:"absolute", top:"20px", left:"20px", display:"inline-flex", alignItems:"center", gap:"6px", fontSize:"13px", fontWeight:500, color:"var(--l-text-2)", textDecoration:"none", padding:"8px 14px", border:"1px solid var(--l-border)", borderRadius:"100px", background:"rgba(255,255,255,.04)", backdropFilter:"blur(8px)", transition:"all .2s", zIndex:10 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Accueil
        </Link>

        {/* Card */}
        <div style={{ width:"100%", maxWidth:"520px", position:"relative", zIndex:5, animation:"ob-in .6s cubic-bezier(.16,1,.3,1) both" }}>
          <div style={{ background:"rgba(7,26,38,.88)", backdropFilter:"blur(24px)", border:"1px solid rgba(170,189,216,.12)", borderRadius:"20px", padding:"40px 36px", boxShadow:"0 40px 120px rgba(0,0,0,.5),0 0 0 1px rgba(170,189,216,.06)" }}>

            {emailPending ? (
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:"48px", marginBottom:"16px" }}>📧</div>
                <h2 style={{ fontSize:"22px", fontWeight:800, fontFamily:"var(--font-bricolage),'Bricolage Grotesque',sans-serif", marginBottom:"12px", color:"var(--l-text)" }}>
                  Confirmez votre email
                </h2>
                <p style={{ color:"var(--l-text-2)", fontSize:"14px", lineHeight:1.6, marginBottom:"20px" }}>
                  Un email de confirmation a été envoyé à{" "}
                  <strong style={{ color:"var(--l-text)" }}>{form.email}</strong>.
                  Cliquez sur le lien pour activer votre compte.
                </p>
                <button
                  onClick={async () => {
                    setResending(true);
                    await supabase.auth.resend({ type: "signup", email: form.email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
                    setResending(false);
                    setResent(true);
                    setTimeout(() => setResent(false), 5000);
                  }}
                  disabled={resending || resent}
                  style={{ fontSize:"13px", color: resent ? "var(--l-teal-xl)" : "var(--l-text-2)", background:"none", border:"1px solid rgba(170,189,216,.2)", borderRadius:"8px", padding:"8px 16px", cursor: resent ? "default" : "pointer", marginBottom:"16px" }}
                >
                  {resent ? "✓ Email renvoyé !" : resending ? "Envoi…" : "Renvoyer l'email de confirmation"}
                </button>
                <p style={{ color:"var(--l-text-3)", fontSize:"13px", margin:0 }}>
                  Votre espace sera créé automatiquement dès la confirmation.
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"24px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                    <img src="/logo.png" alt="Klientys" style={{ height:"36px", width:"auto" }} />
                    <div>
                      <span style={{ display:"block", fontFamily:"var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight:700, fontSize:"18px", color:"var(--l-text)" }}>Klientys</span>
                      <span style={{ fontSize:"12px", color:"var(--l-text-3)" }}>{isFromGoogle ? "Votre espace professionnel" : "Créer votre compte"}</span>
                    </div>
                  </div>
                  <LangSelector />
                </div>

                {/* Barre de progression */}
                <div style={{ height:"3px", background:"rgba(170,189,216,.1)", borderRadius:"2px", marginBottom:"28px", overflow:"hidden" }}>
                  <div style={{ height:"100%", width:"100%", background:"linear-gradient(90deg,var(--l-teal-xl),var(--l-gold))", borderRadius:"2px" }} />
                </div>

                <h1 style={{ fontSize:"22px", fontWeight:800, fontFamily:"var(--font-bricolage),'Bricolage Grotesque',sans-serif", marginBottom:"24px", color:"var(--l-text)", letterSpacing:"-.02em" }}>
                  {t.ob_title}
                </h1>

                <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
                  {!isFromGoogle && (
                    <>
                      <div style={{ position:"absolute", opacity:0, height:0, overflow:"hidden", pointerEvents:"none" }} aria-hidden="true">
                        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                      </div>

                      <button
                        type="button"
                        onClick={handleLinkedInSignup}
                        disabled={linkedInLoading}
                        style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:"10px", padding:"11px 16px", borderRadius:"10px", border:"1px solid rgba(170,189,216,.18)", background:"rgba(255,255,255,.05)", color:"var(--l-text)", fontSize:"14px", fontWeight:500, cursor:linkedInLoading ? "wait" : "pointer", opacity:linkedInLoading ? 0.6 : 1, transition:"background .2s" }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24">
                          <rect width="24" height="24" rx="3" fill="#0A66C2"/>
                          <path fill="#fff" d="M7.2 9.6h2v8h-2v-8zm1-3.4a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4zM11 9.6h1.9v1.1c.3-.6 1.1-1.3 2.4-1.3 2.1 0 3.2 1.4 3.2 3.5V17.6h-2v-4.1c0-1-.3-2-1.5-2s-2 .9-2 2.1V17.6H11V9.6z"/>
                        </svg>
                        {linkedInLoading ? "Redirection…" : "S'inscrire avec LinkedIn"}
                      </button>
                      {/* Facebook — en attente validation Meta */}

                      <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                        <div style={{ flex:1, height:"1px", background:"rgba(170,189,216,.12)" }} />
                        <span style={{ fontSize:"12px", color:"var(--l-text-3)" }}>ou</span>
                        <div style={{ flex:1, height:"1px", background:"rgba(170,189,216,.12)" }} />
                      </div>

                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                        <input className="d-input" placeholder={t.ob_firstname} value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
                        <input className="d-input" placeholder={t.ob_lastname} value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required />
                      </div>
                      <input className="d-input" type="email" placeholder={t.ob_email} value={form.email} onChange={(e) => set("email", e.target.value)} required />
                      <div>
                        <div style={{ position: "relative" }}>
                          <input className="d-input" type={showPassword ? "text" : "password"} placeholder={t.ob_password} value={form.password} onChange={(e) => { set("password", e.target.value); setError(""); }} required minLength={8} style={{ paddingRight: "44px" }} />
                          <button type="button" onClick={() => setShowPassword((v) => !v)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--l-text-3)", padding: "4px", display: "flex", alignItems: "center", justifyContent: "center" }} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                            {showPassword ? (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            )}
                          </button>
                        </div>
                        {form.password.length > 0 && (
                          <div style={{ display:"flex", gap:"8px", marginTop:"6px", flexWrap:"wrap" }}>
                            {[
                              { ok: form.password.length >= 8,          label: "8 caractères" },
                              { ok: /\d/.test(form.password),           label: "1 chiffre" },
                              { ok: /[^a-zA-Z0-9]/.test(form.password), label: "1 caractère spécial" },
                            ].map(({ ok, label }) => (
                              <span key={label} style={{ fontSize:"11px", padding:"2px 8px", borderRadius:"99px", background: ok ? "rgba(52,211,153,.15)" : "rgba(255,255,255,.07)", color: ok ? "#6ee7b7" : "#9ca3af", border: `1px solid ${ok ? "rgba(52,211,153,.3)" : "rgba(255,255,255,.1)"}` }}>
                                {ok ? "✓" : "·"} {label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ position: "relative" }}>
                        <input
                          className="d-input"
                          type="password"
                          placeholder={t.ob_confirm_password}
                          value={form.confirm_password}
                          onChange={(e) => { set("confirm_password", e.target.value); setError(""); }}
                          required
                          minLength={8}
                          style={{ paddingRight: "44px", borderColor: form.confirm_password.length > 0 && form.confirm_password === form.password ? "rgba(52,211,153,.5)" : undefined }}
                        />
                        {form.confirm_password.length > 0 && form.confirm_password === form.password && (
                          <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#6ee7b7", fontSize: "16px", pointerEvents: "none" }}>✓</span>
                        )}
                      </div>
                      {form.confirm_password.length > 0 && form.confirm_password === form.password && (
                        <p style={{ fontSize: "12px", color: "#6ee7b7", margin: "4px 0 0", display: "flex", alignItems: "center", gap: "5px" }}>
                          <span>✓</span> Les mots de passe sont identiques
                        </p>
                      )}

                      {error && (
                        <p style={{ color:"#FC8181", fontSize:"13px", margin:0, background:"rgba(191,51,51,.1)", border:"1px solid rgba(191,51,51,.25)", borderRadius:"8px", padding:"8px 12px" }}>
                          {error}
                        </p>
                      )}

                      <button type="submit" disabled={loading} className="l-btn l-btn-primary" style={{ width:"100%", justifyContent:"center", marginTop:"4px", opacity:loading ? 0.6 : 1 }}>
                        {loading ? t.ob_creating : t.ob_create}
                      </button>
                    </>
                  )}

                  {isFromGoogle && (
                    <>
                      {emailConfirmed && (
                        <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"10px 14px", borderRadius:"10px", background:"rgba(13,75,88,.25)", border:"1px solid rgba(13,75,88,.5)", marginBottom:"4px" }}>
                          <span style={{ fontSize:"18px" }}>✅</span>
                          <div>
                            <p style={{ margin:0, fontSize:"13px", fontWeight:600, color:"var(--l-teal-xl)" }}>Email confirmé !</p>
                            <p style={{ margin:0, fontSize:"12px", color:"var(--l-text-2)" }}>Complétez votre profil pour accéder à votre espace.</p>
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="d-label">{t.ob_biz}</label>
                        <input className="d-input" placeholder="Ex: Muntu Cura" value={form.tenant_name} onChange={(e) => { set("tenant_name", e.target.value); set("tenant_slug", slugify(e.target.value)); }} required />
                      </div>

                      <div>
                        <label className="d-label">{t.ob_url}</label>
                        <div className="d-input-prefix">
                          <span>klientys.co/</span>
                          <input value={form.tenant_slug} onChange={(e) => set("tenant_slug", slugify(e.target.value))} required />
                        </div>
                      </div>

                      <div>
                        <label className="d-label">{t.ob_sector}</label>
                        <select className="d-select" value={form.sector} onChange={(e) => set("sector", e.target.value)}>
                          {SECTORS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="d-label">{t.ob_country}</label>
                        <select className="d-select" value={form.country} onChange={(e) => set("country", e.target.value)}>
                          {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                      </div>

                      {error && (
                        <p style={{ color:"#FC8181", fontSize:"13px", margin:0, background:"rgba(191,51,51,.1)", border:"1px solid rgba(191,51,51,.25)", borderRadius:"8px", padding:"8px 12px" }}>
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

                {!isFromGoogle && (
                  <p style={{ textAlign:"center", fontSize:"13px", color:"var(--l-text-2)", marginTop:"24px", marginBottom:0 }}>
                    {t.ob_already}{" "}
                    <Link href="/login" style={{ color:"var(--l-teal-xl)", textDecoration:"none", fontWeight:600 }}>
                      {t.ob_login}
                    </Link>
                  </p>
                )}

                <p style={{ textAlign:"center", fontSize:"12px", color:"var(--l-text-3)", marginTop:"16px", marginBottom:0, display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
                  <span>✓ Sans carte bancaire</span>
                  <span style={{ color:"var(--l-border)" }}>·</span>
                  <span>✓ Prêt en 15 minutes</span>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
