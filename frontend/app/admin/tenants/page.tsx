"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const K = {
  teal:   "#0D4B58",
  tealL:  "#1A6E82",
  tealXL: "#2A8FA5",
  gold:   "#DDAA40",
  blue:   "#AABDD8",
  card:   "#0D1B25",
  card2:  "#0A1520",
  border: "rgba(170,189,216,0.10)",
  text:   "#EEF2F5",
  muted:  "#8BA5B0",
};

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}`, ...(options.headers ?? {}) },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`); }
  return res.json();
}

const STATUS_TABS = [
  { key: "",              label: "Tous" },
  { key: "trial",         label: "Essai" },
  { key: "active",        label: "Actifs" },
  { key: "trial_expired", label: "Expirés" },
  { key: "suspended",     label: "Suspendus" },
];

const STATUS_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  active:        { bg: "rgba(13,75,88,0.2)",    color: "#2A8FA5",             border: "rgba(42,143,165,0.3)" },
  trialing:      { bg: "rgba(170,189,216,0.1)",  color: "#AABDD8",             border: "rgba(170,189,216,0.25)" },
  trial:         { bg: "rgba(221,170,64,0.1)",   color: "#DDAA40",             border: "rgba(221,170,64,0.25)" },
  trial_expired: { bg: "rgba(224,96,96,0.1)",    color: "#E06060",             border: "rgba(224,96,96,0.25)" },
  suspended:     { bg: "rgba(170,189,216,0.05)", color: "rgba(170,189,216,0.3)", border: "rgba(170,189,216,0.1)" },
};
const STATUS_LABEL: Record<string, string> = {
  active: "Actif", trialing: "Stripe trial", trial: "Essai", trial_expired: "Expiré", suspended: "Suspendu",
};
const SECTORS: Record<string, string> = {
  health: "Santé", coaching: "Coaching", trade: "Artisan / Bâtiment",
  beauty: "Beauté", finance: "Finance", restaurant: "Restaurant",
  commerce: "Commerce", other: "Autre",
};

