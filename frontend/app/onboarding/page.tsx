"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/api";
import { useLanguage, LangSelector } from "../../contexts/LanguageContext";
import { COUNTRIES } from "../../lib/countries";

export default function OnboardingPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [honeypot, setHoneypot] = useState("");

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

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (honeypot) return;
    setError("");
    setLoading(true);

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

    let { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (loginError) {
        setError("Compte créé mais connexion impossible : " + loginError.message);
        setLoading(false);
        return;
      }
      const refreshed = await supabase.auth.getSession();
      sessionData = refreshed.data;
    }
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("Impossible de récupérer la session. Désactive la confirmation email dans Supabase.");
      setLoading(false);
      return;
    }

    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
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
                <span style={{ fontSize: "12px", color: "var(--l-text-3)" }}>{t.ob_step} {step} {t.ob_of} 2</span>
              </div>
            </div>
            <LangSelector />
          </div>

          {/* Progress bar */}
          <div style={{ height: "3px", background: "rgba(170,189,216,.12)", borderRadius: "2px", marginBottom: "28px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: step === 1 ? "50%" : "100%", background: "linear-gradient(90deg,var(--l-teal-xl),var(--l-gold))", borderRadius: "2px", transition: "width .4s" }} />
          </div>

          <h1 style={{ fontSize: "22px", fontWeight: 800, fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", marginBottom: "24px", color: "var(--l-text)" }}>
            {t.ob_title}
          </h1>

          <form
            onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2); } : handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            {step === 1 && (
              <>
                {/* honeypot */}
                <div style={{ position: "absolute", opacity: 0, height: 0, overflow: "hidden", pointerEvents: "none" }} aria-hidden="true">
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
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

            {step === 2 && (
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
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="l-btn l-btn-ghost"
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    {t.ob_back}
                  </button>
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
