"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "../contexts/LanguageContext";
import { api } from "../lib/api";

type Step = { key: string; done: boolean; link: string };
type CompletionData = { score: number; steps: Step[] };
type Lang = "fr" | "en" | "de" | "nl";

const STEP_LABELS: Record<string, Record<Lang, string>> = {
  title:     { fr: "Configurer le site",     en: "Set up website",      de: "Website einrichten",    nl: "Website instellen"     },
  photos:    { fr: "Ajouter logo / photos",  en: "Add logo / photos",   de: "Logo / Fotos",          nl: "Logo / foto's"         },
  slots:     { fr: "Définir disponibilités", en: "Set availability",    de: "Verfügbarkeit",         nl: "Beschikbaarheid"       },
  offers:    { fr: "Ajouter une prestation", en: "Add a service",       de: "Leistung hinzufügen",   nl: "Dienst toevoegen"      },
  published: { fr: "Publier le site",        en: "Publish website",     de: "Website veröffentlichen", nl: "Website publiceren"  },
};

const UI: Record<Lang, { label: string; remaining: string }> = {
  fr: { label: "Espace configuré à",    remaining: "étape(s) restante(s)" },
  en: { label: "Space",                 remaining: "step(s) remaining"    },
  de: { label: "Bereich",              remaining: "Schritt(e) verbleibend" },
  nl: { label: "Ruimte",               remaining: "stap(pen) over"        },
};

export default function CompletionCard() {
  const { lang } = useLanguage() as { lang: Lang };
  const ui = UI[lang] ?? UI.fr;
  const [data, setData] = useState<CompletionData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.getProfileCompletion().then(setData).catch(() => {});
  }, []);

  if (!data || dismissed || data.score >= 100) return null;

  const missing = data.steps.filter((s) => !s.done);
  const next    = missing[0];

  return (
    <div className="bg-white border border-gray-100 rounded-xl px-4 py-2.5 shadow-sm mb-4 flex items-center gap-3">
      {/* Score */}
      <span className="flex-none text-xs font-semibold text-gray-500 whitespace-nowrap">
        {ui.label} <span className="text-gray-800 font-bold">{data.score}%</span>
      </span>

      {/* Barre */}
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-0">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${data.score}%`, background: "linear-gradient(90deg,#0D4B58,#1A6E82)" }}
        />
      </div>

      {/* Chips étapes manquantes */}
      <div className="flex items-center gap-1.5 flex-none">
        {missing.map((s) => (
          <Link
            key={s.key}
            href={s.link}
            className="text-xs px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:border-teal-400 hover:text-teal-700 whitespace-nowrap transition-colors"
          >
            {STEP_LABELS[s.key]?.[lang] ?? s.key}
          </Link>
        ))}
      </div>

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="flex-none text-gray-300 hover:text-gray-400 text-base leading-none"
        aria-label="Masquer"
      >
        ×
      </button>
    </div>
  );
}
