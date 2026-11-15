"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../../lib/api";

// Panel admin — Acquisition (migration 086) : entreprises nouvellement
// immatriculées (SIRENE), leads de l'outil « demande locale », parrainages.

const C = {
  card: "#0D1B25",
  border: "rgba(170,189,216,0.10)",
  text: "#EEF2F5",
  muted: "rgba(170,189,216,0.55)",
  faint: "rgba(170,189,216,0.35)",
  teal: "#1A6E82",
  gold: "#DDAA40",
  green: "#22c55e",
  red: "#f87171",
};

const SECTORS: Record<string, string> = {
  health: "Santé", beauty: "Beauté", coaching: "Coaching / sport", finance: "Finance",
  trade: "Artisans", restaurant: "Restauration", commerce: "Commerce", other: "Autre",
};

const STATUSES = [
  { value: "new",       label: "À contacter", color: C.gold },
  { value: "contacted", label: "Contactée",   color: C.teal },
  { value: "converted", label: "Cliente",     color: C.green },
  { value: "ignored",   label: "Écartée",     color: "rgba(170,189,216,0.5)" },
];

const HEADCOUNT: Record<string, string> = {
  NN: "Sans salarié", "00": "0 salarié", "01": "1-2 sal.", "02": "3-5 sal.", "03": "6-9 sal.",
  "11": "10-19 sal.", "12": "20-49 sal.", "21": "50-99 sal.",
};

const REWARD_LABELS: Record<string, string> = {
  pending: "En attente du 1er paiement", credited: "1 mois crédité", trial_extended: "Essai prolongé", failed: "Échec — à traiter",
};

function pill(color: string, active = true): React.CSSProperties {
  return {
    fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "100px", cursor: "pointer",
    color: active ? color : C.muted,
    background: active ? `${color}22` : "rgba(170,189,216,0.06)",
    border: `1px solid ${active ? `${color}55` : "rgba(170,189,216,0.12)"}`,
  };
}

const inputStyle: React.CSSProperties = {
  background: "rgba(170,189,216,0.06)", border: "1px solid rgba(170,189,216,0.15)", borderRadius: "8px",
  padding: "7px 12px", color: C.text, fontSize: "13px",
};

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

type Tab = "prospects" | "leads" | "referrals";

