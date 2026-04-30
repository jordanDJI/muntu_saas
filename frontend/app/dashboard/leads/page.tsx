"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";

const STATUSES = ["new", "contacted", "qualified", "scheduled", "closed_won", "closed_lost"];

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);
  const [filter, setFilter] = useState<string | undefined>(undefined);

  const load = (status?: string) => {
    api.getLeads(status ? { status } : undefined).then(setLeads).catch(console.error);
  };

  useEffect(() => { load(filter); }, [filter]);

  const updateStatus = async (id: string, newStatus: string) => {
    await api.updateLead(id, { status: newStatus });
    load(filter);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Demandes (leads)</h1>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Retour au dashboard
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter(undefined)}
          className={`px-3 py-1 rounded-full text-sm border ${!filter ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600"}`}
        >
          Tous
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-sm border ${filter === s ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Lead cards */}
      <div className="space-y-3">
        {leads.map((lead) => (
          <div key={lead.id} className="bg-white rounded-xl shadow p-4 flex justify-between items-start gap-4">
            <div>
              <p className="font-semibold">{lead.contact?.first_name} {lead.contact?.last_name}</p>
              <p className="text-sm text-gray-500">{lead.contact?.email} · {lead.contact?.phone}</p>
              <p className="text-xs text-gray-400 mt-1">{lead.request_type} — {lead.source}</p>
            </div>
            <select
              value={lead.status}
              onChange={(e) => updateStatus(lead.id, e.target.value)}
              className="text-sm border rounded-lg px-2 py-1 bg-white"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        ))}
        {leads.length === 0 && <p className="text-gray-400 text-sm">Aucune demande trouvée.</p>}
      </div>
    </div>
  );
}
