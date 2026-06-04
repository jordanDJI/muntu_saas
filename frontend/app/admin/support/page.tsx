"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const K = {
  card: "#0D1B25", card2: "#0A1520", border: "rgba(170,189,216,0.10)",
  teal: "#0D4B58", tealL: "#1A6E82", tealXL: "#2A8FA5",
  gold: "#DDAA40", text: "#EEF2F5", muted: "#8BA5B0",
  danger: "#E06060", success: "#4ACA7A", blue: "#AABDD8",
};

const ROLE_META: Record<string, { label: string; color: string; bg: string; border: string; perms: string[] }> = {
  viewer: {
    label:  "Observateur",
    color:  K.blue,
    bg:     "rgba(170,189,216,0.08)",
    border: "rgba(170,189,216,0.2)",
    perms: [
      "Consulter la liste et le détail des tenants",
      "Lire les logs d'actions admin",
      "Consulter les métriques globales",
      "Lire les feature overrides par tenant",
    ],
  },
  support: {
    label:  "Support opérationnel",
    color:  K.tealXL,
    bg:     "rgba(13,75,88,0.18)",
    border: "rgba(42,143,165,0.3)",
    perms: [
      "Tout ce que peut faire Observateur",
      "Confirmer l'email d'un tenant",
      "Envoyer un lien de réinitialisation de mot de passe",
      "Prolonger la période d'essai",
      "Vider le cache ROI (analytics)",
      "Resynchroniser le statut Stripe",
      "Réinitialiser un domaine personnalisé",
    ],
  },
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

type Account = { id: string; email: string; role: string; created_at: string; last_sign_in_at: string | null };

export default function SupportAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState("");
  const [toastOk,  setToastOk]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole,  setNewRole]  = useState<"viewer"|"support">("support");
  const [busy,     setBusy]     = useState(false);
  const [roleChange, setRoleChange] = useState<Record<string, string>>({});

  const showToast = (msg: string, ok = true) => {
    setToast(msg); setToastOk(ok); setTimeout(() => setToast(""), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminFetch<Account[]>("/api/v1/admin/support-accounts");
      setAccounts(data);
    } catch (e: any) { showToast(e.message, false); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newEmail.trim()) return;
    setBusy(true);
    try {
      await adminFetch("/api/v1/admin/support-accounts", {
        method: "POST",
        body: JSON.stringify({ email: newEmail.trim(), role: newRole }),
      });
      showToast("Compte créé — email d'invitation envoyé ✓");
      setModal(false); setNewEmail(""); setNewRole("support");
      await load();
    } catch (e: any) { showToast(e.message, false); }
    finally { setBusy(false); }
  };

  const changeRole = async (id: string, role: string) => {
    setBusy(true);
    try {
      await adminFetch(`/api/v1/admin/support-accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      showToast("Rôle mis à jour ✓");
      await load();
    } catch (e: any) { showToast(e.message, false); }
    finally { setBusy(false); }
  };

  const revoke = async (id: string, email: string) => {
    if (!confirm(`Révoquer l'accès de ${email} ?`)) return;
    setBusy(true);
    try {
      await adminFetch(`/api/v1/admin/support-accounts/${id}`, { method: "DELETE" });
      showToast("Accès révoqué ✓");
      await load();
    } catch (e: any) { showToast(e.message, false); }
    finally { setBusy(false); }
  };

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div className="p-8 max-w-4xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 text-sm px-4 py-2 rounded-lg shadow-lg"
          style={{ background: toastOk ? K.teal : "#7A1A1A", color: "#fff", border: `1px solid ${toastOk ? K.tealL : "#E06060"}` }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold mb-1" style={{ color: K.text }}>Comptes support</h1>
          <p className="text-sm" style={{ color: K.muted }}>
            Gérez les accès au panel admin selon le niveau de permission requis.
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: "rgba(13,75,88,0.4)", color: K.tealXL, border: `1px solid rgba(42,143,165,0.35)` }}>
          + Nouveau compte
        </button>
      </div>

      {/* Référentiel des niveaux */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {Object.entries(ROLE_META).map(([key, meta]) => (
          <div key={key} className="rounded-xl p-4" style={{ background: K.card, border: `1px solid ${K.border}` }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                {meta.label}
              </span>
            </div>
            <ul className="space-y-1">
              {meta.perms.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-xs" style={{ color: K.muted }}>
                  <span style={{ color: i === 0 && key === "support" ? K.tealXL : K.success, flexShrink: 0 }}>✓</span>
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${K.border}` }}>
              <p className="text-xs font-medium mb-1" style={{ color: "rgba(224,96,96,0.7)" }}>Ne peut PAS :</p>
              {key === "viewer" && (
                <ul className="space-y-0.5">
                  {["Effectuer la moindre action", "Impersonate", "Suspendre / supprimer"].map((p, i) => (
                    <li key={i} className="text-xs flex items-start gap-2" style={{ color: "rgba(224,96,96,0.55)" }}>
                      <span style={{ flexShrink: 0 }}>✗</span>{p}
                    </li>
                  ))}
                </ul>
              )}
              {key === "support" && (
                <ul className="space-y-0.5">
                  {["Impersonate (connexion en tant que tenant)", "Suspendre / réactiver un compte", "Supprimer un tenant", "Gérer les feature flags ou la config", "Créer / gérer d'autres comptes support"].map((p, i) => (
                    <li key={i} className="text-xs flex items-start gap-2" style={{ color: "rgba(224,96,96,0.55)" }}>
                      <span style={{ flexShrink: 0 }}>✗</span>{p}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Liste des comptes */}
      <div className="rounded-xl overflow-hidden" style={{ background: K.card, border: `1px solid ${K.border}` }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${K.border}` }}>
          <h2 className="text-sm font-semibold" style={{ color: K.text }}>
            Comptes actifs ({accounts.length})
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 rounded-full animate-spin" style={{ border: `2px solid rgba(170,189,216,0.2)`, borderTopColor: K.tealL }} />
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-center py-12 text-sm" style={{ color: "rgba(170,189,216,0.3)" }}>
            Aucun compte support créé
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${K.border}` }}>
                {["Email", "Rôle", "Créé le", "Dernière connexion", ""].map((h) => (
                  <th key={h} className="px-5 py-2.5 text-left text-xs font-medium" style={{ color: K.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const meta = ROLE_META[a.role] ?? ROLE_META.viewer;
                const pendingRole = roleChange[a.id] ?? a.role;
                return (
                  <tr key={a.id} style={{ borderBottom: `1px solid ${K.border}` }}>
                    <td className="px-5 py-3" style={{ color: K.text }}>{a.email}</td>
                    <td className="px-5 py-3">
                      <select
                        value={pendingRole}
                        onChange={(e) => setRoleChange((p) => ({ ...p, [a.id]: e.target.value }))}
                        className="rounded px-2 py-1 text-xs focus:outline-none"
                        style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                        <option value="viewer">Observateur</option>
                        <option value="support">Support opérationnel</option>
                      </select>
                      {pendingRole !== a.role && (
                        <button
                          onClick={() => changeRole(a.id, pendingRole)}
                          disabled={busy}
                          className="ml-2 text-xs px-2 py-0.5 rounded"
                          style={{ background: "rgba(42,143,165,0.2)", color: K.tealXL, border: `1px solid rgba(42,143,165,0.3)` }}>
                          Appliquer
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: K.muted }}>{fmt(a.created_at)}</td>
                    <td className="px-5 py-3 text-xs" style={{ color: K.muted }}>{fmt(a.last_sign_in_at)}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => revoke(a.id, a.email)}
                        disabled={busy}
                        className="text-xs px-2 py-1 rounded"
                        style={{ background: "rgba(224,96,96,0.08)", color: K.danger, border: "1px solid rgba(224,96,96,0.2)" }}>
                        Révoquer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal création */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: K.card, border: "1px solid rgba(170,189,216,0.15)" }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: K.text }}>Créer un compte support</h2>

            <label className="block text-xs mb-1" style={{ color: K.muted }}>Email</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="support@agence.com"
              className="w-full rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none"
              style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.2)`, color: K.text }}
            />

            <label className="block text-xs mb-2" style={{ color: K.muted }}>Niveau d'accès</label>
            <div className="space-y-2 mb-6">
              {(["support", "viewer"] as const).map((r) => {
                const m = ROLE_META[r];
                return (
                  <button
                    key={r}
                    onClick={() => setNewRole(r)}
                    className="w-full text-left rounded-lg px-3 py-2.5 transition-all"
                    style={{
                      background: newRole === r ? m.bg : "transparent",
                      border: `1px solid ${newRole === r ? m.border : "rgba(170,189,216,0.12)"}`,
                    }}>
                    <p className="text-xs font-semibold mb-0.5" style={{ color: newRole === r ? m.color : K.muted }}>{m.label}</p>
                    <p className="text-xs" style={{ color: "rgba(170,189,216,0.45)" }}>{m.perms[0]}</p>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={create}
                disabled={busy || !newEmail.trim()}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-40"
                style={{ background: "rgba(13,75,88,0.5)", color: K.tealXL, border: "1px solid rgba(42,143,165,0.4)" }}>
                {busy ? "Création…" : "Créer et envoyer l'invitation"}
              </button>
              <button
                onClick={() => { setModal(false); setNewEmail(""); setNewRole("support"); }}
                className="px-4 py-2 rounded-xl text-sm"
                style={{ background: "rgba(170,189,216,0.07)", color: K.muted }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
