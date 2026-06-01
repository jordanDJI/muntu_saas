"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function adminFetch<T>(path: string): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Couleurs Klientys
const K = {
  teal:    "#0D4B58",
  tealL:   "#1A6E82",
  tealXL:  "#2A8FA5",
  gold:    "#DDAA40",
  goldL:   "#F0CC68",
  blue:    "#AABDD8",
  card:    "#0D1B25",
  card2:   "#0A1520",
  border:  "rgba(170,189,216,0.10)",
  text:    "#EEF2F5",
  muted:   "#8BA5B0",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:        { label: "Payants actifs",  color: K.tealXL   },
  trialing:      { label: "Stripe trial",    color: K.blue     },
  trial:         { label: "Essai en cours",  color: K.gold     },
  trial_expired: { label: "Essai expiré",    color: "#E06060"  },
  suspended:     { label: "Suspendus",       color: "rgba(170,189,216,0.3)" },
};

function Sparkline({ data }: { data: { date: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return null;

  const max = Math.max(...data.map(d => d.count), 1);
  const W = 400; const H = 80; const padX = 4; const padY = 12;

  const pts = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * (W - padX * 2),
    y: H - padY - ((d.count / max) * (H - padY * 2)),
    ...d,
  }));

  const polyline = pts.map(p => `${p.x},${p.y}`).join(" ");

  // aire sous la courbe
  const area = `${pts[0].x},${H} ` + pts.map(p => `${p.x},${p.y}`).join(" ") + ` ${pts[pts.length - 1].x},${H}`;

  const hov = hover !== null ? pts[hover] : null;

  return (
    <div className="relative select-none">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#2A8FA5" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#2A8FA5" stopOpacity="0.0"  />
          </linearGradient>
        </defs>

        {/* Aire */}
        <polygon points={area} fill="url(#spark-fill)" />

        {/* Ligne */}
        <polyline points={polyline} fill="none" stroke="#2A8FA5" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />

        {/* Ligne verticale hover */}
        {hov && (
          <line x1={hov.x} y1={padY / 2} x2={hov.x} y2={H}
            stroke="rgba(170,189,216,0.2)" strokeWidth="1" strokeDasharray="3,3" />
        )}

        {/* Points */}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y}
            r={hover === i ? 4.5 : p.count > 0 ? 2.5 : 0}
            fill={hover === i ? "#DDAA40" : "#2A8FA5"}
            stroke={hover === i ? "rgba(221,170,64,0.3)" : "none"}
            strokeWidth={hover === i ? 6 : 0}
            style={{ transition: "r 0.15s, fill 0.15s" }}
          />
        ))}

        {/* Zones de hit invisibles */}
        {pts.map((p, i) => (
          <rect key={i}
            x={i === 0 ? 0 : (pts[i - 1].x + p.x) / 2}
            y={0}
            width={
              i === 0
                ? (pts[1].x + p.x) / 2
                : i === pts.length - 1
                  ? W - (pts[i - 1].x + p.x) / 2
                  : ((pts[i + 1]?.x ?? p.x) + p.x) / 2 - (pts[i - 1].x + p.x) / 2
            }
            height={H}
            fill="transparent"
            style={{ cursor: "crosshair" }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {hov && (
        <div
          className="absolute pointer-events-none px-2.5 py-1.5 rounded-lg text-xs"
          style={{
            background: "#0A1520",
            border: "1px solid rgba(170,189,216,0.2)",
            color: "#EEF2F5",
            top: Math.max(0, (hov.y / H) * 80 - 44),
            left: `clamp(0px, calc(${(hov.x / W) * 100}% - 48px), calc(100% - 96px))`,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          <span style={{ color: "#8BA5B0" }}>{hov.date}</span>
          <span className="mx-1.5" style={{ color: "rgba(170,189,216,0.3)" }}>·</span>
          <span style={{ color: "#DDAA40", fontWeight: 600 }}>{hov.count} nouveau{hov.count > 1 ? "x" : ""}</span>
        </div>
      )}
    </div>
  );
}

export default function AdminMetricsPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [growth,  setGrowth]  = useState<any[]>([]);
  const [logs,    setLogs]    = useState<any[]>([]);
  const [error,   setError]   = useState("");

  useEffect(() => {
    Promise.all([
      adminFetch<any>("/api/v1/admin/metrics"),
      adminFetch<any[]>("/api/v1/admin/metrics/growth?days=30"),
      adminFetch<any>("/api/v1/admin/action-log?page=1&page_size=8"),
    ])
      .then(([m, g, l]) => { setMetrics(m); setGrowth(g); setLogs(l.items ?? l); })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-8" style={{ color: "#E06060" }}>{error}</div>;
  if (!metrics) return (
    <div className="p-8 flex justify-center">
      <div className="w-6 h-6 rounded-full animate-spin" style={{ border: `2px solid ${K.border}`, borderTopColor: K.tealL }} />
    </div>
  );

  const { tenants, new_signups, sites_published, appointments_30d, trial_to_paid_rate, mrr } = metrics;
  const paid = (tenants.active ?? 0) + (tenants.trialing ?? 0);
  const totalGrowth = growth.reduce((a, d) => a + d.count, 0);

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-xl font-semibold mb-1" style={{ color: K.text }}>Métriques</h1>
      <p className="text-sm mb-8" style={{ color: K.muted }}>Vue d'ensemble du SaaS</p>

      {/* Statuts par tenant */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {Object.entries(STATUS_CONFIG).map(([key, { label, color }]) => (
          <Link key={key} href={`/admin/tenants?status=${key}`}
            className="rounded-xl p-4 block transition-colors"
            style={{ background: K.card, border: `1px solid ${K.border}` }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(170,189,216,0.22)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = K.border; }}
          >
            <p className="text-xs mb-1" style={{ color: K.muted }}>{label}</p>
            <p className="text-2xl font-bold" style={{ color }}>{tenants[key] ?? 0}</p>
          </Link>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total tenants"          value={tenants.total ?? 0}         unit=""   color={K.text}    />
        <KpiCard label="MRR"                    value={mrr ?? 0}                   unit=" €" color={K.tealXL}  />
        <KpiCard label="Conversion trial→payé"  value={trial_to_paid_rate ?? 0}    unit="%"  color={K.gold}    />
        <KpiCard label="Payants actifs"          value={paid}                       unit=""   color={K.tealXL}  />
        <KpiCard label="Nouveaux (7 j)"         value={new_signups?.last_7d ?? 0}  unit=""   color={K.text}    />
        <KpiCard label="Nouveaux (30 j)"        value={new_signups?.last_30d ?? 0} unit=""   color={K.text}    />
        <KpiCard label="Sites publiés"          value={sites_published ?? 0}       unit=""   color={K.text}    />
        <KpiCard label="RDV ce mois"            value={appointments_30d ?? 0}      unit=""   color={K.text}    />
      </div>

      {/* Graphique croissance */}
      <div className="rounded-xl p-5 mb-6" style={{ background: K.card, border: `1px solid ${K.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium" style={{ color: K.muted }}>Nouveaux tenants — 30 derniers jours</h2>
          <span className="text-xs font-semibold" style={{ color: K.tealXL }}>{totalGrowth} au total</span>
        </div>
        <Sparkline data={growth} />
        <div className="flex justify-between mt-1">
          <span className="text-xs" style={{ color: "rgba(170,189,216,0.3)" }}>{growth[0]?.date}</span>
          <span className="text-xs" style={{ color: "rgba(170,189,216,0.3)" }}>{growth[growth.length - 1]?.date}</span>
        </div>
      </div>

      {/* Log récent */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium" style={{ color: K.muted }}>Actions récentes</h2>
        <Link href="/admin/log" className="text-xs transition-colors" style={{ color: K.tealXL }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = K.gold; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = K.tealXL; }}>
          Voir tout →
        </Link>
      </div>
      {logs.length === 0 ? (
        <p className="text-sm" style={{ color: "rgba(170,189,216,0.25)" }}>Aucune action enregistrée</p>
      ) : (
        <div className="space-y-1">
          {logs.map((l: any) => (
            <div key={l.id} className="rounded-lg px-4 py-2.5 flex items-center gap-4 text-sm"
              style={{ background: K.card, border: `1px solid ${K.border}` }}>
              <span className="font-mono text-xs shrink-0" style={{ color: K.tealXL }}>{l.action_type}</span>
              {l.target_tenant_name && (
                <Link href={`/admin/tenants/${l.target_tenant_id}`}
                  className="transition-colors truncate text-sm"
                  style={{ color: "rgba(170,189,216,0.6)" }}>
                  {l.target_tenant_name}
                </Link>
              )}
              <span className="ml-auto text-xs shrink-0" style={{ color: "rgba(170,189,216,0.3)" }}>
                {new Date(l.created_at).toLocaleString("fr-FR")}
              </span>
              <span className="text-xs shrink-0 hidden sm:block" style={{ color: "rgba(170,189,216,0.25)" }}>
                {l.admin_email}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  const K_card = "#0D1B25";
  const K_border = "rgba(170,189,216,0.10)";
  const K_muted = "#8BA5B0";
  return (
    <div className="rounded-xl p-4" style={{ background: K_card, border: `1px solid ${K_border}` }}>
      <p className="text-xs mb-1" style={{ color: K_muted }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}{unit}</p>
    </div>
  );
}
