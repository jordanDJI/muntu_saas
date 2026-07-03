"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../contexts/LanguageContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type Invoice = {
  id: string;
  number: string;
  status: "draft" | "sent" | "paid" | "cancelled" | "overdue";
  issue_date: string;
  due_date?: string;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes?: string;
  payment_terms?: string;
  client_name?: string;
  client_email?: string;
  pdf_url?: string;
  ubl_url?: string;
  paid_at?: string;
  sent_at?: string;
  created_at: string;
  contact_id?: string;
  appointment_id?: string;
  lines?: InvoiceLine[];
};

type InvoiceLine = {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total: number;
  position: number;
};

type Contact = { id: string; first_name?: string; last_name?: string; email?: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  draft:     { label: "Brouillon",  bg: "#F3F4F6", color: "#6B7280" },
  sent:      { label: "Envoyée",    bg: "#EFF6FF", color: "#2563EB" },
  paid:      { label: "Payée",      bg: "#F0FDF4", color: "#16A34A" },
  overdue:   { label: "En retard",  bg: "#FEF2F2", color: "#DC2626" },
  cancelled: { label: "Annulée",    bg: "#F9FAFB", color: "#9CA3AF" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: "#F3F4F6", color: "#6B7280" };
  return (
    <span style={{ background: cfg.bg, color: cfg.color }}
      className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
      {cfg.label}
    </span>
  );
}

function fmtAmount(v: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(v);
}

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

function emptyLine(): InvoiceLine {
  return { description: "", quantity: 1, unit_price: 0, tax_rate: 0, total: 0, position: 0 };
}

// ── Modal Création / Édition ──────────────────────────────────────────────────

function InvoiceFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Invoice;
  onClose: () => void;
  onSaved: (inv: Invoice) => void;
}) {
  const isEdit = !!initial;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState(initial?.contact_id ?? "");
  const [issueDate, setIssueDate] = useState(initial?.issue_date ?? new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "EUR");
  const [taxRate, setTaxRate] = useState(String(initial?.lines?.[0]?.tax_rate ?? 0));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [paymentTerms, setPaymentTerms] = useState(initial?.payment_terms ?? "");
  const [lines, setLines] = useState<InvoiceLine[]>(
    initial?.lines?.length ? initial.lines : [emptyLine()]
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.getContacts({ limit: 100 })
      .then((r: any) => setContacts(r.contacts ?? []))
      .catch((e: any) => setErr(`Impossible de charger les contacts : ${e.message}`));
  }, []);

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const taxAmt = subtotal * Number(taxRate) / 100;
  const total = subtotal + taxAmt;

  function updateLine(i: number, field: keyof InvoiceLine, val: string | number) {
    setLines(prev => {
      const next = [...prev];
      (next[i] as any)[field] = val;
      if (field === "quantity" || field === "unit_price") {
        next[i].total = Number(next[i].quantity) * Number(next[i].unit_price);
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true); setErr("");
    try {
      const body = {
        contact_id: contactId || undefined,
        issue_date: issueDate,
        due_date: dueDate || undefined,
        currency,
        tax_rate: Number(taxRate),
        notes: notes || undefined,
        payment_terms: paymentTerms || undefined,
        lines: lines
          .filter(l => l.description.trim())
          .map((l, i) => ({ ...l, position: i, tax_rate: Number(taxRate) })),
      };
      const result = isEdit
        ? await api.updateInvoice(initial!.id, body)
        : await api.createInvoice(body);
      onSaved(result);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const readOnly = isEdit && initial?.status !== "draft";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-lg text-gray-800">
            {isEdit ? `Facture ${initial!.number}` : "Nouvelle facture"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Client */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Client</label>
            <select
              value={contactId}
              onChange={e => setContactId(e.target.value)}
              disabled={readOnly}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 disabled:bg-gray-50"
            >
              <option value="">— Sélectionner un contact —</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>
                  {[c.first_name, c.last_name].filter(Boolean).join(" ")} {c.email ? `(${c.email})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Dates + currency */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Date d'émission</label>
              <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} disabled={readOnly}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Échéance</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={readOnly}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Devise</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} disabled={readOnly}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 disabled:bg-gray-50">
                {["EUR", "USD", "GBP", "CHF", "CAD"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Lignes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">Prestations</label>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="pb-1 text-left font-semibold w-1/2">Description</th>
                  <th className="pb-1 text-center font-semibold">Qté</th>
                  <th className="pb-1 text-right font-semibold">Prix HT</th>
                  <th className="pb-1 text-right font-semibold">Total</th>
                  {!readOnly && <th className="pb-1 w-6" />}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1 pr-2">
                      <input value={line.description} onChange={e => updateLine(i, "description", e.target.value)}
                        disabled={readOnly} placeholder="Description…"
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-300 disabled:bg-gray-50" />
                    </td>
                    <td className="py-1 px-1">
                      <input type="number" min={0} step="0.5" value={line.quantity}
                        onChange={e => updateLine(i, "quantity", Number(e.target.value))}
                        disabled={readOnly}
                        className="w-16 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-300 disabled:bg-gray-50" />
                    </td>
                    <td className="py-1 pl-1">
                      <input type="number" min={0} step="0.01" value={line.unit_price}
                        onChange={e => updateLine(i, "unit_price", Number(e.target.value))}
                        disabled={readOnly}
                        className="w-24 text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-300 disabled:bg-gray-50" />
                    </td>
                    <td className="py-1 pl-2 text-right font-semibold text-gray-700 whitespace-nowrap">
                      {fmtAmount(line.quantity * line.unit_price, currency)}
                    </td>
                    {!readOnly && (
                      <td className="py-1 pl-1">
                        <button onClick={() => setLines(prev => prev.filter((_, j) => j !== i))}
                          className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!readOnly && (
              <button onClick={() => setLines(prev => [...prev, emptyLine()])}
                className="mt-2 text-xs text-teal-600 hover:text-teal-800 font-semibold">
                + Ajouter une ligne
              </button>
            )}
          </div>

          {/* TVA + totaux */}
          <div className="flex items-start gap-4">
            <div className="w-32">
              <label className="block text-xs font-semibold text-gray-500 mb-1">TVA (%)</label>
              <input type="number" min={0} max={100} step="0.5" value={taxRate}
                onChange={e => setTaxRate(e.target.value)} disabled={readOnly}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 disabled:bg-gray-50" />
            </div>
            <div className="flex-1 bg-gray-50 rounded-xl p-4 text-sm space-y-1">
              <div className="flex justify-between text-gray-500">
                <span>Sous-total HT</span>
                <span>{fmtAmount(subtotal, currency)}</span>
              </div>
              {Number(taxRate) > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>TVA ({taxRate}%)</span>
                  <span>{fmtAmount(taxAmt, currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-800 border-t border-gray-200 pt-1">
                <span>Total TTC</span>
                <span>{fmtAmount(total, currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes + conditions */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Conditions de paiement</label>
              <input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} disabled={readOnly}
                placeholder="ex: Paiement à 30 jours"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Note interne</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} disabled={readOnly}
                placeholder="Note optionnelle…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 disabled:bg-gray-50" />
            </div>
          </div>

          {err && <p className="text-red-500 text-sm">{err}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            {readOnly ? "Fermer" : "Annuler"}
          </button>
          {!readOnly && (
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
              {saving ? "Enregistrement…" : isEdit ? "Mettre à jour" : "Créer la facture"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

const TABS = [
  { key: "",          label: "Toutes" },
  { key: "draft",     label: "Brouillons" },
  { key: "sent",      label: "Envoyées" },
  { key: "paid",      label: "Payées" },
  { key: "overdue",   label: "En retard" },
  { key: "cancelled", label: "Annulées" },
];

export default function InvoicesPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getInvoices(statusFilter ? { status: statusFilter, limit: 100 } : { limit: 100 });
      setInvoices(res.invoices);
      setTotal(res.total);
    } catch { /* silently degrade */ }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function openInvoice(inv: Invoice) {
    setLoadingInvoice(inv.id);
    try {
      const full = await api.getInvoice(inv.id);
      setEditInvoice(full);
    } catch {
      setEditInvoice(inv);
    } finally {
      setLoadingInvoice(null);
    }
  }

  function setAction(id: string, loading: boolean, err = "") {
    setActionLoading(p => ({ ...p, [id]: loading }));
    setActionErr(p => ({ ...p, [id]: err }));
  }

  async function handleSend(inv: Invoice) {
    if (!confirm(`Envoyer la facture ${inv.number} à ${inv.client_email || "ce client"} ?`)) return;
    setAction(inv.id, true);
    try {
      await api.sendInvoice(inv.id);
      load();
    } catch (e: any) { setAction(inv.id, false, e.message); }
    finally { setAction(inv.id, false); }
  }

  async function handleMarkPaid(inv: Invoice) {
    if (!confirm(`Marquer la facture ${inv.number} comme payée ?`)) return;
    setAction(inv.id, true);
    try {
      await api.markInvoicePaid(inv.id);
      load();
    } catch (e: any) { setAction(inv.id, false, e.message); }
    finally { setAction(inv.id, false); }
  }

  async function handleDelete(inv: Invoice) {
    if (!confirm(`Supprimer définitivement le brouillon ${inv.number} ?`)) return;
    setAction(inv.id, true);
    try {
      await api.deleteInvoice(inv.id);
      load();
    } catch (e: any) { setAction(inv.id, false, e.message); }
    finally { setAction(inv.id, false); }
  }

  async function handleCancel(inv: Invoice) {
    if (!confirm(`Annuler la facture ${inv.number} ? Cette action est irréversible.`)) return;
    setAction(inv.id, true);
    try {
      await api.cancelInvoice(inv.id);
      load();
    } catch (e: any) { setAction(inv.id, false, e.message); }
    finally { setAction(inv.id, false); }
  }

  async function handleDownloadPdf(inv: Invoice) {
    setAction(inv.id, true);
    try { await api.downloadInvoicePdf(inv.id, inv.number); }
    catch (e: any) { setAction(inv.id, false, e.message); return; }
    setAction(inv.id, false);
  }

  async function handleDownloadUbl(inv: Invoice) {
    setAction(inv.id, true);
    try { await api.downloadInvoiceUbl(inv.id, inv.number); }
    catch (e: any) { setAction(inv.id, false, e.message); return; }
    setAction(inv.id, false);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Factures</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} facture{total !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-teal-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nouvelle facture
        </button>
      </div>

      {/* Workflow hint */}
      <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
        {[
          { status: "draft",     label: "Brouillon", color: "#9CA3AF" },
          { status: "sent",      label: "Envoyée",   color: "#2563EB" },
          { status: "paid",      label: "Payée",     color: "#16A34A" },
          { status: "overdue",   label: "En retard", color: "#DC2626" },
          { status: "cancelled", label: "Annulée",   color: "#9CA3AF" },
        ].map((s, i, arr) => (
          <span key={s.status} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: s.color }} />
            <span style={{ color: s.color }} className="font-semibold">{s.label}</span>
            {i < arr.length - 1 && <span className="text-gray-300">→</span>}
          </span>
        ))}
        <span className="ml-2 text-gray-300">|</span>
        <span className="text-gray-400">Le statut <strong className="text-red-400">En retard</strong> est posé automatiquement si l'échéance est dépassée</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              statusFilter === tab.key
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Chargement…</div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 space-y-2">
            <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium">Aucune facture{statusFilter ? ` "${STATUS_CONFIG[statusFilter]?.label}"` : ""}</span>
            {!statusFilter && (
              <button onClick={() => setShowCreate(true)} className="text-teal-600 text-sm font-semibold hover:underline">
                Créer votre première facture →
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">N°</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Échéance</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Montant TTC</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">
                      {inv.number}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{inv.client_name || "—"}</div>
                      {inv.client_email && <div className="text-xs text-gray-400">{inv.client_email}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(inv.issue_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {inv.due_date ? (
                        <span className={
                          inv.status === "overdue" || (inv.status !== "paid" && inv.due_date < new Date().toISOString().slice(0, 10))
                            ? "text-red-500 font-semibold"
                            : "text-gray-600"
                        }>
                          {fmtDate(inv.due_date)}
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                      {fmtAmount(inv.total, inv.currency)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {actionErr[inv.id] && (
                          <span className="text-xs text-red-500 mr-1">{actionErr[inv.id]}</span>
                        )}

                        {/* Éditer / Voir (tous statuts) */}
                        <button
                          onClick={() => openInvoice(inv)}
                          disabled={loadingInvoice === inv.id}
                          title={inv.status === "draft" ? "Modifier" : "Voir le détail"}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors disabled:opacity-50"
                        >
                          {loadingInvoice === inv.id ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              {inv.status === "draft"
                                ? <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                : <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              }
                            </svg>
                          )}
                        </button>

                        {/* Envoyer (draft ou sent) */}
                        {["draft", "sent"].includes(inv.status) && inv.client_email && (
                          <button
                            onClick={() => handleSend(inv)}
                            disabled={actionLoading[inv.id]}
                            title="Envoyer par email"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </button>
                        )}

                        {/* Marquer payée (sent ou overdue) */}
                        {["sent", "overdue"].includes(inv.status) && (
                          <button
                            onClick={() => handleMarkPaid(inv)}
                            disabled={actionLoading[inv.id]}
                            title="Marquer comme payée"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        )}

                        {/* Télécharger PDF */}
                        <button
                          onClick={() => handleDownloadPdf(inv)}
                          disabled={actionLoading[inv.id]}
                          title="Télécharger PDF"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>

                        {/* Télécharger UBL */}
                        <button
                          onClick={() => handleDownloadUbl(inv)}
                          disabled={actionLoading[inv.id]}
                          title="Télécharger UBL 2.1 XML"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                        </button>

                        {/* Annuler (draft, sent, overdue) */}
                        {["draft", "sent", "overdue"].includes(inv.status) && (
                          <button
                            onClick={() => handleCancel(inv)}
                            disabled={actionLoading[inv.id]}
                            title="Annuler la facture"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors disabled:opacity-50"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        )}

                        {/* Supprimer (draft uniquement) */}
                        {inv.status === "draft" && (
                          <button
                            onClick={() => handleDelete(inv)}
                            disabled={actionLoading[inv.id]}
                            title="Supprimer définitivement"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <InvoiceFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}
      {editInvoice && (
        <InvoiceFormModal
          initial={editInvoice}
          onClose={() => setEditInvoice(null)}
          onSaved={() => { setEditInvoice(null); load(); }}
        />
      )}
    </div>
  );
}
