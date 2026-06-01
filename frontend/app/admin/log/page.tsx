"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const K = {
  teal:   "#0D4B58",  tealL:  "#1A6E82",  tealXL: "#2A8FA5",
  gold:   "#DDAA40",  blue:   "#AABDD8",
  card:   "#0D1B25",  card2:  "#0A1520",
  border: "rgba(170,189,216,0.10)",
  text:   "#EEF2F5",  muted:  "#8BA5B0",
};

async function adminFetch<T>(path: string): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`); }
  return res.json();
}

const ACTION_TYPES = [
  "extend_trial", "force_activate", "suspend", "unsuspend",
  "confirm_email", "reset_password", "clear_cache", "delete_tenant",
  "patch_tenant", "create_tenant", "impersonate", "change_owner_email",
  "sync_stripe", "reset_domain", "set_override", "remove_override",
];

export default function LogPage() {
  const [items,       setItems]       = useState<any[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [filterType,  setFilterType]  = useState("");
  const [filterAdmin, setFilterAdmin] = useState("");

  const load = useCallback(async (p: number, type: string, admin: string) => {
    setLoading(true); setError("");
    try {
      const qs = new URLSearchParams({ page: String(p), page_size: "50" });
      if (type)  qs.set("action_type", type);
      if (admin) qs.set("admin_email", admin);
      const res = await adminFetch<any>(`/api/v1/admin/action-log?${qs}`);
      setItems(res.items ?? res);
      setTotal(res.total ?? (res.items ?? res).length);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page, filterType, filterAdmin); }, [page, filterType, filterAdmin, load]);

  const handleType  = (v: string) => { setFilterType(v);  setPage(1); };
  const handleAdmin = (v: string) => { setFilterAdmin(v); setPage(1); };

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: K.text }}>Log des actions admin</h1>
          <p className="text-sm" style={{ color: K.muted }}>{total} entrées</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select value={filterType} onChange={(e) => handleType(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={{ background: K.card, border: `1px solid rgba(170,189,216,0.15)`, color: K.text }}>
          <option value="">Toutes les actions</option>
          {ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          type="text"
          placeholder="Filtrer par email admin…"
          value={filterAdmin}
          onChange={(e) => handleAdmin(e.target.value)}
          className="rounded-lg px-4 py-2 text-sm focus:outline-none w-64"
          style={{ background: K.card, border: `1px solid rgba(170,189,216,0.15)`, color: K.text }}
        />
      </div>

      {error && <p className="text-sm mb-4" style={{ color: "#E06060" }}>{error}</p>}

      <div className="rounded-xl overflow-hidden" style={{ background: K.card, border: `1px solid ${K.border}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs" style={{ borderBottom: `1px solid ${K.border}`, color: K.muted }}>
              <th className="text-left px-4 py-3 font-medium">Action</th>
              <th className="text-left px-4 py-3 font-medium">Tenant</th>
              <th className="text-left px-4 py-3 font-medium">Payload</th>
              <th className="text-left px-4 py-3 font-medium">Admin</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-12 text-center">
                <div className="w-5 h-5 rounded-full animate-spin mx-auto"
                  style={{ border: `2px solid ${K.border}`, borderTopColor: K.tealL }} />
              </td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-sm" style={{ color: "rgba(170,189,216,0.25)" }}>
                Aucune entrée
              </td></tr>
            ) : items.map((l: any) => (
              <tr key={l.id} className="transition-colors"
                style={{ borderBottom: "1px solid rgba(170,189,216,0.04)" }}>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs" style={{ color: K.tealXL }}>{l.action_type}</span>
                </td>
                <td className="px-4 py-3">
                  {l.target_tenant_id ? (
                    <Link href={`/admin/tenants/${l.target_tenant_id}`}
                      className="text-xs transition-colors"
                      style={{ color: "rgba(170,189,216,0.6)" }}>
                      {l.target_tenant_name ?? l.target_tenant_id.slice(0, 8) + "…"}
                    </Link>
                  ) : (
                    <span className="text-xs" style={{ color: "rgba(170,189,216,0.2)" }}>—</span>
                  )}
                </td>
                <td className="px-4 py-3 max-w-xs">
                  {l.payload && Object.keys(l.payload).length > 0 ? (
                    <span className="text-xs font-mono truncate block" style={{ color: "rgba(170,189,216,0.3)" }}>
                      {JSON.stringify(l.payload)}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: "rgba(170,189,216,0.15)" }}>—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: K.muted }}>{l.admin_email ?? "—"}</td>
                <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "rgba(170,189,216,0.35)" }}>
                  {new Date(l.created_at).toLocaleString("fr-FR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span style={{ color: "rgba(170,189,216,0.35)" }}>Page {page} / {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-30"
              style={{ background: "rgba(170,189,216,0.07)", color: K.muted, border: `1px solid ${K.border}` }}>
              ← Précédent
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-30"
              style={{ background: "rgba(170,189,216,0.07)", color: K.muted, border: `1px solid ${K.border}` }}>
              Suivant →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
