"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../contexts/LanguageContext";

const DemandMap = dynamic(() => import("./DemandMap"), { ssr: false });

type Period = "week" | "month" | "quarter" | "year";

function ScoreBar({ score }: { score: number }) {
  const color = score >= 67 ? "bg-green-500" : score >= 34 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-8 text-right">{score}</span>
    </div>
  );
}

function MiniChart({ points }: { points: { date: string; value: number }[] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points.map((p) => p.value), 1);
  const w = 100 / points.length;
  return (
    <svg viewBox="0 0 100 32" className="w-full h-8" preserveAspectRatio="none">
      <polyline
        points={points.map((p, i) => `${i * w + w / 2},${32 - (p.value / max) * 28}`).join(" ")}
        fill="none"
        stroke="#0D4B58"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function DemandPotentialCard() {
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  // Mots-clés
  const [showKwModal,  setShowKwModal]  = useState(false);
  const [kwCustom,     setKwCustom]     = useState<string[]>([]);
  const [kwDefaults,   setKwDefaults]   = useState<string[]>([]);
  const [kwDraft,      setKwDraft]      = useState<string[]>([]);
  const [kwInput,      setKwInput]      = useState("");
  const [kwSaving,     setKwSaving]     = useState(false);
  const [kwSaved,      setKwSaved]      = useState(false);
  const [showTooltip,  setShowTooltip]  = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Ferme le tooltip si on clique en dehors (touch + souris)
  useEffect(() => {
    if (!showTooltip) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [showTooltip]);

  const PERIODS: { key: Period; label: string }[] = [
    { key: "week",    label: t.dem_period_week },
    { key: "month",   label: t.dem_period_month },
    { key: "quarter", label: t.dem_period_quarter },
    { key: "year",    label: t.dem_period_year },
  ];

  const load = async (p: Period) => {
    setLoading(true); setError("");
    try {
      setData(await api.getRoiPotential(p));
    } catch (e: any) {
      setError(e.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const openKwModal = async () => {
    try {
      const kw = await api.getTrendKeywords();
      setKwCustom(kw.custom);
      setKwDefaults(kw.defaults);
      setKwDraft(kw.custom.length ? [...kw.custom] : [...kw.defaults]);
    } catch { /* silencieux */ }
    setShowKwModal(true);
  };

  const addKw = () => {
    const v = kwInput.trim();
    if (!v || kwDraft.includes(v) || kwDraft.length >= 10) return;
    setKwDraft(prev => [...prev, v]);
    setKwInput("");
  };

  const removeKw = (kw: string) => setKwDraft(prev => prev.filter(k => k !== kw));

  const saveKw = async () => {
    setKwSaving(true);
    try {
      await api.updateTrendKeywords(kwDraft);
      setKwCustom(kwDraft);
      setKwSaved(true);
      setTimeout(() => { setKwSaved(false); setShowKwModal(false); load(period); }, 1200);
    } catch { /* silencieux */ }
    finally { setKwSaving(false); }
  };

  const resetKw = () => setKwDraft([...kwDefaults]);

  useEffect(() => { load("month"); }, []);

  const switchPeriod = (p: Period) => { setPeriod(p); load(p); };

  const zones: any[]      = data?.zones ?? [];
  const related: string[] = data?.related_queries ?? [];
  const chart: any[]      = data?.interest_over_time ?? [];
  const agg: number       = data?.aggregate_score ?? 0;
  const keywords: string[] = data?.keywords ?? [];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-800">{t.dem_title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t.dem_subtitle}</p>
        </div>
        <div className="flex gap-1">
          {PERIODS.map((per) => (
            <button
              key={per.key}
              onClick={() => switchPeriod(per.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                period === per.key
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {per.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 gap-2">
          <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">{t.dem_loading}</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          <div>
            <p className="text-xs font-semibold text-amber-800">{t.dem_error_title}</p>
            <p className="text-xs text-amber-600 mt-0.5">
              {error.includes("inaccessible") || error.includes("localhost")
                ? t.dem_error_msg
                : error}
            </p>
          </div>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Score agrégé */}
          <div className="flex items-center gap-4 p-3 bg-primary-50 rounded-xl">
            <div className="text-3xl font-bold text-primary-700 w-12 text-center">{agg}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary-800">{t.dem_score}</p>
              <p className="text-[11px] text-primary-500 truncate">
                {t.dem_keywords} : {keywords.slice(0, 3).join(", ")}
              </p>
              <div className="mt-1.5"><ScoreBar score={agg} /></div>
            </div>
            {/* Boutons mots-clés */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Tooltip ? */}
              <div className="relative" ref={tooltipRef}>
                <button
                  onClick={() => setShowTooltip(v => !v)}
                  aria-label="Explication mots-clés"
                  className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors"
                  style={{ background: "rgba(13,75,88,0.1)", color: "#0D4B58" }}>
                  ?
                </button>
                {showTooltip && (
                  <div className="absolute right-0 bottom-7 z-20 w-56 text-xs rounded-xl p-3 shadow-lg"
                    style={{ background: "#07222F", color: "#AABDD8", border: "1px solid rgba(170,189,216,0.15)" }}>
                    {t.dem_kw_tooltip}
                    <div className="absolute right-2 -bottom-1.5 w-3 h-3 rotate-45"
                      style={{ background: "#07222F", borderRight: "1px solid rgba(170,189,216,0.15)", borderBottom: "1px solid rgba(170,189,216,0.15)" }} />
                  </div>
                )}
              </div>
              {/* Affiner */}
              <button onClick={openKwModal}
                className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors"
                style={{ background: "rgba(13,75,88,0.1)", color: "#0D4B58" }}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
                {t.dem_kw_btn}
              </button>
            </div>
          </div>

          {/* Tendance */}
          {chart.length > 1 && (
            <div>
              <p className="text-[11px] text-gray-400 mb-1">{t.dem_trend}</p>
              <MiniChart points={chart} />
            </div>
          )}

          {/* Zones */}
          {zones.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-700">{t.dem_zones}</p>
              <div className="space-y-2">
                {zones.map((z) => (
                  <div key={z.name} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-24 truncate">{z.name}</span>
                    <div className="flex-1"><ScoreBar score={z.score ?? 0} /></div>
                  </div>
                ))}
              </div>
              {zones.some((z) => z.lat) && (
                <div className="rounded-xl overflow-hidden border border-gray-100">
                  <DemandMap zones={zones} />
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic text-center py-2">
              {t.dem_no_zones}
            </p>
          )}

          {/* Requêtes associées */}
          {related.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">{t.dem_related}</p>
              <div className="flex flex-wrap gap-1.5">
                {related.map((q) => (
                  <span key={q} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{q}</span>
                ))}
              </div>
            </div>
          )}

          {data.cached_at && (
            <p className="text-[10px] text-gray-300 text-right">
              {t.dem_cached_at} {new Date(data.cached_at).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" })}
            </p>
          )}
        </>
      )}

      {/* Modal mots-clés */}
      {showKwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowKwModal(false); }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl bg-white">

            {/* Header */}
            <div className="px-5 py-4 flex items-start justify-between"
              style={{ background: "linear-gradient(135deg, #0D4B58 0%, #1A6E82 100%)" }}>
              <div>
                <h2 className="text-sm font-semibold text-white">{t.dem_kw_modal_title}</h2>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>
                  {t.dem_kw_modal_desc}
                </p>
              </div>
              <button onClick={() => setShowKwModal(false)} className="text-white/60 hover:text-white text-xl ml-3">×</button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Chips actifs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-700">{t.dem_kw_active}</p>
                  <span className="text-[10px] text-gray-400">{kwDraft.length}/10</span>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-8">
                  {kwDraft.map(kw => (
                    <span key={kw}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(13,75,88,0.08)", color: "#0D4B58", border: "1px solid rgba(13,75,88,0.2)" }}>
                      {kw}
                      <button onClick={() => removeKw(kw)} className="text-current opacity-50 hover:opacity-100 leading-none">×</button>
                    </span>
                  ))}
                  {kwDraft.length === 0 && (
                    <p className="text-xs text-gray-300 italic">{t.dem_kw_empty}</p>
                  )}
                </div>
              </div>

              {/* Champ ajout */}
              <div className="flex gap-2">
                <input
                  value={kwInput}
                  onChange={e => setKwInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKw(); } }}
                  placeholder={t.dem_kw_ph}
                  disabled={kwDraft.length >= 10}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-teal-600 disabled:opacity-40" />
                <button onClick={addKw} disabled={!kwInput.trim() || kwDraft.length >= 10}
                  className="px-3 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
                  style={{ background: "#0D4B58" }}>
                  +
                </button>
              </div>
              <p className="text-[10px] text-gray-400 -mt-2">{t.dem_kw_hint}</p>

              {/* Reset */}
              <button onClick={resetKw}
                className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
                {t.dem_kw_reset}
              </button>

              {/* Actions */}
              <div className="flex gap-2 pt-1 pb-1">
                <button onClick={() => setShowKwModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">
                  {t.dem_kw_cancel}
                </button>
                <button onClick={saveKw} disabled={kwSaving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: kwSaved ? "#22c55e" : "#0D4B58" }}>
                  {kwSaved ? t.dem_kw_saved : kwSaving ? t.dem_kw_saving : t.dem_kw_save}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
