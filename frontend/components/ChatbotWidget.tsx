"use client";
import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function _track(slug: string, type: string) {
  try {
    const sid = sessionStorage.getItem("_pp_sid") ?? "unknown";
    fetch(`${API_URL}/api/v1/analytics/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_slug: slug, session_id: sid, event_type: type, section: null, data: null }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

export default function ChatbotWidget({ tenantSlug }: { tenantSlug: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const openFired = useRef(false);

  useEffect(() => {
    if (open && !openFired.current) {
      openFired.current = true;
      _track(tenantSlug, "chatbot_open");
    }
    if (open && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: "Bonjour ! Comment puis-je vous aider ? Je peux répondre à vos questions sur nos services et vous aider à prendre rendez-vous.",
        },
      ]);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/chatbot/${tenantSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updated,
          session_id: sessionId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? `Erreur ${res.status}`);
      }

      const data = await res.json();
      setSessionId(data.session_id);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      _track(tenantSlug, "chatbot_message");
    } catch (err: any) {
      setError(err.message ?? "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Ouvrir le chatbot"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 flex items-center justify-center text-2xl transition-transform hover:scale-105"
      >
        {open ? "✕" : "💬"}
      </button>

      {/* Fenêtre de chat */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="bg-indigo-600 text-white px-4 py-3 flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <div>
              <p className="font-semibold text-sm">Assistant virtuel</p>
              <p className="text-xs text-indigo-200">Répond en quelques secondes</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-none"
                      : "bg-gray-100 text-gray-800 rounded-bl-none"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-400 px-3 py-2 rounded-2xl rounded-bl-none text-sm">
                  En train de répondre…
                </div>
              </div>
            )}
            {error && (
              <div className="text-xs text-red-500 text-center">{error}</div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t p-3 flex gap-2">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Votre question…"
              className="flex-1 resize-none border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              Envoyer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
