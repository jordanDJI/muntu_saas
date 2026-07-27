"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const K = {
  card:   "#0D1B25", card2: "#0A1520",
  border: "rgba(170,189,216,0.10)",
  text:   "#EEF2F5", muted: "#8BA5B0",
  teal:   "#0D4B58", tealL: "#1A6E82", tealXL: "#2A8FA5",
  gold:   "#DDAA40", green: "#4ACA7A", red: "#E06060",
  purple: "#8B7DD8", amber: "#D97706", blue: "#4A9FDA",
};

/* ── Types ──────────────────────────────────────────────────────────────── */
type KPIs = {
  sessions: number; users: number; new_users: number;
  pageviews: number; bounce_rate: number; avg_session_duration: number;
  engaged_sessions: number;
};
type DayData     = { date: string; sessions: number };
type PageData    = { page: string; sessions: number; pageviews: number; avg_time: number };
type SourceData  = { source: string; sessions: number };
type GeoData     = { country?: string; city?: string; sessions: number };
type EventData   = { event: string; count: number };
type CampaignData= { source: string; medium: string; sessions: number };
type BlogPage    = { page: string; title: string; pageviews: number; avg_time: number };
type AnnPage     = { page: string; pageviews: number };
type EntryPage   = { page: string; sessions: number };
type Devices     = { mobile: number; desktop: number; tablet: number };
type NvR         = { new: number; returning: number };

type GAData = {
  kpis: KPIs;
  sessions_by_day: DayData[];
  traffic_sources: SourceData[];
  devices: Devices;
  new_vs_returning: NvR;
  top_pages: PageData[];
  countries: GeoData[];
  cities: GeoData[];
  entry_pages: EntryPage[];
  events: EventData[];
  campaigns: CampaignData[];
  blog: { total_pageviews: number; pages: BlogPage[] };
  annuaire: { total_pageviews: number; pages: AnnPage[] };
  period: number;
};
type RTData = { active_users: number; active_pages: { page: string; users: number }[] };

/* ── Constants ──────────────────────────────────────────────────────────── */
const SOURCE_COLORS: Record<string, string> = {
  "Organic Search": K.tealXL, "Direct": K.gold, "Organic Social": K.purple,
  "Referral": K.green, "Email": K.amber, "Paid Search": K.blue, "Paid Social": "#C084FC",
};

