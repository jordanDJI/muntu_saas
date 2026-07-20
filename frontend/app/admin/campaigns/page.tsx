"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Campaign = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  name: string;
  subject: string;
  segment: string;
  status: "sent" | "partial" | "failed";
  sent_count: number;
  failed_count: number;
  open_count: number;
  click_count: number;
  unsubscribed_count: number;
  open_rate: number;
  click_rate: number;
  sent_at: string;
};

type Stats = {
  total: number;
  total_sent: number;
  avg_open_rate: number;
  avg_click_rate: number;
  total_unsubscribed: number;
};

const SEGMENT_LABELS: Record<string, string> = {
  all:      "Tous les contacts",
  inactive: "Inactifs",
  tag:      "Par tag",
};

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  sent:    { bg: "rgba(42,143,165,0.15)",  color: "#2A8FA5", label: "Envoyé" },
  partial: { bg: "rgba(221,170,64,0.15)",  color: "#DDAA40", label: "Partiel" },
  failed:  { bg: "rgba(224,96,96,0.15)",   color: "#E06060", label: "Échoué" },
};

function fmtDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminCampaigns() {
  const [campaigns,     setCampaigns]     = useState<Campaign[]>([]);
  const [stats,         setStats]         = useState<Stats | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [tenantSearch,  setTenantSearch]  = useState("");
  const [statusFilter,  setStatusFilter]  = useState("");
  const [days,          setDays]          = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const headers = { Authorization: `Bearer ${session?.access_token ?? ""}` };
    const qs = new URLSearchParams({ days: String(days) });
    if (statusFilter) qs.set("status", statusFilter);
    try {
      const res = await fetch(`${API}/api/v1/admin/campaigns?${qs}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns ?? []);
        setStats(data.stats ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [days, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = tenantSearch
    ? campaigns.filter((c) =>
        c.tenant_name.toLowerCase().includes(tenantSearch.toLowerCase()) ||
        c.tenant_slug.toLowerCase().includes(tenantSearch.toLowerCase())
      )
    : campaigns;

  const card = (label: string, value: string | number, color: string) => (
    <div key={label} style={{ background: "#0D1B25", border: "1px solid rgba(170,189,216,0.08)", borderRadius: 12, padding: "16px 20px" }}>
      <p style={{ fontSize: 11, color: "rgba(170,189,216,0.45)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 700, color }}>{value}</p>
    </div>
  );

  return (
    <div className="p-6" style={{ color: "#EEF2F5" }}>

      {/* Header */}
      <div className="mb-6">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#EEF2F5" }}>Campagnes email</h1>
        <p style={{ fontSize: 13, color: "rgba(170,189,216,0.5)", marginTop: 4 }}>
          Toutes les campagnes envoyées par les tenants, avec métriques de tracking
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {card("Campagnes",     stats.total,                                           "#2A8FA5")}
          {card("Emails envoyés", stats.total_sent.toLocaleString("fr-FR"),              "#EEF2F5")}
          {card("Tx ouverture",  `${stats.avg_open_rate} %`,                            stats.avg_open_rate >= 20 ? "#4ADE80" : "#DDAA40")}
          {card("Tx de clic",    `${stats.avg_click_rate} %`,                           "#EEF2F5")}
          {card("Désabonnements", stats.total_unsubscribed,                             stats.total_unsubscribed > 0 ? "#E06060" : "rgba(170,189,216,0.45)")}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          placeholder="Rechercher un tenant…"
          value={tenantSearch}
          onChange={(e) => setTenantSearch(e.target.value)}
          style={{
            background: "#0D1B25", border: "1px solid rgba(170,189,216,0.12)",
            borderRadius: 8, padding: "8px 12px", color: "#EEF2F5", fontSize: 13, width: 220,
            outline: "none",
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            background: "#0D1B25", border: "1px solid rgba(170,189,216,0.12)",
            borderRadius: 8, padding: "8px 12px", color: "#EEF2F5", fontSize: 13,
          }}
        >
          <option value="">Tous les statuts</option>
          <option value="sent">Envoyé</option>
          <option value="partial">Partiel</option>
          <option value="failed">Échoué</option>
        </select>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          style={{
            background: "#0D1B25", border: "1px solid rgba(170,189,216,0.12)",
            borderRadius: 8, padding: "8px 12px", color: "#EEF2F5", fontSize: 13,
          }}
        >
          <option value={7}>7 jours</option>
          <option value={30}>30 jours</option>
          <option value={90}>90 jours</option>
          <option value={365}>1 an</option>
        </select>
        <button
          onClick={load}
          style={{
            background: "rgba(13,75,88,0.5)", border: "1px solid rgba(42,143,165,0.3)",
            borderRadius: 8, padding: "8px 16px", color: "#7DD8E8", fontSize: 13, cursor: "pointer",
          }}
        >
          ↻ Actualiser
        </button>
      </div>

      {/* Table */}
      <div style={{ background: "#0D1B25", border: "1px solid rgba(170,189,216,0.08)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(170,189,216,0.08)" }}>
                {["Tenant", "Campagne", "Segment", "Envoyés", "Ouvertures", "Clics", "Désabos", "Date", "Statut"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 14px", textAlign: h === "Tenant" || h === "Campagne" || h === "Segment" || h === "Statut" ? "left" : "right",
                      fontSize: 11, color: "rgba(170,189,216,0.45)",
                      textTransform: "uppercase", letterSpacing: "0.08em",
                      fontWeight: 600, whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: 48, textAlign: "center", color: "rgba(170,189,216,0.35)", fontSize: 13 }}>
                    Chargement…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 48, textAlign: "center", color: "rgba(170,189,216,0.35)", fontSize: 13 }}>
                    Aucune campagne sur cette période
                  </td>
                </tr>
              ) : filtered.map((c, i) => {
                const st = STATUS_STYLES[c.status] ?? STATUS_STYLES.sent;
                return (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: "1px solid rgba(170,189,216,0.05)",
                      background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)",
                    }}
                  >
                    {/* Tenant */}
                    <td style={{ padding: "10px 14px" }}>
                      <Link
                        href={`/admin/tenants/${c.tenant_id}`}
                        style={{ fontSize: 13, fontWeight: 600, color: "#7DD8E8", textDecoration: "none" }}
                      >
                        {c.tenant_name || c.tenant_slug || c.tenant_id.slice(0, 8)}
                      </Link>
                      {c.tenant_slug && c.tenant_name && (
                        <p style={{ fontSize: 11, color: "rgba(170,189,216,0.35)", marginTop: 1 }}>/{c.tenant_slug}</p>
                      )}
                    </td>

                    {/* Campagne */}
                    <td style={{ padding: "10px 14px", maxWidth: 220 }}>
                      <p style={{ fontSize: 13, color: "#EEF2F5", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.name}
                      </p>
                      <p style={{ fontSize: 11, color: "rgba(170,189,216,0.4)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.subject}
                      </p>
                    </td>

                    {/* Segment */}
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        fontSize: 11, padding: "3px 8px", borderRadius: 100,
                        background: "rgba(42,143,165,0.1)", color: "#2A8FA5",
                        border: "1px solid rgba(42,143,165,0.2)", whiteSpace: "nowrap",
                      }}>
                        {SEGMENT_LABELS[c.segment] ?? c.segment}
                      </span>
                    </td>

                    {/* Envoyés */}
                    <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 13, color: "#EEF2F5" }}>{c.sent_count}</span>
                      {c.failed_count > 0 && (
                        <span style={{ fontSize: 11, color: "#E06060", marginLeft: 4 }}>−{c.failed_count}</span>
                      )}
                    </td>

                    {/* Ouvertures */}
                    <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 13, color: c.open_rate >= 20 ? "#4ADE80" : "#EEF2F5" }}>
                        {c.open_count}
                      </span>
                      <span style={{ fontSize: 11, color: "rgba(170,189,216,0.4)", marginLeft: 5 }}>
                        {c.open_rate}%
                      </span>
                    </td>

                    {/* Clics */}
                    <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 13, color: "#EEF2F5" }}>{c.click_count}</span>
                      <span style={{ fontSize: 11, color: "rgba(170,189,216,0.4)", marginLeft: 5 }}>
                        {c.click_rate}%
                      </span>
                    </td>

                    {/* Désabonnements */}
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <span style={{
                        fontSize: 13,
                        color: c.unsubscribed_count > 0 ? "#E06060" : "rgba(170,189,216,0.3)",
                      }}>
                        {c.unsubscribed_count}
                      </span>
                    </td>

                    {/* Date */}
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "rgba(170,189,216,0.4)", whiteSpace: "nowrap" }}>
                      {fmtDate(c.sent_at)}
                    </td>

                    {/* Statut */}
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        fontSize: 11, padding: "3px 8px", borderRadius: 100,
                        background: st.bg, color: st.color,
                        border: `1px solid ${st.color}40`,
                      }}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(170,189,216,0.06)", fontSize: 12, color: "rgba(170,189,216,0.35)" }}>
            {filtered.length} campagne{filtered.length > 1 ? "s" : ""}
            {tenantSearch && ` · filtrées sur "${tenantSearch}"`}
          </div>
        )}
      </div>
    </div>
  );
}
