"use client";
import { useEffect, useState } from "react";
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
    </div>
  );
}