function exportCSV(items: any[]) {
  const cols = ["name", "slug", "sector", "country", "computed_status", "owner_email", "created_at"];
  const header = cols.join(";");
  const rows = items.map(t => cols.map(c => `"${(t[c] ?? "").toString().replace(/"/g, '""')}"`).join(";"));
  const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `tenants_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}

const BLANK_FORM = { email: "", name: "", slug: "", sector: "other", country: "BE", send_invite: true, password: "" };

export default function TenantsPage() {
  const params     = useSearchParams();
  const [search,   setSearch]   = useState(params.get("search") ?? "");
  const [status,   setStatus]   = useState(params.get("status") ?? "");
  const [page,     setPage]     = useState(1);
  const [data,     setData]     = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [allItems, setAllItems] = useState<any[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [form,       setForm]       = useState(BLANK_FORM);
  const [creating,   setCreating]   = useState(false);
  const [createErr,  setCreateErr]  = useState("");
  const [createOk,   setCreateOk]   = useState(false);

  const load = useCallback(async (s: string, st: string, p: number) => {
    setLoading(true); setError("");
    try {
      const qs = new URLSearchParams({ page: String(p), page_size: "25" });
      if (s)  qs.set("search", s);
      if (st) qs.set("status", st);
      const res = await adminFetch<any>(`/api/v1/admin/tenants?${qs}`);
      setData(res);
      setAllItems(res.items ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(search, status, page); }, [search, status, page, load]);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleStatus = (v: string) => { setStatus(v); setPage(1); };
  const slugify = (v: string) => v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setCreateErr(""); setCreating(true);
    try {
      await adminFetch("/api/v1/admin/tenants", { method: "POST", body: JSON.stringify({ ...form, password: form.password || undefined }) });
      setCreateOk(true); setForm(BLANK_FORM);
      setTimeout(() => { setShowCreate(false); setCreateOk(false); load(search, status, page); }, 1500);
    } catch (e: any) { setCreateErr(e.message); }
    finally { setCreating(false); }
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="p-8">
      {/* Modal création */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(4,14,21,0.75)" }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: K.card, border: `1px solid ${K.border}` }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: K.text }}>Créer un tenant manuellement</h2>
            {createOk ? (
              <p className="text-sm text-center py-4" style={{ color: K.tealXL }}>Tenant créé ✓</p>
            ) : (
              <form onSubmit={handleCreate} className="space-y-3">
                <CField label="Email propriétaire *" value={form.email} onChange={v => setForm(f => ({...f, email: v}))} type="email" />
                <CField label="Nom du cabinet *" value={form.name}
                  onChange={v => setForm(f => ({...f, name: v, slug: slugify(v)}))} />
                <CField label="Slug *" value={form.slug} onChange={v => setForm(f => ({...f, slug: slugify(v)}))} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs block mb-1" style={{ color: K.muted }}>Secteur</label>
                    <select value={form.sector} onChange={e => setForm(f => ({...f, sector: e.target.value}))}
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.15)`, color: K.text }}>
                      {Object.entries(SECTORS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <CField label="Pays" value={form.country} onChange={v => setForm(f => ({...f, country: v.toUpperCase().slice(0,2)}))} />
                </div>
                <CField label="Mot de passe (laisse vide = invitation email)" value={form.password}
                  onChange={v => setForm(f => ({...f, password: v}))} type="password" />
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: K.muted }}>
                  <input type="checkbox" checked={form.send_invite} onChange={e => setForm(f => ({...f, send_invite: e.target.checked}))}
                    className="rounded" />
                  Envoyer un email d'invitation
                </label>
                {createErr && <p className="text-xs" style={{ color: "#E06060" }}>{createErr}</p>}
                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={creating || !form.email || !form.name || !form.slug}
                    className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    style={{ background: K.teal, color: "#fff" }}>
                    {creating ? "Création…" : "Créer"}
                  </button>
                  <button type="button" onClick={() => { setShowCreate(false); setCreateErr(""); }}
                    className="flex-1 py-2 rounded-lg text-sm transition-colors"
                    style={{ background: "rgba(170,189,216,0.07)", color: K.muted }}>
                    Annuler
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: K.text }}>Tenants</h1>
          <p className="text-sm" style={{ color: K.muted }}>{total} au total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCSV(allItems)} disabled={allItems.length === 0}
            className="px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-30"
            style={{ background: "rgba(170,189,216,0.07)", color: K.muted, border: `1px solid ${K.border}` }}>
            Export CSV
          </button>
          <button onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: K.teal, color: "#fff" }}>
            + Créer tenant
          </button>
        </div>
      </div>

      {/* Recherche */}
      <div className="flex gap-3 mb-4">
        <input type="text" placeholder="Nom, slug ou email…" value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full max-w-sm rounded-lg px-4 py-2 text-sm focus:outline-none"
          style={{ background: K.card, border: `1px solid rgba(170,189,216,0.15)`, color: K.text }}
        />
      </div>

      {/* Onglets statut */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg w-fit" style={{ background: "rgba(170,189,216,0.04)" }}>
        {STATUS_TABS.map((t) => (
          <button key={t.key} onClick={() => handleStatus(t.key)}
            className="px-3 py-1.5 text-xs rounded-md transition-colors"
            style={status === t.key
              ? { background: "rgba(13,75,88,0.35)", color: "#7DD8E8" }
              : { color: K.muted }
            }>
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm mb-4" style={{ color: "#E06060" }}>{error}</p>}

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: K.card, border: `1px solid ${K.border}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs" style={{ borderBottom: `1px solid ${K.border}`, color: K.muted }}>
              <th className="text-left px-4 py-3 font-medium">Tenant</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Secteur</th>
              <th className="text-left px-4 py-3 font-medium">Statut</th>
              <th className="text-left px-4 py-3 font-medium">Créé</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center">
                <div className="w-5 h-5 rounded-full animate-spin mx-auto"
                  style={{ border: `2px solid ${K.border}`, borderTopColor: K.tealL }} />
              </td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-sm" style={{ color: "rgba(170,189,216,0.25)" }}>
                Aucun tenant trouvé
              </td></tr>
            ) : items.map((t: any) => {
              const badge = STATUS_BADGE[t.computed_status] ?? STATUS_BADGE.suspended;
              return (
                <tr key={t.id} style={{ borderBottom: `1px solid rgba(170,189,216,0.04)` }}
                  className="transition-colors hover:bg-[rgba(13,75,88,0.07)]">
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: K.text }}>{t.name}</p>
                    <p className="text-xs font-mono" style={{ color: "rgba(170,189,216,0.35)" }}>{t.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: K.muted }}>{t.owner_email ?? "—"}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: K.muted }}>{SECTORS[t.sector] ?? t.sector ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                      {STATUS_LABEL[t.computed_status] ?? t.computed_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "rgba(170,189,216,0.35)" }}>
                    {new Date(t.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/tenants/${t.id}`}
                      className="text-xs transition-colors"
                      style={{ color: K.tealXL }}>
                      Voir →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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

function CField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs block mb-1" style={{ color: "#8BA5B0" }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
        style={{ background: "#0A1520", border: "1px solid rgba(170,189,216,0.15)", color: "#EEF2F5" }} />
    </div>
  );
}
