"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Lang, T, LANGUAGES, translations, getLang, setLangStorage } from "../lib/i18n";

export { LANGUAGES, type Lang };

type LanguageCtx = {
  lang: Lang;
  t: T;
  setLang: (l: Lang) => void;
};

const LanguageContext = createContext<LanguageCtx>({
  lang: "fr",
  t: translations.fr,
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    setLangState(getLang());
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    setLangStorage(l);
  };

  return (
    <LanguageContext.Provider value={{ lang, t: translations[lang], setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/** Compact language selector — dropdown style, works on landing + onboarding + settings. */
export function LangSelector({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLanguage();
  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      className={`text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer ${className}`}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.flag} {l.label}
        </option>
      ))}
    </select>
  );
}
