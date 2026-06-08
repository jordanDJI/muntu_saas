"use client";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "En attente de paiement",
  paid:            "Payée",
  in_progress:     "En cours",
  review:          "À valider",
  done:            "Livrée",
  cancelled:       "Annulée",
};

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "bg-gray-700 text-gray-300",
  paid:            "bg-blue-900 text-blue-300",
  in_progress:     "bg-amber-900 text-amber-300",
  review:          "bg-purple-900 text-purple-300",
  done:            "bg-green-900 text-green-300",
  cancelled:       "bg-red-900 text-red-300",
};

const TIER_LABELS: Record<string, { label: string; price: string }> = {
  essentiel: { label: "Essentiel", price: "149 €" },
  standard:  { label: "Standard",  price: "299 €" },
  premium:   { label: "Premium",   price: "499 €" },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending_payment: [],
  paid:            ["in_progress"],
  in_progress:     ["review"],
  review:          ["done", "in_progress"],
  done:            [],
  cancelled:       [],
};

export default function LogoRequestsAdminPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes]       = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState<string | null>(null);

  const load = async (status?: string) => {
    setLoading(true);
    try {
      const data = await api.adminGetLogoRequests(status === "all" ? undefined : status);
      setRequests(data);
      const notesMap: Record<string, string> = {};
      data.forEach((r: any) => { notesMap[r.id] = r.admin_notes ?? ""; });
      setNotes(notesMap);
    } catch { /* non critique */ }
    setLoading(false);
  };

  useEffect(() => { load(filter); }, [filter]);

  const update = async (id: string, body: { status?: string; admin_notes?: string }) => {
    setSaving(id);
    try {
      await api.adminUpdateLogoRequest(id, body);
      await load(filter);
    } catch { /* non critique */ }
    setSaving(null);
  };

  const counts = {
    all:             requests.length,
    pending_payment: requests.filter(r => r.status === "pending_payment").length,
    paid:            requests.filter(r => r.status === "paid").length,
    in_progress:     requests.filter(r => r.status === "in_progress").length,
    review:          requests.filter(r => r.status === "review").length,
    done:            requests.filter(r => r.status === "done").length,
  };

  const filtered = filter === "all" ? requests : requests.filter(r => r.status === filter);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: "#EEF2F5" }}>Demandes de logo</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(170,189,216,0.55)" }}>
          Briefs collectés par l'IA — paiement avant traitement
        </p>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        {(["all", "pending_payment", "paid", "in_progress", "review", "done"] as const).map((s) => {
          const active = filter === s;
          const label = s === "all" ? "Toutes" : STATUS_LABELS[s];
          const count = counts[s as keyof typeof counts] ?? 0;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={active
                ? { background: "#1A6E82", color: "#EEF2F5" }
                : { background: "rgba(170,189,216,0.08)", color: "rgba(170,189,216,0.55)" }}
            >
              {label} {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 rounded-full animate-spin" style={{ border: "2px solid rgba(170,189,216,0.2)", borderTopColor: "#1A6E82" }} />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "rgba(170,189,216,0.35)" }}>Aucune demande</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const tier = TIER_LABELS[r.price_tier] ?? { label: r.price_tier, price: `${r.price_eur} €` };
            const isExpanded = expanded === r.id;
            const transitions = STATUS_TRANSITIONS[r.status] ?? [];
            const brief: Record<string, any> = r.brief ?? {};

            return (
              <div key={r.id} className="rounded-xl overflow-hidden" style={{ background: "#0D1B25", border: "1px solid rgba(170,189,216,0.1)" }}>
                {/* Header */}
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                  onClick={() => setExpanded(isExpanded ? null : r.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                      style={{ background: "rgba(221,170,64,0.12)", color: "#DDAA40" }}>🎨</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "#EEF2F5" }}>{r.tenant_name || "—"}</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(170,189,216,0.45)" }}>
                        {tier.label} · {tier.price} · {new Date(r.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] ?? "bg-gray-700 text-gray-300"}`}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                    <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} style={{ color: "rgba(170,189,216,0.35)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Détail */}
                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4 border-t" style={{ borderColor: "rgba(170,189,216,0.08)" }}>
                    {/* Brief */}
                    {Object.keys(brief).length > 0 && (
                      <div className="pt-4">
                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(170,189,216,0.4)" }}>Brief IA</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {Object.entries(brief).filter(([k]) => k !== "recommended_tier").map(([k, v]) => (
                            <div key={k} className="rounded-lg px-3 py-2" style={{ background: "rgba(170,189,216,0.05)" }}>
                              <p className="text-[10px] capitalize mb-0.5" style={{ color: "rgba(170,189,216,0.4)" }}>{k.replace(/_/g, " ")}</p>
                              <p className="text-xs" style={{ color: "#EEF2F5" }}>
                                {Array.isArray(v) ? v.join(", ") : String(v || "—")}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions statut */}
                    {transitions.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(170,189,216,0.4)" }}>Changer le statut</p>
                        <div className="flex gap-2 flex-wrap">
                          {transitions.map((s) => (
                            <button
                              key={s}
                              onClick={() => update(r.id, { status: s })}
                              disabled={saving === r.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                              style={{ background: "#1A6E82", color: "#EEF2F5" }}
                            >
                              {saving === r.id ? "…" : `→ ${STATUS_LABELS[s]}`}
                            </button>
                          ))}
                          {r.status !== "cancelled" && (
                            <button
                              onClick={() => update(r.id, { status: "cancelled" })}
                              disabled={saving === r.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                              style={{ background: "rgba(224,96,96,0.15)", color: "#E06060" }}
                            >
                              Annuler
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes admin */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(170,189,216,0.4)" }}>Notes internes</p>
                      <textarea
                        value={notes[r.id] ?? ""}
                        onChange={(e) => setNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                        rows={3}
                        placeholder="Notes visibles uniquement par l'équipe admin…"
                        className="w-full text-sm rounded-lg px-3 py-2 resize-none"
                        style={{ background: "rgba(170,189,216,0.06)", border: "1px solid rgba(170,189,216,0.15)", color: "#EEF2F5" }}
                      />
                      <button
                        onClick={() => update(r.id, { admin_notes: notes[r.id] })}
                        disabled={saving === r.id}
                        className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                        style={{ background: "rgba(170,189,216,0.1)", color: "rgba(170,189,216,0.7)" }}
                      >
                        {saving === r.id ? "Sauvegarde…" : "Enregistrer les notes"}
                      </button>
                    </div>

                    {/* Stripe ID */}
                    {r.stripe_payment_intent_id && (
                      <p className="text-xs" style={{ color: "rgba(170,189,216,0.35)" }}>
                        Stripe payment intent : {r.stripe_payment_intent_id}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
