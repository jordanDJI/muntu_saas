"use client";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

const STATUS_OPTIONS = [
  { value: "pending",     label: "En attente",  color: "#DDAA40" },
  { value: "in_progress", label: "En cours",    color: "#1A6E82" },
  { value: "done",        label: "Terminée",    color: "#22c55e" },
];

function statusStyle(status: string) {
  const s = STATUS_OPTIONS.find((o) => o.value === status);
  return s ? { color: s.color, background: `${s.color}22`, border: `1px solid ${s.color}55` } : {};
}

function statusLabel(status: string) {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export default function DesignRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<string>("");
  const [editing, setEditing]   = useState<string | null>(null);
  const [notes, setNotes]       = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState<string | null>(null);

  useEffect(() => {
    api.adminGetDesignRequests(filter || undefined)
      .then(setRequests)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    setSaving(id);
    try {
      const updated = await api.adminUpdateDesignRequest(id, { status });
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } finally { setSaving(null); }
  };

  const saveNotes = async (id: string) => {
    setSaving(id);
    try {
      const updated = await api.adminUpdateDesignRequest(id, { admin_notes: notes[id] ?? "" });
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setEditing(null);
    } finally { setSaving(null); }
  };

  const pending     = requests.filter((r) => r.status === "pending").length;
  const in_progress = requests.filter((r) => r.status === "in_progress").length;

  return (
    <div style={{ padding: "32px", maxWidth: "960px" }}>

      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#EEF2F5", marginBottom: "4px" }}>
          Demandes de refonte design
        </h1>
        <p style={{ fontSize: "13px", color: "rgba(170,189,216,0.55)" }}>
          Soumises par les tenants Business — 1 site inclus dans leur plan
        </p>
        <div style={{ display: "flex", gap: "16px", marginTop: "16px" }}>
          {[
            { label: "En attente", count: pending,     color: "#DDAA40" },
            { label: "En cours",   count: in_progress, color: "#1A6E82" },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ background: "#0D1B25", border: "1px solid rgba(170,189,216,0.1)", borderRadius: "10px", padding: "10px 18px" }}>
              <p style={{ fontSize: "22px", fontWeight: 700, color, margin: 0 }}>{count}</p>
              <p style={{ fontSize: "12px", color: "rgba(170,189,216,0.55)", margin: 0 }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {[{ value: "", label: "Toutes" }, ...STATUS_OPTIONS].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => { setFilter(value); setLoading(true); }}
            style={{
              fontSize: "12px", fontWeight: 600, padding: "5px 14px", borderRadius: "100px", cursor: "pointer",
              background: filter === value ? "#1A6E82" : "rgba(170,189,216,0.08)",
              color: filter === value ? "#fff" : "rgba(170,189,216,0.7)",
              border: "1px solid " + (filter === value ? "#1A6E82" : "rgba(170,189,216,0.12)"),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "rgba(170,189,216,0.4)", fontSize: "13px" }}>Chargement…</p>
      ) : requests.length === 0 ? (
        <div style={{ background: "#0D1B25", border: "1px solid rgba(170,189,216,0.08)", borderRadius: "12px", padding: "40px", textAlign: "center" }}>
          <p style={{ color: "rgba(170,189,216,0.4)", fontSize: "14px", margin: 0 }}>Aucune demande pour l&apos;instant.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {requests.map((r) => (
            <div key={r.id} style={{ background: "#0D1B25", border: "1px solid rgba(170,189,216,0.1)", borderRadius: "12px", padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>

                {/* Infos tenant */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#EEF2F5" }}>{r.tenant_name || "—"}</span>
                    {r.site_name && (
                      <span style={{ fontSize: "12px", color: "rgba(170,189,216,0.5)" }}>· {r.site_name}</span>
                    )}
                    {r.is_additional && (
                      <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "100px", background: "rgba(221,170,64,0.15)", color: "#DDAA40", border: "1px solid rgba(221,170,64,0.3)" }}>
                        Site supplémentaire
                      </span>
                    )}
                    <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "100px", ...statusStyle(r.status) }}>
                      {statusLabel(r.status)}
                    </span>
                  </div>

                  <p style={{ fontSize: "13px", color: "rgba(170,189,216,0.8)", lineHeight: 1.6, margin: "0 0 8px", whiteSpace: "pre-wrap" }}>
                    {r.message}
                  </p>

                  <p style={{ fontSize: "11px", color: "rgba(170,189,216,0.35)", margin: 0 }}>
                    {new Date(r.created_at).toLocaleString("fr-FR")} · #{r.id.slice(0, 8)}
                  </p>

                  {/* Notes admin */}
                  {editing === r.id ? (
                    <div style={{ marginTop: "12px" }}>
                      <textarea
                        rows={2}
                        value={notes[r.id] ?? r.admin_notes ?? ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="Note interne (visible par le tenant)…"
                        style={{ width: "100%", background: "rgba(170,189,216,0.06)", border: "1px solid rgba(170,189,216,0.15)", borderRadius: "8px", padding: "8px 12px", color: "#EEF2F5", fontSize: "13px", resize: "vertical" }}
                      />
                      <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                        <button
                          onClick={() => saveNotes(r.id)}
                          disabled={saving === r.id}
                          style={{ fontSize: "12px", fontWeight: 600, padding: "5px 14px", borderRadius: "8px", background: "#1A6E82", color: "#fff", border: "none", cursor: "pointer" }}
                        >
                          {saving === r.id ? "…" : "Sauvegarder"}
                        </button>
                        <button onClick={() => setEditing(null)} style={{ fontSize: "12px", padding: "5px 14px", borderRadius: "8px", background: "rgba(170,189,216,0.08)", color: "rgba(170,189,216,0.7)", border: "1px solid rgba(170,189,216,0.12)", cursor: "pointer" }}>
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: "8px" }}>
                      {r.admin_notes && (
                        <p style={{ fontSize: "12px", color: "#1A6E82", margin: "0 0 4px" }}>💬 {r.admin_notes}</p>
                      )}
                      <button
                        onClick={() => { setEditing(r.id); setNotes((prev) => ({ ...prev, [r.id]: r.admin_notes ?? "" })); }}
                        style={{ fontSize: "11px", color: "rgba(170,189,216,0.45)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >
                        {r.admin_notes ? "Modifier la note" : "+ Ajouter une note"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Actions statut */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "140px" }}>
                  {STATUS_OPTIONS.filter((o) => o.value !== r.status).map((o) => (
                    <button
                      key={o.value}
                      onClick={() => updateStatus(r.id, o.value)}
                      disabled={saving === r.id}
                      style={{
                        fontSize: "12px", fontWeight: 500, padding: "6px 12px", borderRadius: "8px", cursor: "pointer",
                        background: "rgba(170,189,216,0.06)", border: "1px solid rgba(170,189,216,0.12)",
                        color: o.color, textAlign: "left",
                      }}
                    >
                      → {o.label}
                    </button>
                  ))}
                </div>

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
