"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/api";
import { useLanguage, LangSelector } from "../../contexts/LanguageContext";

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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        first_name: form.first_name,
        last_name: form.last_name,
        tenant_name: form.tenant_name,
        tenant_slug: form.tenant_slug,
        sector: form.sector,
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
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t.ob_title}</h1>
            <p className="text-gray-500 text-sm mt-1">{t.ob_step} {step} {t.ob_of} 2</p>
          </div>
          <LangSelector />
        </div>

        <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2); } : handleSubmit} className="space-y-4">

          {step === 1 && (
            <>
              <div style={{ position: "absolute", opacity: 0, height: 0, overflow: "hidden", pointerEvents: "none" }} aria-hidden="true">
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder={t.ob_firstname} value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <input placeholder={t.ob_lastname} value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <input type="email" placeholder={t.ob_email} value={form.email} onChange={(e) => set("email", e.target.value)} required className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="password" placeholder={t.ob_password} value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={8} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700">
                {t.ob_continue}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">{t.ob_biz}</label>
                <input
                  placeholder="Ex: Muntu Cura"
                  value={form.tenant_name}
                  onChange={(e) => { set("tenant_name", e.target.value); set("tenant_slug", slugify(e.target.value)); }}
                  required
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">{t.ob_url}</label>
                <div className="flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                  <span className="bg-gray-100 px-3 py-2 text-gray-500 text-sm border-r">votre-domaine.com/</span>
                  <input
                    value={form.tenant_slug}
                    onChange={(e) => set("tenant_slug", slugify(e.target.value))}
                    required
                    className="flex-1 px-3 py-2 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">{t.ob_sector}</label>
                <select value={form.sector} onChange={(e) => set("sector", e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {SECTORS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="flex-1 border rounded-lg py-2.5 text-gray-600 hover:bg-gray-50">
                  {t.ob_back}
                </button>
                <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50">
                  {loading ? t.ob_creating : t.ob_create}
                </button>
              </div>
            </>
          )}
        </form>

        <p className="text-center text-sm text-gray-500">
          {t.ob_already}{" "}
          <Link href="/login" className="text-indigo-600 hover:underline font-medium">{t.ob_login}</Link>
        </p>
      </div>
    </main>
  );
}
