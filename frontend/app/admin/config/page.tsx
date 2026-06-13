"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const K = {
  teal:   "#0D4B58",  tealL:  "#1A6E82",  tealXL: "#2A8FA5",
  gold:   "#DDAA40",  blue:   "#AABDD8",
  card:   "#0D1B25",  card2:  "#0A1520",
  border: "rgba(170,189,216,0.10)",
  text:   "#EEF2F5",  muted:  "#8BA5B0",
  danger: "#E06060",  success:"#4ACA7A",
};

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

const DEFAULT_SECTORS: Record<string, string[]> = {
  health:      ["infirmière à domicile", "kinésithérapeute", "médecin généraliste"],
  beauty:      ["coiffeur", "esthéticienne", "salon de beauté"],
  coaching:    ["coach de vie", "coaching personnel", "coach sportif"],
  finance:     ["comptable indépendant", "conseiller financier", "expert comptable"],
  trade:       ["plombier", "électricien", "artisan"],
  restaurant:  ["restaurant", "livraison repas", "réservation restaurant"],
  commerce:    ["boutique", "magasin", "commerce de proximité"],
  other:       ["prestataire de service", "indépendant"],
};

export default function ConfigPage() {
  const [config,      setConfig]      = useState<Record<string, any>>({});
  const [flags,       setFlags]       = useState<any[]>([]);
  const [sectors,     setSectors]     = useState<Record<string, string[]>>({});
  const [toast,       setToast]       = useState("");
  const [toastOk,     setToastOk]     = useState(true);
  const [busy,        setBusy]        = useState(false);
  const [loadErr,     setLoadErr]     = useState("");

  const [newKey,  setNewKey]  = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const [editingSector, setEditingSector] = useState<string | null>(null);
  const [sectorKws,     setSectorKws]     = useState<string>("");
  const [newSectorKey,  setNewSectorKey]  = useState("");
  const [newSectorLabel,setNewSectorLabel]= useState("");
  const [newSectorKws,  setNewSectorKws]  = useState("");
  const [showNewSector, setShowNewSector] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast(msg); setToastOk(ok); setTimeout(() => setToast(""), 3000);
  };

  const load = async () => {
    try {
      const [cfg, fl, secList] = await Promise.all([
        adminFetch<Record<string, any>>("/api/v1/admin/system-config"),
        adminFetch<any[]>("/api/v1/admin/feature-flags"),
        adminFetch<any[]>("/api/v1/admin/sectors"),
      ]);
      setConfig(cfg);
      setFlags(fl);
      const secMap: Record<string, string[]> = {};
      secList.forEach((s: any) => { secMap[s.key] = s.keywords; });
      setSectors({ ...DEFAULT_SECTORS, ...secMap });
    } catch (e: any) { setLoadErr(e.message); }
  };

  useEffect(() => { load(); }, []);

  const toggleMaintenance = async () => {
    setBusy(true);
    try {
      await adminFetch("/api/v1/admin/system-config", {
        method: "PATCH",
        body: JSON.stringify({ maintenance_mode: !config.maintenance_mode }),
      });
      showToast("Config mise à jour ✓");
      await load();
    } catch (e: any) { showToast(`Erreur : ${e.message}`, false); }
    finally { setBusy(false); }
  };

  const updateMessage = async (msg: string) => {
    setBusy(true);
    try {
      await adminFetch("/api/v1/admin/system-config", {
        method: "PATCH",
        body: JSON.stringify({ maintenance_message: msg }),
      });
      showToast("Message mis à jour ✓");
      await load();
    } catch (e: any) { showToast(`Erreur : ${e.message}`, false); }
    finally { setBusy(false); }
  };

  const toggleFlag = async (key: string, current: boolean) => {
    setBusy(true);
    try {
      await adminFetch(`/api/v1/admin/feature-flags/${key}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !current }),
      });
      showToast("Feature flag mis à jour ✓");
      await load();
    } catch (e: any) { showToast(`Erreur : ${e.message}`, false); }
    finally { setBusy(false); }
  };

  const createFlag = async () => {
    if (!newKey.trim() || !newName.trim()) return;
    setBusy(true);
    try {
      await adminFetch("/api/v1/admin/feature-flags", {
        method: "POST",
        body: JSON.stringify({ key: newKey.trim(), name: newName.trim(), description: newDesc.trim() || undefined, enabled: false }),
      });
      showToast("Feature flag créé ✓");
      setNewKey(""); setNewName(""); setNewDesc("");
      await load();
    } catch (e: any) { showToast(`Erreur : ${e.message}`, false); }
    finally { setBusy(false); }
  };

  const deleteFlag = async (key: string) => {
    if (!confirm(`Supprimer le flag "${key}" ?`)) return;
    setBusy(true);
    try {
      await adminFetch(`/api/v1/admin/feature-flags/${key}`, { method: "DELETE" });
      showToast("Supprimé ✓");
      await load();
    } catch (e: any) { showToast(`Erreur : ${e.message}`, false); }
    finally { setBusy(false); }
  };

  const createSector = async () => {
    if (!newSectorKey.trim()) return;
    const kws = newSectorKws.split("\n").map(s => s.trim()).filter(Boolean);
    setBusy(true);
    try {
      await adminFetch<any>("/api/v1/admin/sectors", {
        method: "POST",
        body: JSON.stringify({ key: newSectorKey.trim().toLowerCase(), label: newSectorLabel.trim() || undefined, keywords: kws }),
      });
      showToast(`Secteur "${newSectorKey}" créé ✓`);
      setNewSectorKey(""); setNewSectorLabel(""); setNewSectorKws(""); setShowNewSector(false);
      await load();
    } catch (e: any) { showToast(`Erreur : ${e.message}`, false); }
    finally { setBusy(false); }
  };

  const saveSector = async (key: string) => {
    const kws = sectorKws.split("\n").map(s => s.trim()).filter(Boolean);
    setBusy(true);
    try {
      await adminFetch<any>(`/api/v1/admin/sectors/${key}`, {
        method: "PATCH",
        body: JSON.stringify({ keywords: kws }),
      });
      showToast(`Secteur "${key}" mis à jour ✓`);
      setEditingSector(null);
      await load();
    } catch (e: any) { showToast(`Erreur : ${e.message}`, false); }
    finally { setBusy(false); }
  };

  if (loadErr) return <div className="p-8" style={{ color: K.danger }}>{loadErr}</div>;

  const isMaintenance = Boolean(config.maintenance_mode);
  const maintMessage  = typeof config.maintenance_message === "string" ? config.maintenance_message : "";

  return (
    <div className="p-8 max-w-3xl">
      {toast && (
        <div className="fixed top-4 right-4 z-50 text-sm px-4 py-2 rounded-lg shadow-lg"
          style={{ background: toastOk ? K.teal : "#7A1A1A", color: "#fff", border: `1px solid ${toastOk ? K.tealL : K.danger}` }}>
          {toast}
        </div>
      )}

      <h1 className="text-xl font-semibold mb-1" style={{ color: K.text }}>Configuration</h1>
      <p className="text-sm mb-8" style={{ color: K.muted }}>Maintenance · Feature flags · Mots-clés secteurs</p>

      {/* ── Maintenance ── */}
      <section className="mb-8">
        <h2 className="text-sm font-medium mb-3" style={{ color: K.muted }}>Mode maintenance</h2>
        <div className="rounded-xl p-5"
          style={{ background: K.card, border: `1px solid ${isMaintenance ? "rgba(224,96,96,0.2)" : K.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium" style={{ color: isMaintenance ? K.danger : K.text }}>
                {isMaintenance ? "Maintenance active" : "Maintenance désactivée"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: K.muted }}>
                {isMaintenance ? "Les tenants voient la bannière de maintenance." : "Le SaaS fonctionne normalement."}
              </p>
            </div>
            <button onClick={toggleMaintenance} disabled={busy}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50"
              style={{ background: isMaintenance ? K.danger : "rgba(170,189,216,0.12)" }}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isMaintenance ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          <div>
            <label className="text-xs block mb-1" style={{ color: K.muted }}>Message affiché aux tenants</label>
            <input
              defaultValue={maintMessage}
              onBlur={(e) => { if (e.target.value !== maintMessage) updateMessage(e.target.value); }}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.15)`, color: K.text }}
            />
          </div>
        </div>
      </section>

      {/* ── Feature flags ── */}
      <section className="mb-8">
        <h2 className="text-sm font-medium mb-3" style={{ color: K.muted }}>Feature flags globaux</h2>

        <div className="rounded-xl p-4 mb-4" style={{ background: K.card, border: `1px solid ${K.border}` }}>
          <h3 className="text-xs font-medium mb-3" style={{ color: K.muted }}>Nouveau flag</h3>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-xs block mb-1" style={{ color: "rgba(170,189,216,0.4)" }}>Clé (unique)</label>
              <input value={newKey} onChange={(e) => setNewKey(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                placeholder="ex: new_dashboard_v2"
                className="w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.15)`, color: K.text }} />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "rgba(170,189,216,0.4)" }}>Nom</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="ex: Nouveau dashboard v2"
                className="w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.15)`, color: K.text }} />
            </div>
          </div>
          <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optionnel)"
            className="w-full rounded-lg px-3 py-1.5 text-xs mb-3 focus:outline-none"
            style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.15)`, color: K.text }} />
          <button onClick={createFlag} disabled={busy || !newKey || !newName}
            className="px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
            style={{ background: K.teal, color: "#fff" }}>
            Créer le flag
          </button>
        </div>

        {flags.length === 0 ? (
          <p className="text-sm" style={{ color: "rgba(170,189,216,0.25)" }}>Aucun feature flag créé</p>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: K.card, border: `1px solid ${K.border}` }}>
            {flags.map((f, i) => (
              <div key={f.id} className="flex items-center gap-4 px-5 py-3.5"
                style={{ borderBottom: i < flags.length - 1 ? "1px solid rgba(170,189,216,0.05)" : "none" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: K.text }}>{f.name}</p>
                  <p className="text-xs font-mono" style={{ color: "rgba(170,189,216,0.35)" }}>{f.key}</p>
                  {f.description && <p className="text-xs mt-0.5" style={{ color: "rgba(170,189,216,0.25)" }}>{f.description}</p>}
                </div>
                <button onClick={() => toggleFlag(f.key, f.enabled)} disabled={busy}
                  className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50"
                  style={{ background: f.enabled ? K.teal : "rgba(170,189,216,0.12)" }}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${f.enabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
                <span className="text-xs w-8 shrink-0" style={{ color: f.enabled ? K.tealXL : "rgba(170,189,216,0.25)" }}>
                  {f.enabled ? "On" : "Off"}
                </span>
                <button onClick={() => deleteFlag(f.key)}
                  className="text-xs shrink-0 transition-colors"
                  style={{ color: "rgba(224,96,96,0.35)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = K.danger)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(224,96,96,0.35)")}>
                  Suppr.
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Secteurs ── */}
      <section>
        <h2 className="text-sm font-medium mb-1" style={{ color: K.muted }}>Mots-clés secteurs (Google Trends)</h2>
        <p className="text-xs mb-4" style={{ color: "rgba(170,189,216,0.3)" }}>
          Ces mots-clés sont utilisés par le moteur de potentiel de demande locale.
        </p>

        <div className="flex justify-end mb-3">
          <button onClick={() => setShowNewSector(v => !v)}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: showNewSector ? "rgba(13,75,88,0.4)" : "rgba(13,75,88,0.2)", color: K.tealXL, border: `1px solid rgba(42,143,165,0.3)` }}>
            {showNewSector ? "Annuler" : "+ Nouveau secteur"}
          </button>
        </div>

        {showNewSector && (
          <div className="rounded-xl p-4 mb-3 space-y-3" style={{ background: K.card, border: `1px solid rgba(42,143,165,0.3)` }}>
            <p className="text-xs font-medium" style={{ color: K.tealXL }}>Créer un nouveau secteur</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: K.muted }}>Clé (ex: immobilier)</label>
                <input
                  value={newSectorKey}
                  onChange={(e) => setNewSectorKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="ma_cle"
                  className="w-full rounded-lg px-3 py-2 text-xs font-mono focus:outline-none"
                  style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.15)`, color: K.text }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: K.muted }}>Label affiché (ex: Immobilier)</label>
                <input
                  value={newSectorLabel}
                  onChange={(e) => setNewSectorLabel(e.target.value)}
                  placeholder="Mon secteur"
                  className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none"
                  style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.15)`, color: K.text }}
                />
              </div>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: K.muted }}>Mots-clés Google Trends (un par ligne)</label>
              <textarea
                value={newSectorKws}
                onChange={(e) => setNewSectorKws(e.target.value)}
                rows={3}
                placeholder={"agent immobilier\nachat appartement\nvente maison"}
                className="w-full rounded-lg px-3 py-2 text-xs font-mono focus:outline-none resize-none"
                style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.15)`, color: K.text }}
              />
            </div>
            <button onClick={createSector} disabled={busy || !newSectorKey.trim()}
              className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
              style={{ background: "rgba(13,75,88,0.5)", color: K.success, border: `1px solid rgba(74,202,122,0.3)` }}>
              Créer le secteur
            </button>
          </div>
        )}

        <div className="space-y-2">
          {Object.entries(sectors).map(([key, kws]) => (
            <div key={key} className="rounded-xl p-4" style={{ background: K.card, border: `1px solid ${K.border}` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium font-mono" style={{ color: K.tealXL }}>{key}</span>
                {editingSector === key ? (
                  <div className="flex gap-3">
                    <button onClick={() => saveSector(key)} disabled={busy}
                      className="text-xs disabled:opacity-50 transition-colors"
                      style={{ color: K.success }}>
                      Sauvegarder
                    </button>
                    <button onClick={() => setEditingSector(null)}
                      className="text-xs"
                      style={{ color: K.muted }}>
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setEditingSector(key); setSectorKws((kws as string[]).join("\n")); }}
                    className="text-xs transition-colors"
                    style={{ color: K.tealXL }}>
                    Modifier
                  </button>
                )}
              </div>

              {editingSector === key ? (
                <textarea
                  value={sectorKws}
                  onChange={(e) => setSectorKws(e.target.value)}
                  rows={4}
                  placeholder="Un mot-clé par ligne"
                  className="w-full rounded-lg px-3 py-2 text-xs font-mono focus:outline-none resize-none"
                  style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.15)`, color: K.text }}
                />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(kws as string[]).map((kw, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(13,75,88,0.2)", color: K.muted, border: `1px solid rgba(170,189,216,0.12)` }}>
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