export default function AcquisitionPage() {
  const [tab, setTab] = useState<Tab>("prospects");
  const [summary, setSummary] = useState<any>(null);

  const loadSummary = useCallback(() => {
    api.adminAcquisitionSummary().then(setSummary).catch(() => {});
  }, []);
  useEffect(loadSummary, [loadSummary]);

  const cards = summary ? [
    { label: "Entreprises à contacter", value: summary.prospects.new, sub: `+${summary.prospects.imported_7d} cette semaine`, color: C.gold },
    { label: "Entreprises clientes", value: summary.prospects.converted, sub: `${summary.prospects.contacted} contactées`, color: C.green },
    { label: "Leads outil gratuit", value: summary.leads.total, sub: `+${summary.leads.last_7d} cette semaine · ${summary.leads.converted} inscrits`, color: C.teal },
    { label: "Filleuls inscrits", value: summary.referrals.signed_up, sub: `${summary.referrals.converted} abonnés`, color: "#2A8FA5" },
  ] : [];

  return (
    <div style={{ padding: "32px", maxWidth: "1100px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: C.text, marginBottom: "4px" }}>Acquisition</h1>
        <p style={{ fontSize: "13px", color: C.muted, margin: 0 }}>
          Nouvelles entreprises à prospecter, leads de l&apos;outil{" "}
          <Link href="/outils/demande-locale" target="_blank" style={{ color: "#2A8FA5" }}>demande locale</Link>, parrainages.
        </p>
      </div>

      {summary && !summary.insee_configured && (
        <div style={{ background: "rgba(221,170,64,0.08)", border: "1px solid rgba(221,170,64,0.3)", borderRadius: "12px", padding: "16px 20px", marginBottom: "20px" }}>
          <p style={{ color: C.gold, fontWeight: 600, fontSize: "14px", margin: "0 0 8px" }}>Import SIRENE inactif : clé INSEE manquante</p>
          <ol style={{ color: C.text, fontSize: "13px", margin: 0, paddingLeft: "18px", lineHeight: 1.7 }}>
            <li>Créer un compte sur <a href="https://portail-api.insee.fr" target="_blank" rel="noopener noreferrer" style={{ color: "#2A8FA5" }}>portail-api.insee.fr</a>.</li>
            <li>Créer une application, puis la souscrire à l&apos;API « Sirene » (plan public, gratuit).</li>
            <li>Copier la clé d&apos;API dans la variable <code>INSEE_API_KEY</code> du backend (Railway), puis redéployer.</li>
          </ol>
        </div>
      )}
      {summary && summary.referrals.rewarded_failed > 0 && (
        <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "12px", padding: "12px 20px", marginBottom: "20px", color: C.red, fontSize: "13px" }}>
          {summary.referrals.rewarded_failed} récompense(s) de parrainage en échec : voir l&apos;onglet Parrainages.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "14px 18px" }}>
            <p style={{ fontSize: "24px", fontWeight: 700, color: c.color, margin: 0 }}>{c.value}</p>
            <p style={{ fontSize: "12px", color: C.text, margin: "2px 0 0" }}>{c.label}</p>
            <p style={{ fontSize: "11px", color: C.faint, margin: "2px 0 0" }}>{c.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {([["prospects", "Nouvelles entreprises"], ["leads", "Leads outil gratuit"], ["referrals", "Parrainages"]] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            fontSize: "13px", fontWeight: 600, padding: "7px 16px", borderRadius: "100px", cursor: "pointer",
            background: tab === key ? C.teal : "rgba(170,189,216,0.08)",
            color: tab === key ? "#fff" : "rgba(170,189,216,0.7)",
            border: `1px solid ${tab === key ? C.teal : "rgba(170,189,216,0.12)"}`,
          }}>{label}</button>
        ))}
      </div>

      {tab === "prospects" && <ProspectsTab onChange={loadSummary} inseeConfigured={!!summary?.insee_configured} />}
      {tab === "leads" && <LeadsTab />}
      {tab === "referrals" && <ReferralsTab />}
    </div>
  );
}

// ── Nouvelles entreprises ─────────────────────────────────────────────────────

