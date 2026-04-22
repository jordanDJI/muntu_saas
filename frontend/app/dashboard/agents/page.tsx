"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, supabase } from "../../../lib/api";

const AGENT_LABELS: Record<string, string> = {
  vitrine: "Chatbot vitrine (Agent 1)",
  support_client: "Support client WhatsApp (Agent 2)",
  assistant_tenant: "Assistant professionnel (Agent 3)",
};

const AGENT_DESCRIPTIONS: Record<string, string> = {
  vitrine: "Répond aux questions FAQ et gère les rendez-vous sur votre site public.",
  support_client: "Accompagne vos clients convertis via WhatsApp — lecture de documents, gestion RDV.",
  assistant_tenant: "Votre assistant opérationnel — notifications RDV, synthèses, gestion du calendrier.",
};

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];

export default function AgentsPage() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [syntheses, setSyntheses] = useState<any[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    api.getAgentConfigs().then(setConfigs).catch(console.error);
    api.getAgentSyntheses().then(setSyntheses).catch(console.error);

    // Charge le nom de l'utilisateur connecté
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const meta = user.user_metadata ?? {};
      const name = [meta.first_name, meta.last_name].filter(Boolean).join(" ")
        || meta.full_name
        || user.email?.split("@")[0]
        || "";
      setUserName(name);
    });
  }, []);

  const handleUpdate = async (agentType: string, field: string, value: string | number) => {
    setSaving(agentType);
    setError(null);
    try {
      const updated = await api.updateAgentConfig(agentType, { [field]: value });
      setConfigs((prev) => prev.map((c) => (c.agent_type === agentType ? updated : c)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  const toggleStatus = (config: any) => {
    const next = config.status === "active" ? "inactive" : "active";
    handleUpdate(config.agent_type, "status", next);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Agents IA</h1>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-indigo-600">← Tableau de bord</Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Configurations agents */}
      <div className="space-y-4">
        {configs.length === 0 && (
          <p className="text-gray-400 text-sm">Aucun agent configuré. Ils seront créés automatiquement à votre prochaine connexion.</p>
        )}
        {configs.map((config) => (
          <div key={config.agent_type} className="bg-white rounded-xl shadow p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-semibold text-lg">{AGENT_LABELS[config.agent_type] ?? config.agent_type}</h2>
                <p className="text-sm text-gray-500 mt-1">{AGENT_DESCRIPTIONS[config.agent_type]}</p>
              </div>
              <button
                onClick={() => toggleStatus(config)}
                disabled={saving === config.agent_type}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  config.status === "active"
                    ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700"
                    : "bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700"
                }`}
              >
                {saving === config.agent_type ? "…" : config.status === "active" ? "Actif" : "Inactif"}
              </button>
            </div>

            {/* Modèle LLM */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modèle LLM</label>
              <select
                value={config.model}
                onChange={(e) => handleUpdate(config.agent_type, "model", e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Prompt système */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prompt système <span className="text-gray-400 font-normal">(optionnel — personnalise le comportement)</span>
              </label>
              <textarea
                rows={3}
                defaultValue={config.system_prompt ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (config.system_prompt ?? "")) {
                    handleUpdate(config.agent_type, "system_prompt", e.target.value);
                  }
                }}
                placeholder={`Ex : Tu es l'assistant de ${userName || "votre prénom"}, professionnel de santé. Réponds en français, sois bienveillant…`}
                className="border rounded-lg px-3 py-2 text-sm w-full resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            {/* Fréquence de synthèse (agent 3 uniquement) */}
            {config.agent_type === "assistant_tenant" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fréquence de synthèse (minutes)
                </label>
                <input
                  type="number"
                  min={30}
                  max={1440}
                  defaultValue={config.synthesis_schedule_minutes}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val !== config.synthesis_schedule_minutes) {
                      handleUpdate(config.agent_type, "synthesis_schedule_minutes", val);
                    }
                  }}
                  className="border rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <p className="text-xs text-gray-400 mt-1">Min 30 min — Max 1440 min (24h)</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Synthèses récentes */}
      {syntheses.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-lg mb-4">Synthèses récentes</h2>
          <ul className="space-y-4">
            {syntheses.map((s) => (
              <li key={s.id} className="border-l-4 border-indigo-400 pl-4">
                <p className="text-xs text-gray-400 mb-1">
                  {new Date(s.period_start).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" })}
                  {" → "}
                  {new Date(s.period_end).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" })}
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{s.content}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
