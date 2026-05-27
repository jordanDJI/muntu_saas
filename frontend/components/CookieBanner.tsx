"use client";
import { useState, useEffect } from "react";

export type ConsentValue = "accepted" | "refused";

interface CookieBannerProps {
  consentKey?: string;
  privacyUrl?: string;
  accentColor?: string;
}

export function getCookieConsent(key = "klientys_cookie_consent"): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    return (localStorage.getItem(key) as ConsentValue) ?? null;
  } catch {
    return null;
  }
}

export default function CookieBanner({
  consentKey = "klientys_cookie_consent",
  privacyUrl = "/legal/privacy",
  accentColor,
}: CookieBannerProps) {
  // "pending" = pas encore vérifié (SSR / 1er rendu)
  // "needed"  = aucun choix stocké → afficher le banner
  // "done"    = choix déjà enregistré → ne plus afficher
  const [state, setState] = useState<"pending" | "needed" | "done">("pending");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(consentKey);
      setState(stored === "accepted" || stored === "refused" ? "done" : "needed");
    } catch {
      setState("done"); // localStorage bloqué (ex: iframe sandboxé) → ne pas afficher
    }
  }, [consentKey]);

  if (state !== "needed") return null;

  const decide = (value: ConsentValue) => {
    try {
      localStorage.setItem(consentKey, value);
    } catch { /* silencieux */ }
    window.dispatchEvent(new CustomEvent("cookie-consent", { detail: { key: consentKey, value } }));
    setState("done");
  };

  const acceptStyle = accentColor
    ? { backgroundColor: accentColor, color: "#fff", border: "none" }
    : undefined;

  return (
    <div
      role="dialog"
      aria-label="Consentement cookies"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200"
      style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
    >
      <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8">
        <p className="flex-1 text-sm text-gray-600 leading-relaxed">
          <span className="font-semibold text-gray-800">🍪 Ce site utilise des cookies</span> pour analyser
          votre navigation et améliorer votre expérience. Aucun cookie n'est déposé sans votre accord.{" "}
          <a href={privacyUrl} className="text-gray-500 underline hover:text-gray-700 text-xs">
            Politique de confidentialité
          </a>
        </p>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            onClick={() => decide("refused")}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Refuser
          </button>
          <button
            onClick={() => decide("accepted")}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${accentColor ? "" : "bg-primary-600 hover:bg-primary-700 text-white"}`}
            style={acceptStyle}
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
