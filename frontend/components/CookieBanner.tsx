"use client";
import { useState, useEffect } from "react";

export type ConsentValue = "accepted" | "refused" | "custom";

export interface ConsentDetail {
  analytics: boolean;
  marketing: boolean;
}

const STORAGE_KEY_BASE = "klientys_cookie_consent";
const STORAGE_KEY_DETAIL = "klientys_cookie_detail";

export function getCookieConsent(key = STORAGE_KEY_BASE): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    return (localStorage.getItem(key) as ConsentValue) ?? null;
  } catch {
    return null;
  }
}

export function getCookieConsentDetail(): ConsentDetail {
  if (typeof window === "undefined") return { analytics: false, marketing: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DETAIL);
    if (raw) return JSON.parse(raw) as ConsentDetail;
  } catch { /* silencieux */ }
  const global = getCookieConsent();
  return { analytics: global === "accepted", marketing: global === "accepted" };
}

interface CookieBannerProps {
  consentKey?: string;
  privacyUrl?: string;
  accentColor?: string;
}

const CATEGORIES = [
  {
    key: "functional" as const,
    label: "Fonctionnels",
    desc: "Nécessaires au fonctionnement du site (session, préférences). Toujours actifs.",
    locked: true,
  },
  {
    key: "analytics" as const,
    label: "Analytiques",
    desc: "Mesure d'audience anonymisée via Google Analytics 4.",
    locked: false,
  },
  {
    key: "marketing" as const,
    label: "Marketing",
    desc: "Publicité ciblée et reciblage via Meta Pixel / GTM.",
    locked: false,
  },
];

export default function CookieBanner({
  consentKey = STORAGE_KEY_BASE,
  privacyUrl = "/legal/privacy",
  accentColor,
}: CookieBannerProps) {
  const [state, setState]       = useState<"pending" | "needed" | "done">("pending");
  const [visible, setVisible]   = useState(false);
  const [view, setView]         = useState<"main" | "custom">("main");
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(consentKey);
      if (stored === "accepted" || stored === "refused" || stored === "custom") {
        setState("done");
      } else {
        setState("needed");
        setTimeout(() => setVisible(true), 150);
      }
    } catch {
      setState("done");
    }
  }, [consentKey]);

  if (state !== "needed") return null;

  const save = (value: ConsentValue, detail: ConsentDetail) => {
    setVisible(false);
    setTimeout(() => {
      try {
        localStorage.setItem(consentKey, value);
        localStorage.setItem(STORAGE_KEY_DETAIL, JSON.stringify(detail));
      } catch { /* silencieux */ }
      window.dispatchEvent(new CustomEvent("cookie-consent", { detail: { key: consentKey, value, ...detail } }));
      setState("done");
    }, 220);
  };

  const acceptAll  = () => save("accepted", { analytics: true,     marketing: true });
  const refuseAll  = () => save("refused",  { analytics: false,    marketing: false });
  const saveCustom = () => save("custom",   { analytics, marketing });

  const primary = accentColor ?? "#0D4B58";

  return (
    <div
      role="dialog"
      aria-label="Consentement cookies"
      className="fixed bottom-5 left-5 z-[9999] w-[min(340px,calc(100vw-24px))]"
      style={{
        transform: visible ? "translateY(0)" : "translateY(16px)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.22s ease, opacity 0.22s ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "#fff",
          border: "1px solid #E2EAF0",
          boxShadow: "0 12px 40px rgba(7,34,47,0.14), 0 2px 8px rgba(7,34,47,0.06)",
        }}
      >
        {/* Bande dégradé charte */}
        <div style={{ height: "4px", background: accentColor ?? "linear-gradient(90deg,#0D4B58 0%,#DDAA40 100%)" }} />

        <div className="p-5">
          {/* ── Vue principale ── */}
          {view === "main" && (
            <>
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className="text-xl leading-none">🍪</span>
                <p className="font-bold text-sm" style={{ color: "#07222F" }}>Gestion des cookies</p>
              </div>
              <p className="text-xs leading-relaxed mb-4" style={{ color: "#5C7A8A" }}>
                Nous utilisons des cookies pour analyser votre navigation et améliorer votre expérience.
                Aucun cookie n&apos;est déposé sans votre accord.{" "}
                <a href={privacyUrl} className="underline hover:opacity-75" style={{ color: primary }}>
                  En savoir plus
                </a>
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={refuseAll}
                    className="flex-1 py-2 text-xs font-medium rounded-lg transition-colors"
                    style={{ background: "#F4F8FA", color: "#1E3A47", border: "1px solid #E2EAF0" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#E2EAF0")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#F4F8FA")}
                  >
                    Tout refuser
                  </button>
                  <button
                    onClick={acceptAll}
                    className="flex-1 py-2 text-xs font-semibold rounded-lg text-white"
                    style={{ background: primary }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                  >
                    Tout accepter
                  </button>
                </div>
                <button
                  onClick={() => setView("custom")}
                  className="w-full py-2 text-xs font-medium rounded-lg transition-colors"
                  style={{ color: primary, border: `1px solid ${primary}20`, background: `${primary}08` }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${primary}14`)}
                  onMouseLeave={e => (e.currentTarget.style.background = `${primary}08`)}
                >
                  ⚙️ Personnaliser mes choix
                </button>
              </div>
            </>
          )}

          {/* ── Vue personnalisation ── */}
          {view === "custom" && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setView("main")}
                  className="text-xs hover:opacity-70 transition-opacity"
                  style={{ color: "#5C7A8A" }}
                  aria-label="Retour"
                >
                  ← Retour
                </button>
                <p className="font-bold text-sm ml-auto" style={{ color: "#07222F" }}>Mes préférences</p>
              </div>

              <div className="space-y-3 mb-4">
                {CATEGORIES.map(cat => {
                  const isOn = cat.locked
                    ? true
                    : cat.key === "analytics" ? analytics : marketing;
                  const toggle = cat.locked ? undefined : cat.key === "analytics"
                    ? () => setAnalytics(v => !v)
                    : () => setMarketing(v => !v);

                  return (
                    <div
                      key={cat.key}
                      className="flex items-start gap-3 p-3 rounded-xl"
                      style={{ background: "#F4F8FA", border: "1px solid #E2EAF0" }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-xs font-semibold" style={{ color: "#07222F" }}>{cat.label}</p>
                          {cat.locked && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                              style={{ background: "#C6E5EA", color: "#0D4B58" }}>
                              Requis
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed" style={{ color: "#5C7A8A" }}>{cat.desc}</p>
                      </div>

                      {/* Toggle switch */}
                      <button
                        type="button"
                        onClick={toggle}
                        disabled={cat.locked}
                        aria-checked={isOn}
                        role="switch"
                        className="shrink-0 mt-0.5 rounded-full transition-colors"
                        style={{
                          width: "36px",
                          height: "20px",
                          background: isOn ? primary : "#B8C5D1",
                          opacity: cat.locked ? 0.6 : 1,
                          position: "relative",
                          border: "none",
                          cursor: cat.locked ? "not-allowed" : "pointer",
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: "3px",
                            left: isOn ? "19px" : "3px",
                            width: "14px",
                            height: "14px",
                            borderRadius: "50%",
                            background: "#fff",
                            transition: "left 0.18s ease",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                          }}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={saveCustom}
                className="w-full py-2.5 text-xs font-semibold rounded-lg text-white"
                style={{ background: primary }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                Sauvegarder mes préférences
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
