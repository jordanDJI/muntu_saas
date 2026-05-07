"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/api";
import { useLanguage, LangSelector } from "../contexts/LanguageContext";

const PROFILE_ICONS = ["🩺", "🔧", "💆", "⚖️", "✂️", "🏠"];
const PROFILE_KEYS_FR = [
  "Infirmier·ère indépendant·e",
  "Artisan & prestataire local",
  "Kinésithérapeute / Coach",
  "Consultant·e & profession libérale",
  "Esthéticien·ne & beauté",
  "Service à domicile",
];
const PROFILE_KEYS_EN = ["Independent nurse", "Artisan & local provider", "Physio / Coach", "Consultant & liberal profession", "Beauty professional", "Home service"];
const PROFILE_KEYS_DE = ["Selbstständige Krankenschwester", "Handwerker & Anbieter", "Physio / Coach", "Berater & freier Beruf", "Beauty-Profi", "Haushaltsservice"];
const PROFILE_KEYS_NL = ["Zelfstandige verpleegkundige", "Ambachtsman & aanbieder", "Fysiotherapeut / Coach", "Consultant & vrij beroep", "Schoonheidsspecialist", "Thuisdienst"];

const PROFILE_LABELS: Record<string, string[]> = {
  fr: PROFILE_KEYS_FR, en: PROFILE_KEYS_EN, de: PROFILE_KEYS_DE, nl: PROFILE_KEYS_NL,
};

export default function LandingPage() {
  const { t, lang } = useLanguage();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session);
    });
  }, []);

  const profiles = (PROFILE_LABELS[lang] ?? PROFILE_KEYS_FR).map((label, i) => ({
    emoji: PROFILE_ICONS[i],
    label,
  }));

  const features = [
    { icon: "🌐", title: t.feat_site_title,   description: t.feat_site_desc },
    { icon: "📬", title: t.feat_inbox_title,  description: t.feat_inbox_desc },
    { icon: "📅", title: t.feat_rdv_title,    description: t.feat_rdv_desc },
    { icon: "🤖", title: t.feat_bot_title,    description: t.feat_bot_desc },
    { icon: "⚡", title: t.feat_assist_title, description: t.feat_assist_desc },
    { icon: "📊", title: t.feat_roi_title,    description: t.feat_roi_desc },
  ];

  const steps = [
    { number: "01", title: t.step1_title, description: t.step1_desc },
    { number: "02", title: t.step2_title, description: t.step2_desc },
    { number: "03", title: t.step3_title, description: t.step3_desc },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-bold text-lg text-indigo-600">Présence&nbsp;Pro</span>
          <div className="flex items-center gap-2">
            <LangSelector />
            {loggedIn ? (
              <Link
                href="/dashboard"
                className="text-sm bg-indigo-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {t.nav_dashboard}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-gray-600 hover:text-indigo-600 font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  {t.nav_login}
                </Link>
                <Link
                  href="/onboarding"
                  className="text-sm bg-indigo-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {t.nav_signup}
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 bg-gradient-to-b from-indigo-50 to-white">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <span className="inline-block bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
            {t.land_badge}
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight">
            {t.land_h1}{" "}
            <span className="text-indigo-600">{t.land_h1_accent}</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">{t.land_sub}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href="/onboarding" className="bg-indigo-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-indigo-700 transition-colors text-sm">
              {t.land_cta}
            </Link>
            <Link href="/login" className="border border-gray-200 text-gray-700 font-semibold px-8 py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm">
              {t.land_cta2}
            </Link>
          </div>
          <p className="text-xs text-gray-400">{t.land_nocard}</p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">{t.land_feat_title}</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">{t.land_feat_sub}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-gray-50 rounded-2xl p-6 space-y-3 hover:shadow-md transition-shadow">
                <span className="text-3xl">{f.icon}</span>
                <h3 className="font-semibold text-gray-900">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-indigo-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">{t.land_how_title}</h2>
            <p className="text-gray-500 mt-3">{t.land_how_sub}</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.number} className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-600 text-white font-bold text-lg">
                  {s.number}
                </div>
                <h3 className="font-semibold text-gray-900 text-lg">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Profiles */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">{t.land_prof_title}</h2>
          <p className="text-gray-500 mb-10">{t.land_prof_sub}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {profiles.map((p) => (
              <div key={p.label} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-4 py-2 text-sm font-medium text-gray-700">
                <span>{p.emoji}</span>
                <span>{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dark CTA */}
      <section className="py-20 px-6 bg-gray-900 text-white">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold">{t.land_dark_title}</h2>
          <p className="text-gray-400 text-lg">{t.land_dark_text}</p>
          <Link href="/onboarding" className="inline-block bg-indigo-500 text-white font-semibold px-8 py-3 rounded-xl hover:bg-indigo-400 transition-colors text-sm">
            {t.land_dark_btn}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-bold text-indigo-600">Présence Pro</span>
          <div className="flex gap-6 text-sm text-gray-500">
            <Link href="/login" className="hover:text-indigo-600 transition-colors">{t.land_footer_login}</Link>
            <Link href="/onboarding" className="hover:text-indigo-600 transition-colors">{t.land_footer_signup}</Link>
          </div>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} Présence Pro. {t.land_footer_rights}</p>
        </div>
      </footer>
    </div>
  );
}
