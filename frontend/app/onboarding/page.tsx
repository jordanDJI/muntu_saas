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
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    tenant_name: "",
    tenant_slug: "",
    sector: "other",
    country: "BE",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const slugify = (v: string) =>
    v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

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
        first_name: form.first_name,
        last_name: form.last_name,
        tenant_name: form.tenant_name,
        tenant_slug: form.tenant_slug,
        sector: form.sector,
        country: form.country,
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

    // Google flow — session already exists
    if (isFromGoogle && googleToken) {
      await submitSetup(googleToken);
      return;
    }

    // Email/password signup
    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          first_name: form.first_name,
          last_name: form.last_name,
          full_name: `${form.first_name} ${form.last_name}`.trim(),
          lang,
        },
      },
    });

    if (authError) {
      if (authError.message.toLowerCase().includes("already")) {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
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
      // Email confirmation required — persist setup data for after confirmation
      localStorage.setItem("klientys_pending_setup", JSON.stringify({
        first_name: form.first_name,
        last_name: form.last_name,
        tenant_name: form.tenant_name,
        tenant_slug: form.tenant_slug,
        sector: form.sector,
        country: form.country,
      }));
      setEmailPending(true);
      setLoading(false);
      return;
    }

    await submitSetup(sessionData.session.access_token);
  };

  // ── Email pending screen ────────────────────────────────────────────────────
  if (emailPending) {
    return (
      <div className="d-page">
        <div style={{ width: "100%", maxWidth: "440px", marginTop: "40px" }}>
          <div className="d-card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📧</div>
            <h2 style={{ fontSize: "20px", fontWeight: 800, fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", marginBottom: "12px", color: "var(--l-text)" }}>
              Confirmez votre email
            </h2>
            <p style={{ color: "var(--l-text-2)", fontSize: "14px", lineHeight: 1.6, marginBottom: "12px" }}>
              Un email de confirmation a été envoyé à{" "}
              <strong style={{ color: "var(--l-text)" }}>{form.email}</strong>.
              Cliquez sur le lien pour activer votre compte.
            </p>
            <p style={{ color: "var(--l-text-3)", fontSize: "13px", margin: 0 }}>
              Votre espace sera créé automatiquement dès la confirmation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const totalSteps = isFromGoogle ? 1 : 2;
  const currentDisplayStep = isFromGoogle ? 1 : step;

  return (
    <div className="d-page">
      <div style={{ width: "100%", maxWidth: "520px", marginTop: "24px" }}>
        <div className="d-card">
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <img src="/logo.png" alt="Klientys" style={{ height: "36px", width: "auto" }} />
              <div>
                <span style={{ display: "block", fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: "18px", color: "var(--l-text)" }}>Klientys</span>
                <span style={{ fontSize: "12px", color: "var(--l-text-3)" }}>{t.ob_step} {currentDisplayStep} {t.ob_of} {totalSteps}</span>
              </div>
            </div>
            <LangSelector />
          </div>

          {/* Progress bar */}
          <div style={{ height: "3px", background: "rgba(170,189,216,.12)", borderRadius: "2px", marginBottom: "28px", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: isFromGoogle ? "100%" : (step === 1 ? "50%" : "100%"),
              background: "linear-gradient(90deg,var(--l-teal-xl),var(--l-gold))",
              borderRadius: "2px",
              transition: "width .4s",
            }} />
          </div>

          <h1 style={{ fontSize: "22px", fontWeight: 800, fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", marginBottom: "24px", color: "var(--l-text)" }}>
            {t.ob_title}
          </h1>

          <form
            onSubmit={step === 1 && !isFromGoogle ? (e) => { e.preventDefault(); setStep(2); } : handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            {step === 1 && !isFromGoogle && (
              <>
                {/* honeypot */}
                <div style={{ position: "absolute", opacity: 0, height: 0, overflow: "hidden", pointerEvents: "none" }} aria-hidden="true">
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                </div>

                {/* Google signup */}
                <button
                  type="button"
                  onClick={handleGoogleSignup}
                  disabled={googleLoading}
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
                  {googleLoading ? "Redirection…" : "S'inscrire avec Google"}
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ flex: 1, height: "1px", background: "var(--l-border)" }} />
                  <span style={{ fontSize: "12px", color: "var(--l-text-3)" }}>ou</span>
                  <div style={{ flex: 1, height: "1px", background: "var(--l-border)" }} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <input className="d-input" placeholder={t.ob_firstname} value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
                  <input className="d-input" placeholder={t.ob_lastname} value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required />
                </div>
                <input className="d-input" type="email" placeholder={t.ob_email} value={form.email} onChange={(e) => set("email", e.target.value)} required />
                <input className="d-input" type="password" placeholder={t.ob_password} value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={8} />

                <button type="submit" className="l-btn l-btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: "4px" }}>
                  {t.ob_continue} →
                </button>
              </>
            )}

            {(step === 2 || isFromGoogle) && (
              <>
                <div>
                  <label className="d-label">{t.ob_biz}</label>
                  <input
                    className="d-input"
                    placeholder="Ex: Muntu Cura"
                    value={form.tenant_name}
                    onChange={(e) => { set("tenant_name", e.target.value); set("tenant_slug", slugify(e.target.value)); }}
                    required
                  />
                </div>

                <div>
                  <label className="d-label">{t.ob_url}</label>
                  <div className="d-input-prefix">
                    <span>votre-domaine.com/</span>
                    <input
                      value={form.tenant_slug}
                      onChange={(e) => set("tenant_slug", slugify(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="d-label">{t.ob_sector}</label>
                  <select className="d-select" value={form.sector} onChange={(e) => set("sector", e.target.value)}>
                    {SECTORS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="d-label">Pays</label>
                  <select className="d-select" value={form.country} onChange={(e) => set("country", e.target.value)}>
                    {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>

                {error && <p style={{ color: "#FC8181", fontSize: "13px", margin: 0 }}>{error}</p>}

                <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                  {!isFromGoogle && (
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="l-btn l-btn-ghost"
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      {t.ob_back}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="l-btn l-btn-primary"
                    style={{ flex: 1, justifyContent: "center", opacity: loading ? 0.6 : 1 }}
                  >
                    {loading ? t.ob_creating : t.ob_create}
                  </button>
                </div>
              </>
            )}
          </form>

          <p style={{ textAlign: "center", fontSize: "13px", color: "var(--l-text-2)", marginTop: "24px", marginBottom: 0 }}>
            {t.ob_already}{" "}
            <Link href="/login" style={{ color: "var(--l-teal-xl)", textDecoration: "none", fontWeight: 600 }}>
              {t.ob_login}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
