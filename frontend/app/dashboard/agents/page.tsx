"use client";
import { useEffect, useRef, useState } from "react";
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

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function AgentsPage() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [syntheses, setSyntheses] = useState<any[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [myRole, setMyRole] = useState<string>("member");

  // Agent 3 chat state
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatConvId, setChatConvId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Telegram setup state
  const [telegramSetupLoading, setTelegramSetupLoading] = useState(false);
  const [telegramSetupMsg, setTelegramSetupMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [botUsername, setBotUsername] = useState<string>("");
  const [activateUrl, setActivateUrl] = useState<string>("");

  useEffect(() => {
    api.getAgentConfigs().then((cfgs) => {
      setConfigs(cfgs);
      const a3 = cfgs.find((c: any) => c.agent_type === "assistant_tenant");
      if (a3?.telegram_bot_token) {
        api.getTelegramBotInfo().then((info) => {
          setBotUsername(info.username);
          setActivateUrl(info.activate_url);
        }).catch(() => {});
      }
    }).catch(console.error);
    api.getAgentSyntheses().then(setSyntheses).catch(console.error);
    api.getMyRole().then(({ role }) => setMyRole(role)).catch(() => {});
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const meta = user.user_metadata ?? {};
      const name =
        [meta.first_name, meta.last_name].filter(Boolean).join(" ") ||
        meta.full_name ||
        user.email?.split("@")[0] ||
        "";
      setUserName(name);
    });
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

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

  const setupTelegram = async () => {
    setTelegramSetupLoading(true);
    setTelegramSetupMsg(null);
    try {
      const res = await api.setupTelegramWebhook();
      if (res.bot_username) setBotUsername(res.bot_username);
      // Rafraîchir l'URL d'activation avec le bon tenant_id depuis le backend
      api.getTelegramBotInfo().then((info) => {
        setBotUsername(info.username);
        setActivateUrl(info.activate_url);
      }).catch(() => {});
      setTelegramSetupMsg({ ok: true, text: `Webhook enregistré${res.bot_username ? ` (@${res.bot_username})` : ""}` });
    } catch (e: any) {
      setTelegramSetupMsg({ ok: false, text: e.message });
    } finally {
      setTelegramSetupLoading(false);
    }
  };

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: text }]);
    setChatLoading(true);
    try {
      const res = await api.assistantChat({ message: text, conversation_id: chatConvId });
      setChatConvId(res.conversation_id);
      setChatMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    } catch (e: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Erreur : ${e.message}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Agents IA</h1>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Retour au dashboard
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {configs.length === 0 && (
          <p className="text-gray-400 text-sm">
            Aucun agent configuré. Ils seront créés automatiquement à votre prochaine connexion.
          </p>
        )}

        {configs.map((config) => (
          <div key={config.agent_type} className="bg-white rounded-xl shadow p-6 space-y-4">
            {/* En-tête */}
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
                Prompt système{" "}
                <span className="text-gray-400 font-normal">(optionnel — personnalise le comportement)</span>
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
                className="border rounded-lg px-3 py-2 text-sm w-full resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            {/* Canal Agent 2 — Telegram (WhatsApp à venir) */}
            {config.agent_type === "support_client" && (
              <div className="space-y-4">
                <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
                  <p className="text-xs text-blue-700">
                    <span className="font-medium">Canal Telegram</span> — configurez votre bot dans l'Agent 3 ci-dessous.
                    Le même bot sert les clients (Agent 2) et votre assistant personnel (Agent 3).
                    Vous générerez ensuite des liens d'invitation par contact depuis la page Leads.
                  </p>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
                  <p className="text-xs text-amber-700">
                    <span className="font-medium">Canal WhatsApp</span> — en attente d'approbation Meta WhatsApp Business API.
                    Disponible prochainement.
                  </p>
                </div>
              </div>
            )}

            {/* Telegram + fréquence synthèse — Agent 3 */}
            {config.agent_type === "assistant_tenant" && (
              <>
                {/* Telegram — token + setup + activation */}
                <div className="space-y-3">
                  {(myRole === "owner" || myRole === "admin") ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bot Telegram{" "}
                          <span className="text-gray-400 font-normal">
                            (créez-le sur{" "}
                            <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="underline">
                              @BotFather
                            </a>
                            , copiez le token ici)
                          </span>
                        </label>
                        <input
                          type="text"
                          defaultValue={config.telegram_bot_token ?? ""}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val !== (config.telegram_bot_token ?? "")) {
                              handleUpdate(config.agent_type, "telegram_bot_token", val);
                              setBotUsername("");
                            }
                          }}
                          placeholder="123456789:AAF..."
                          className="border rounded-lg px-3 py-2 text-sm w-full font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Ce bot sert à la fois aux clients (Agent 2) et à votre assistant personnel (Agent 3).
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={setupTelegram}
                          disabled={telegramSetupLoading || !config.telegram_bot_token}
                          className="text-sm bg-indigo-600 text-white rounded-lg px-3 py-1.5 font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                        >
                          {telegramSetupLoading ? "Enregistrement…" : "Enregistrer le webhook"}
                        </button>
                        {telegramSetupMsg && (
                          <span className={`text-xs ${telegramSetupMsg.ok ? "text-green-600" : "text-red-600"}`}>
                            {telegramSetupMsg.ok ? "✓ " : "✗ "}{telegramSetupMsg.text}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                      La configuration Telegram est réservée au propriétaire et aux admins.
                    </p>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Activer l'assistant sur votre Telegram personnel
                    </label>
                    {config.telegram_notify_chat_id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-1 font-medium">
                          ✓ Activé
                        </span>
                        <button
                          onClick={() => handleUpdate(config.agent_type, "telegram_notify_chat_id", "")}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Désactiver
                        </button>
                      </div>
                    ) : activateUrl ? (
                      <div>
                        <a
                          href={activateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition-colors"
                        >
                          {botUsername ? `Ouvrir @${botUsername} et activer` : "Activer l'assistant Telegram"}
                        </a>
                        <p className="text-xs text-gray-400 mt-1">
                          Cliquez, appuyez START dans Telegram — le bot enregistre automatiquement votre chat.
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">
                        {config.telegram_bot_token
                          ? "Cliquez « Enregistrer le webhook » pour obtenir le lien d'activation."
                          : "Entrez le token du bot ci-dessus, puis enregistrez le webhook."}
                      </p>
                    )}
                  </div>
                </div>

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

                {/* Chat Agent 3 inline */}
                {config.status === "active" && (
                  <div className="border-t pt-4 mt-2">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Discuter avec votre assistant
                    </h3>

                    {/* Zone de messages */}
                    <div className="bg-gray-50 rounded-lg p-3 h-64 overflow-y-auto space-y-3 mb-3">
                      {chatMessages.length === 0 && (
                        <p className="text-xs text-gray-400 text-center mt-8">
                          Posez une question sur vos RDV, vos leads ou votre planning…
                        </p>
                      )}
                      {chatMessages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                              msg.role === "user"
                                ? "bg-indigo-600 text-white"
                                : "bg-white border border-gray-200 text-gray-800"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                      {chatLoading && (
                        <div className="flex justify-start">
                          <div className="bg-white border border-gray-200 rounded-xl px-3 py-2">
                            <span className="text-gray-400 text-xs">Assistant en train d'écrire…</span>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Saisie */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChatMessage()}
                        placeholder="Votre message…"
                        disabled={chatLoading}
                        className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                      />
                      <button
                        onClick={sendChatMessage}
                        disabled={chatLoading || !chatInput.trim()}
                        className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                      >
                        Envoyer
                      </button>
                    </div>
                  </div>
                )}
              </>
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
                  {new Date(s.period_start).toLocaleString("fr-BE", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                  {" → "}
                  {new Date(s.period_end).toLocaleString("fr-BE", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
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