function ProspectsTab({ onChange, inseeConfigured }: { onChange: () => void; inseeConfigured: boolean }) {
  const [status, setStatus] = useState("new");
  const [sector, setSector] = useState("");
  const [department, setDepartment] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: any[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const PAGE_SIZE = 50;

  const load = useCallback(() => {
    setLoading(true);
    api.adminProspects({ status, sector, department, q, page, page_size: PAGE_SIZE })
      .then((d) => { setData(d); setError(""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [status, sector, department, q, page]);

  useEffect(() => {
    const id = setTimeout(load, 250); // la recherche texte ne déclenche pas une requête par frappe
    return () => clearTimeout(id);
  }, [load]);

  const update = async (id: string, body: { status?: string; notes?: string }) => {
    try {
      const row = await api.adminUpdateProspect(id, body);
      setData((d) => ({
        ...d,
        // Une fiche qui change de statut quitte la liste filtrée.
        items: body.status && status && body.status !== status
          ? d.items.filter((r) => r.id !== id)
          : d.items.map((r) => (r.id === id ? row : r)),
      }));
      if (body.status) onChange();
    } catch (e: any) { setError(e.message); }
  };

  const runImport = async () => {
    try {
      await api.adminImportProspects(8);
      setNotice("Import lancé : les entreprises créées ces 8 derniers jours arrivent d'ici une à deux minutes. Actualisez ensuite.");
    } catch (e: any) { setError(e.message); }
  };

  const exportCsv = () => {
    const qs = new URLSearchParams(Object.entries({ status, sector, department, q }).filter(([, v]) => v));
    api.adminDownloadCsv(`/api/v1/admin/acquisition/prospects/export?${qs.toString()}`, "prospects.csv")
      .catch((e) => setError(e.message));
  };

  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "12px" }}>
        {[{ value: "", label: "Tous" }, ...STATUSES].map((s) => (
          <button key={s.value} onClick={() => { setStatus(s.value); setPage(1); }} style={pill("color" in s ? s.color : C.teal, status === s.value)}>
            {s.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "16px" }}>
        <select value={sector} onChange={(e) => { setSector(e.target.value); setPage(1); }} style={inputStyle}>
          <option value="">Tous les secteurs</option>
          {Object.entries(SECTORS).filter(([k]) => k !== "other").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input value={department} onChange={(e) => { setDepartment(e.target.value.replace(/[^0-9AB]/gi, "").slice(0, 3)); setPage(1); }}
          placeholder="Département (ex. 13)" style={{ ...inputStyle, width: "160px" }} />
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Nom, ville ou code postal" style={{ ...inputStyle, flex: "1 1 200px" }} />
        <button onClick={exportCsv} style={{ ...pill(C.teal), padding: "7px 14px", fontSize: "12px" }}>Exporter CSV</button>
        {inseeConfigured && (
          <button onClick={runImport} style={{ ...pill(C.gold), padding: "7px 14px", fontSize: "12px" }}>Importer maintenant</button>
        )}
      </div>

      {notice && <p style={{ color: C.gold, fontSize: "13px", margin: "0 0 12px" }}>{notice}</p>}
      {error && <p style={{ color: C.red, fontSize: "13px", margin: "0 0 12px" }}>{error}</p>}

      <p style={{ fontSize: "12px", color: C.faint, margin: "0 0 10px" }}>
        {data.total} entreprise(s). Source : base SIRENE de l&apos;INSEE (établissements diffusibles uniquement).
        Au premier contact, indiquez d&apos;où viennent les coordonnées et comment s&apos;opposer à la prospection.
      </p>

      {loading ? (
        <p style={{ color: C.faint, fontSize: "13px" }}>Chargement…</p>
      ) : data.items.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "36px", textAlign: "center" }}>
          <p style={{ color: C.faint, fontSize: "14px", margin: 0 }}>Aucune entreprise pour ces filtres.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {data.items.map((r) => (
            <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "14px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: C.text }}>{r.name}</p>
                  <p style={{ margin: "3px 0 0", fontSize: "12px", color: C.muted }}>
                    {SECTORS[r.sector] ?? "—"} · NAF {r.naf_code ?? "—"} · créée le {fmtDate(r.created_on)}
                    {r.headcount_band ? ` · ${HEADCOUNT[r.headcount_band] ?? r.headcount_band}` : ""}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: "12px", color: C.faint }}>
                    {[r.street, [r.postal_code, r.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "Adresse non diffusée"}
                    {" · "}
                    <a href={`https://www.google.com/search?q=${encodeURIComponent(`${r.name} ${r.city ?? ""}`)}`} target="_blank" rel="noopener noreferrer" style={{ color: "#2A8FA5" }}>
                      Chercher sur Google
                    </a>
                  </p>
                  {editingNote === r.id ? (
                    <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                      <input autoFocus value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} style={{ ...inputStyle, flex: 1 }}
                        onKeyDown={(e) => { if (e.key === "Enter") { update(r.id, { notes: noteDraft }); setEditingNote(null); } }} />
                      <button onClick={() => { update(r.id, { notes: noteDraft }); setEditingNote(null); }} style={{ ...pill(C.teal), padding: "6px 12px" }}>OK</button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingNote(r.id); setNoteDraft(r.notes ?? ""); }}
                      style={{ marginTop: "6px", fontSize: "12px", color: r.notes ? "#2A8FA5" : C.faint, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                      {r.notes ? `💬 ${r.notes}` : "+ Note"}
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "flex-start" }}>
                  {STATUSES.map((s) => (
                    <button key={s.value} onClick={() => s.value !== r.status && update(r.id, { status: s.value })} style={pill(s.color, r.status === s.value)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "center", marginTop: "16px" }}>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ ...pill(C.teal, page > 1), padding: "6px 14px" }}>←</button>
          <span style={{ fontSize: "12px", color: C.muted }}>Page {page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} style={{ ...pill(C.teal, page < pages), padding: "6px 14px" }}>→</button>
        </div>
      )}
    </div>
  );
}

// ── Leads de l'outil gratuit ──────────────────────────────────────────────────

function LeadsTab() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: any[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api.adminMarketingLeads(page).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [page]);

  const pages = Math.max(1, Math.ceil(data.total / 50));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", gap: "12px", flexWrap: "wrap" }}>
        <p style={{ fontSize: "12px", color: C.faint, margin: 0 }}>
          {data.total} demande(s) de rapport. Ne relancer par email que les personnes ayant coché « recontact » (colonne Consentement).
        </p>
        <button onClick={() => api.adminDownloadCsv("/api/v1/admin/acquisition/leads/export", "leads-demande-locale.csv").catch((e) => setError(e.message))}
          style={{ ...pill(C.teal), padding: "7px 14px", fontSize: "12px" }}>Exporter CSV</button>
      </div>
      {error && <p style={{ color: C.red, fontSize: "13px" }}>{error}</p>}
      {loading ? (
        <p style={{ color: C.faint, fontSize: "13px" }}>Chargement…</p>
      ) : data.items.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "36px", textAlign: "center" }}>
          <p style={{ color: C.faint, fontSize: "14px", margin: 0 }}>Aucun lead pour l&apos;instant.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", color: C.text }}>
            <thead>
              <tr style={{ textAlign: "left", color: C.muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: ".05em" }}>
                {["Date", "Email", "Activité", "Région", "Indice régional", "Consentement", "Inscrit"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((l) => (
                <tr key={l.id}>
                  <td style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, color: C.muted }}>{fmtDate(l.created_at)}</td>
                  <td style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>{l.first_name ? `${l.first_name} · ` : ""}{l.email}</td>
                  <td style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>{l.activity || SECTORS[l.sector] || "—"}</td>
                  <td style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>{l.city} {l.country ? `(${l.country})` : ""}</td>
                  <td style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
                    {l.report?.region_score != null
                      ? `${l.report.region_score}/100 · ${l.report.region_rank}e/${l.report.region_count}`
                      : "—"}
                  </td>
                  <td style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, color: l.marketing_consent ? C.green : C.faint }}>{l.marketing_consent ? "Oui" : "Non"}</td>
                  <td style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
                    {l.converted_tenant_id
                      ? <Link href={`/admin/tenants/${l.converted_tenant_id}`} style={{ color: C.green }}>Oui →</Link>
                      : <span style={{ color: C.faint }}>Non</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "center", marginTop: "16px" }}>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ ...pill(C.teal, page > 1), padding: "6px 14px" }}>←</button>
          <span style={{ fontSize: "12px", color: C.muted }}>Page {page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} style={{ ...pill(C.teal, page < pages), padding: "6px 14px" }}>→</button>
        </div>
      )}
    </div>
  );
}