/* ── Helpers ────────────────────────────────────────────────────────────── */
function fmtDuration(s: number) {
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}
function fmtGaDate(d: string) {
  const y = d.slice(0, 4), mo = d.slice(4, 6), day = d.slice(6, 8);
  return new Date(`${y}-${mo}-${day}`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function trunc(s: string, n = 28) {
  if (!s || s === "/") return "/ (accueil)";
  return s.length > n ? "…" + s.slice(-(n - 1)) : s;
}

/* ── SVG Line Chart ─────────────────────────────────────────────────────── */
function LineChart({ data }: { data: DayData[] }) {
  if (!data.length) return null;
  const W = 560, H = 100, PAD = 4;
  const max = Math.max(...data.map(d => d.sessions), 1);
  const pts = data.map((d, i) => ({
    x: PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2),
    y: PAD + (1 - d.sessions / max) * (H - PAD * 2),
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${pts[pts.length - 1].x},${H} L ${pts[0].x},${H} Z`;
  const every = Math.ceil(data.length / 7);
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: "100%", minWidth: 280 }}>
        <defs>
          <linearGradient id="ga-lg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1A6E82" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#1A6E82" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map(f => (
          <line key={f} x1={PAD} y1={PAD + (1 - f) * (H - PAD * 2)} x2={W - PAD} y2={PAD + (1 - f) * (H - PAD * 2)}
            stroke="rgba(170,189,216,0.06)" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#ga-lg)" />
        <path d={line} fill="none" stroke="#1A6E82" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {[0, pts.length - 1].map(i => (
          <circle key={i} cx={pts[i].x} cy={pts[i].y} r="3" fill="#2A8FA5" />
        ))}
        {data.map((d, i) => i % every === 0 && (
          <text key={i} x={pts[i].x} y={H + 16} textAnchor="middle" fontSize="9" fill="rgba(170,189,216,0.4)">
            {fmtGaDate(d.date)}
          </text>
        ))}
        <text x={W - PAD} y={PAD + 4} textAnchor="end" fontSize="9" fill="rgba(170,189,216,0.3)">
          {max.toLocaleString("fr-FR")}
        </text>
      </svg>
    </div>
  );
}

/* ── Donut Chart ────────────────────────────────────────────────────────── */
function DonutChart({ segments, colors, size = 80 }: {
  segments: { label: string; value: number }[];
  colors: string[];
  size?: number;
}) {
  const total = segments.reduce((s, d) => s + d.value, 0) || 1;
  const R = 38, inner = 22, cx = 50, cy = 50;
  let cum = -Math.PI / 2;

  const arcs = segments.map((seg, i) => {
    const a = (seg.value / total) * Math.PI * 2;
    if (a < 0.01) { cum += a; return null; }
    const s = cum, e = cum + a;
    cum = e;
    const cos = (angle: number, r: number) => cx + r * Math.cos(angle);
    const sin = (angle: number, r: number) => cy + r * Math.sin(angle);
    const lg = a > Math.PI ? 1 : 0;
    return {
      d: `M ${cos(s,R).toFixed(2)} ${sin(s,R).toFixed(2)} A ${R} ${R} 0 ${lg} 1 ${cos(e,R).toFixed(2)} ${sin(e,R).toFixed(2)} L ${cos(e,inner).toFixed(2)} ${sin(e,inner).toFixed(2)} A ${inner} ${inner} 0 ${lg} 0 ${cos(s,inner).toFixed(2)} ${sin(s,inner).toFixed(2)} Z`,
      color: colors[i % colors.length],
      label: seg.label,
      value: seg.value,
      pct: Math.round(seg.value / total * 100),
    };
  }).filter(Boolean) as { d: string; color: string; label: string; value: number; pct: number }[];

  if (!arcs.length) return <p className="text-xs" style={{ color: K.muted }}>Pas de données</p>;

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" style={{ width: size, height: size, flexShrink: 0 }}>
        {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} />)}
      </svg>
      <div className="flex-1 space-y-1.5">
        {arcs.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <div style={{ width: 8, height: 8, borderRadius: 2, background: a.color, flexShrink: 0 }} />
            <span className="text-xs flex-1 truncate" style={{ color: K.muted }}>{a.label}</span>
            <span className="text-xs font-semibold" style={{ color: K.text }}>
              {a.value.toLocaleString("fr-FR")}{" "}
              <span style={{ color: K.muted, fontWeight: 400 }}>({a.pct}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Bar List ───────────────────────────────────────────────────────────── */
function BarList({ items, labelKey, valueKey, color = K.tealXL }: {
  items: Record<string, any>[];
  labelKey: string;
  valueKey: string;
  color?: string;
}) {
  const max = Math.max(...items.map(i => Number(i[valueKey])), 1);
  if (!items.length) return <p className="text-xs" style={{ color: K.muted }}>Pas de données pour cette période.</p>;
  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const val = Number(item[valueKey]);
        const pct = Math.round(val / max * 100);
        const label = String(item[labelKey] || "—");
        return (
          <div key={i}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs truncate" style={{ color: K.muted, maxWidth: "65%" }}>
                {trunc(label)}
              </span>
              <span className="text-xs font-semibold" style={{ color: K.text }}>{val.toLocaleString("fr-FR")}</span>
            </div>
            <div className="h-1 rounded-full" style={{ background: "rgba(170,189,216,0.08)" }}>
              <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Section Card ───────────────────────────────────────────────────────── */
function Card({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ background: K.card, border: `1px solid ${K.border}` }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium" style={{ color: K.text }}>{title}</p>
        {badge}
      </div>
      {children}
    </div>
  );
}

/* ── Setup Screen ───────────────────────────────────────────────────────── */
function SetupScreen({ onSave }: { onSave: () => void }) {
  const [pid, setPid] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!pid.trim()) return;
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`${API}/api/v1/admin/analytics/landing-config`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: pid.trim() }),
    });
    setSaving(false);
    onSave();
  }
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-16 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(13,75,88,0.3)", border: "1px solid rgba(42,143,165,0.2)" }}>
            <svg className="w-7 h-7" fill="none" stroke={K.tealXL} strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: K.text }}>Connecter Google Analytics</h2>
          <p className="text-sm" style={{ color: K.muted }}>
            Entre l'ID numérique de ta propriété GA4 (pas le <code style={{ color: K.tealXL }}>G-XXXXXXXX</code>, l'ID chiffres seulement).
          </p>
        </div>
        <div className="space-y-3 mb-6">
          {[
            { n: "1", text: <span>Va sur <span style={{ color: K.tealXL }}>analytics.google.com</span></span> },
            { n: "2", text: "⚙️ Admin → Paramètres de la propriété" },
            { n: "3", text: <span>Copie l'<strong style={{ color: K.text }}>ID de propriété</strong> (ex: <code style={{ color: K.gold }}>123456789</code>)</span> },
            { n: "4", text: <span>Donne accès <strong style={{ color: K.text }}>Lecteur</strong> au service account dans Admin → Gestion des accès</span> },
          ].map(s => (
            <div key={s.n} className="flex gap-3 items-start">
              <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "rgba(42,143,165,0.15)", color: K.tealXL }}>{s.n}</span>
              <p className="text-sm pt-0.5" style={{ color: K.muted }}>{s.text}</p>
            </div>
          ))}
        </div>
        <input value={pid} onChange={e => setPid(e.target.value.replace(/\D/g, ""))}
          placeholder="Ex : 123456789"
          className="w-full rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none"
          style={{ background: K.card, border: "1px solid rgba(170,189,216,0.15)", color: K.text }} />
        <button onClick={save} disabled={!pid.trim() || saving}
          className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={{ background: `linear-gradient(135deg, ${K.teal}, ${K.tealL})`, color: "#fff" }}>
          {saving ? "Enregistrement…" : "Connecter →"}
        </button>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────── */
export default function AdminAnalyticsPage() {
  const [data,       setData]       = useState<GAData | null>(null);
  const [rt,         setRt]         = useState<RTData | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [days,       setDays]       = useState(30);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [editPid,    setEditPid]    = useState(false);
  const [draftPid,   setDraftPid]   = useState("");
  const [savingPid,  setSavingPid]  = useState(false);
  const rtTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token ?? ""}` };
  }, []);

  // Check config on mount
  useEffect(() => {
    (async () => {
      const h = await getHeaders();
      const res = await fetch(`${API}/api/v1/admin/analytics/landing-config`, { headers: h });
      if (res.ok) setConfigured(!!(await res.json()).property_id);
    })();
  }, [getHeaders]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const h = await getHeaders();
      const res = await fetch(`${API}/api/v1/admin/analytics/landing?days=${days}`, { headers: h });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.detail || `HTTP ${res.status}`); }
      setData(await res.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [days, getHeaders]);

  const fetchRt = useCallback(async () => {
    try {
      const h = await getHeaders();
      const res = await fetch(`${API}/api/v1/admin/analytics/realtime`, { headers: h });
      if (res.ok) setRt(await res.json());
    } catch {}
  }, [getHeaders]);

  // Fetch historical data when period changes
  useEffect(() => { if (configured) fetchData(); }, [configured, fetchData]);

  // Realtime polling every 30s
  useEffect(() => {
    if (!configured) return;
    fetchRt();
    rtTimer.current = setInterval(fetchRt, 30_000);
    return () => { if (rtTimer.current) clearInterval(rtTimer.current); };
  }, [configured, fetchRt]);

  async function savePid() {
    setSavingPid(true);
    const h = await getHeaders();
    await fetch(`${API}/api/v1/admin/analytics/landing-config`, {
      method: "PATCH",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: draftPid }),
    });
    setSavingPid(false); setEditPid(false); setConfigured(true);
  }

  if (configured === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 rounded-full animate-spin"
          style={{ border: "2px solid rgba(170,189,216,0.15)", borderTopColor: K.tealL }} />
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="min-h-screen flex flex-col" style={{ color: K.text }}>
        <div className="px-8 pt-8 pb-4">
          <h1 className="text-xl font-semibold">Analytics — klientys.co</h1>
        </div>
        <SetupScreen onSave={() => setConfigured(true)} />
      </div>
    );
  }

  const kpis = data?.kpis;
  const totalSrc = (data?.traffic_sources ?? []).reduce((s, r) => s + r.sessions, 0) || 1;
  const maxPage  = Math.max(...(data?.top_pages ?? []).map(p => p.sessions), 1);

  return (
    <div className="p-6" style={{ color: K.text }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold">Analytics — klientys.co</h1>
            {rt !== null && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  background: rt.active_users > 0 ? "rgba(74,202,122,0.12)" : "rgba(170,189,216,0.08)",
                  color: rt.active_users > 0 ? K.green : K.muted,
                  border: `1px solid ${rt.active_users > 0 ? "rgba(74,202,122,0.2)" : "rgba(170,189,216,0.1)"}`,
                }}>
                {rt.active_users > 0 && (
                  <span className="rt-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: K.green, display: "inline-block" }} />
                )}
                {rt.active_users > 0 ? `${rt.active_users} actif${rt.active_users > 1 ? "s" : ""}` : "0 actif"}
              </span>
            )}
          </div>
          <p className="text-sm mt-0.5" style={{ color: K.muted }}>Données Google Analytics 4 · Temps réel ↻ 30s</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(["7", "30", "90"] as const).map(d => (
            <button key={d} onClick={() => setDays(Number(d))}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={days === Number(d)
                ? { background: "rgba(13,75,88,0.5)", color: K.tealXL, border: `1px solid ${K.tealL}` }
                : { background: K.card, color: K.muted, border: `1px solid ${K.border}` }}>
              {d}j
            </button>
          ))}
          <button onClick={fetchData} disabled={loading} className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-40"
            style={{ background: K.card, color: K.muted, border: `1px solid ${K.border}` }}>
            {loading ? "…" : "↻"}
          </button>
          <button onClick={() => { setDraftPid(""); setEditPid(true); }} className="px-3 py-1.5 rounded-lg text-xs"
            style={{ background: K.card, color: K.muted, border: `1px solid ${K.border}` }}>
            ⚙
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(224,96,96,0.08)", border: "1px solid rgba(224,96,96,0.2)", color: K.red }}>
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {Array(7).fill(0).map((_, i) => (
              <div key={i} className="rounded-xl animate-pulse" style={{ background: K.card, height: 80 }} />
            ))}
          </div>
          <div className="rounded-xl animate-pulse" style={{ background: K.card, height: 160 }} />
        </div>
      )}

      {data && kpis && (
        <div className="space-y-5">

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: "Sessions",       value: kpis.sessions.toLocaleString("fr-FR"),        color: K.tealXL },
              { label: "Utilisateurs",   value: kpis.users.toLocaleString("fr-FR"),           color: K.text },
              { label: "Nvx visiteurs",  value: kpis.new_users.toLocaleString("fr-FR"),       color: K.blue },
              { label: "Pages vues",     value: kpis.pageviews.toLocaleString("fr-FR"),       color: K.text },
              { label: "Taux rebond",    value: `${kpis.bounce_rate} %`,                      color: kpis.bounce_rate > 60 ? K.red : kpis.bounce_rate > 40 ? K.gold : K.green },
              { label: "Durée moy.",     value: fmtDuration(kpis.avg_session_duration),       color: K.text },
              { label: "Sess. engagées", value: kpis.engaged_sessions.toLocaleString("fr-FR"), color: K.green },
            ].map(c => (
              <div key={c.label} className="rounded-xl p-4" style={{ background: K.card, border: `1px solid ${K.border}` }}>
                <p className="text-[10px] mb-2 uppercase tracking-wide" style={{ color: K.muted }}>{c.label}</p>
                <p className="text-lg font-bold leading-none" style={{ color: c.color }}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* ── Sessions / jour ── */}
          <Card title={`Sessions / jour — ${days} derniers jours`}>
            <LineChart data={data.sessions_by_day} />
          </Card>

          {/* ── Sources + Appareils / Nv vs Ret ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Sources de trafic">
              <div className="space-y-3">
                {data.traffic_sources.map(s => {
                  const pct = Math.round(s.sessions / totalSrc * 100);
                  return (
                    <div key={s.source}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs" style={{ color: K.muted }}>{s.source || "Autre"}</span>
                        <span className="text-xs font-semibold" style={{ color: K.text }}>
                          {s.sessions.toLocaleString("fr-FR")} <span style={{ color: K.muted, fontWeight: 400 }}>({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "rgba(170,189,216,0.08)" }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: SOURCE_COLORS[s.source] ?? K.muted }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="space-y-4">
              <Card title="Appareils">
                <DonutChart
                  segments={[
                    { label: "Mobile",   value: data.devices.mobile  },
                    { label: "Desktop",  value: data.devices.desktop },
                    { label: "Tablette", value: data.devices.tablet  },
                  ]}
                  colors={[K.tealXL, K.gold, K.purple]}
                />
              </Card>
              <Card title="Nouveaux vs récurrents">
                <DonutChart
                  segments={[
                    { label: "Nouveaux",   value: data.new_vs_returning.new       },
                    { label: "Récurrents", value: data.new_vs_returning.returning },
                  ]}
                  colors={[K.tealXL, K.gold]}
                />
              </Card>
            </div>
          </div>

          {/* ── Pays + Villes ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Pays">
              <BarList items={data.countries} labelKey="country" valueKey="sessions" color={K.tealXL} />
            </Card>
            <Card title="Villes">
              <BarList items={data.cities} labelKey="city" valueKey="sessions" color={K.blue} />
            </Card>
          </div>

          {/* ── Événements + Campagnes UTM ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Événements">
              <div className="space-y-1">
                {data.events.slice(0, 12).map(e => (
                  <div key={e.event} className="flex items-center justify-between py-1.5"
                    style={{ borderBottom: "1px solid rgba(170,189,216,0.06)" }}>
                    <span className="text-xs truncate" style={{ color: K.muted, maxWidth: "72%" }}>{e.event}</span>
                    <span className="text-xs font-semibold" style={{ color: K.text }}>{e.count.toLocaleString("fr-FR")}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Campagnes UTM">
              {data.campaigns.length === 0
                ? <p className="text-xs" style={{ color: K.muted }}>Aucune campagne UTM détectée pour cette période.</p>
                : (
                  <div className="space-y-1">
                    {data.campaigns.map((c, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5"
                        style={{ borderBottom: "1px solid rgba(170,189,216,0.06)" }}>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-medium" style={{ color: K.text }}>{c.source}</span>
                          {c.medium && c.medium !== "(none)" && (
                            <span className="text-xs ml-1" style={{ color: K.muted }}>/ {c.medium}</span>
                          )}
                        </div>
                        <span className="text-xs font-semibold ml-3 shrink-0" style={{ color: K.tealXL }}>
                          {c.sessions.toLocaleString("fr-FR")}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              }
            </Card>
          </div>

          {/* ── Top pages + Pages d'entrée ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Top pages (par sessions)">
              <div className="space-y-2">
                {data.top_pages.map(p => {
                  const pct = Math.round(p.sessions / maxPage * 100);
                  return (
                    <div key={p.page}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs truncate" style={{ color: K.muted, maxWidth: "60%" }}>{trunc(p.page)}</span>
                        <span className="text-xs" style={{ color: K.muted }}>
                          <span style={{ color: K.text, fontWeight: 600 }}>{p.sessions.toLocaleString("fr-FR")}</span>
                          {p.avg_time > 0 && <span className="ml-1">· {fmtDuration(p.avg_time)}</span>}
                        </span>
                      </div>
                      <div className="h-1 rounded-full" style={{ background: "rgba(170,189,216,0.08)" }}>
                        <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: K.tealXL }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="Pages d'entrée (1er contact)">
              <BarList items={data.entry_pages} labelKey="page" valueKey="sessions" color={K.purple} />
            </Card>
          </div>

          {/* ── Blog ── */}
          <Card title="📝 Blog"
            badge={
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "rgba(42,143,165,0.12)", color: K.tealXL }}>
                {data.blog.total_pageviews.toLocaleString("fr-FR")} vues totales
              </span>
            }>
            {data.blog.pages.length === 0
              ? <p className="text-xs" style={{ color: K.muted }}>Aucune page /blog visitée sur cette période.</p>
              : (
                <div className="space-y-2">
                  {data.blog.pages.map((p, i) => {
                    const max = Math.max(...data.blog.pages.map(x => x.pageviews), 1);
                    const pct = Math.round(p.pageviews / max * 100);
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="min-w-0 flex-1 mr-3">
                            {p.title && p.title !== p.page && (
                              <span className="text-xs font-medium block truncate" style={{ color: K.text }}>{p.title}</span>
                            )}
                            <span className="text-xs truncate block" style={{ color: K.muted }}>{trunc(p.page, 40)}</span>
                          </div>
                          <span className="text-xs shrink-0" style={{ color: K.muted }}>
                            <span style={{ color: K.text, fontWeight: 600 }}>{p.pageviews.toLocaleString("fr-FR")}</span>
                            {p.avg_time > 0 && <span className="ml-1">· {fmtDuration(p.avg_time)}</span>}
                          </span>
                        </div>
                        <div className="h-1 rounded-full" style={{ background: "rgba(170,189,216,0.08)" }}>
                          <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: K.amber }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            }
          </Card>

          {/* ── Annuaire ── */}
          <Card title="📍 Annuaire"
            badge={
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "rgba(42,143,165,0.12)", color: K.tealXL }}>
                {data.annuaire.total_pageviews.toLocaleString("fr-FR")} vues totales
              </span>
            }>
            {data.annuaire.pages.length === 0
              ? <p className="text-xs" style={{ color: K.muted }}>Aucune page /annuaire visitée sur cette période.</p>
              : <BarList items={data.annuaire.pages} labelKey="page" valueKey="pageviews" color={K.green} />
            }
          </Card>

          {/* ── Pages actives en temps réel ── */}
          {rt && rt.active_pages.length > 0 && (
            <Card title="Pages actives en ce moment">
              <div className="space-y-1">
                {rt.active_pages.map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5"
                    style={{ borderBottom: "1px solid rgba(170,189,216,0.06)" }}>
                    <span className="text-xs truncate" style={{ color: K.muted, maxWidth: "80%" }}>{p.page || "/"}</span>
                    <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: K.green }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: K.green, display: "inline-block" }} />
                      {p.users}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

        </div>
      )}

      {/* ── Modal Property ID ── */}
      {editPid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.65)" }}
          onClick={e => { if (e.target === e.currentTarget) setEditPid(false); }}>
          <div className="w-full max-w-md rounded-2xl p-6"
            style={{ background: "#0D1B25", border: "1px solid rgba(170,189,216,0.15)" }}>
            <h2 className="text-sm font-semibold mb-1" style={{ color: K.text }}>ID de propriété GA4</h2>
            <p className="text-xs mb-4" style={{ color: K.muted }}>
              Analytics → Admin → Paramètres de la propriété → ID de propriété (chiffres uniquement)
            </p>
            <input value={draftPid} onChange={e => setDraftPid(e.target.value.replace(/\D/g, ""))}
              placeholder="Ex : 123456789"
              className="w-full rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none"
              style={{ background: K.card2, border: "1px solid rgba(170,189,216,0.2)", color: K.text }}
              autoFocus />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditPid(false)} className="text-sm px-4 py-1.5 rounded-lg" style={{ color: K.muted }}>
                Annuler
              </button>
              <button onClick={savePid} disabled={!draftPid.trim() || savingPid}
                className="text-sm px-4 py-1.5 rounded-lg disabled:opacity-40"
                style={{ background: K.teal, color: "#fff" }}>
                {savingPid ? "…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} } .rt-dot{animation:pulse 2s infinite}`}</style>
    </div>
  );
}