// ── Parrainages ───────────────────────────────────────────────────────────────

function ReferralsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.adminReferrals().then(setRows).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: C.faint, fontSize: "13px" }}>Chargement…</p>;
  if (error) return <p style={{ color: C.red, fontSize: "13px" }}>{error}</p>;
  if (rows.length === 0) {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "36px", textAlign: "center" }}>
        <p style={{ color: C.faint, fontSize: "14px", margin: 0 }}>Aucun parrainage pour l&apos;instant.</p>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {rows.map((r) => (
        <div key={r.id} style={{ background: C.card, border: `1px solid ${r.reward_status === "failed" ? "rgba(248,113,113,0.4)" : C.border}`, borderRadius: "12px", padding: "12px 18px", display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "14px", color: C.text }}>
              <Link href={`/admin/tenants/${r.referred?.id}`} style={{ color: C.text, fontWeight: 600 }}>{r.referred?.name ?? "—"}</Link>
              <span style={{ color: C.muted }}> parrainé par </span>
              <Link href={`/admin/tenants/${r.referrer?.id}`} style={{ color: "#2A8FA5" }}>{r.referrer?.name ?? "—"}</Link>
            </p>
            <p style={{ margin: "3px 0 0", fontSize: "12px", color: C.faint }}>
              Inscrit le {fmtDate(r.created_at)} · via {r.via === "badge" ? "le badge du site" : r.via === "code" ? "code saisi" : "lien"}
              {r.converted_at ? ` · abonné le ${fmtDate(r.converted_at)}` : ""}
              {r.reward_detail ? ` · ${r.reward_detail}` : ""}
            </p>
          </div>
          <span style={pill(r.reward_status === "failed" ? C.red : r.status === "converted" ? C.green : C.gold)}>
            {r.status === "converted" ? (REWARD_LABELS[r.reward_status] ?? r.reward_status) : "Inscrit, pas encore abonné"}
          </span>
        </div>
      ))}
    </div>
  );
}
