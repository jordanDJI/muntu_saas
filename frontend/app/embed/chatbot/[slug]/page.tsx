"use client";
import { useState, useRef, useEffect, use } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Msg { role: "user" | "assistant"; text: string }

function postResize(w: string, h: string, r: string) {
  window.parent.postMessage({ type: "saas-chatbot-resize", w, h, r }, "*");
}

export default function ChatbotWidget({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    postResize("60px", "60px", "50%");
  }, []);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setUnread(0);
      postResize("380px", "540px", "16px");
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      postResize("60px", "60px", "50%");
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const history = [...messages, { role: "user" as const, text }];
    setMessages(history);
    setLoading(true);
    try {
      const body = {
        messages: history.map((m) => ({ role: m.role, content: m.text })),
        session_id: sessionId,
      };
      const res = await fetch(`${API_URL}/api/v1/chatbot/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.session_id) setSessionId(data.session_id);
      setMessages((prev) => [...prev, { role: "assistant", text: data.reply ?? "Désolé, une erreur est survenue." }]);
      if (!open) setUnread((u) => u + 1);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Désolé, je suis temporairement indisponible." }]);
    }
    setLoading(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // ── Closed bubble ──────────────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={toggle}
        aria-label="Ouvrir le chat"
        style={{
          position: "fixed", bottom: 0, right: 0,
          width: 60, height: 60, borderRadius: "50%",
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          border: "none", cursor: "pointer", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(99,102,241,.4)",
          transition: "transform .2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 6, right: 6,
            background: "#ef4444", color: "#fff", borderRadius: "50%",
            width: 16, height: 16, fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {unread}
          </span>
        )}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
        </svg>
      </button>
    );
  }

  // ── Open chat window ───────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0,
      display: "flex", flexDirection: "column",
      background: "#fff", borderRadius: 16,
      boxShadow: "0 8px 40px rgba(0,0,0,.18)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
        color: "#fff", padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 10,
        flexShrink: 0,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "rgba(255,255,255,.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm1 17.93V18a1 1 0 1 0-2 0v1.93A8 8 0 0 1 4.07 13H6a1 1 0 1 0 0-2H4.07A8 8 0 0 1 11 4.07V6a1 1 0 1 0 2 0V4.07A8 8 0 0 1 19.93 11H18a1 1 0 1 0 0 2h1.93A8 8 0 0 1 13 19.93z"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Assistant IA</p>
          <p style={{ margin: 0, fontSize: 11, opacity: .8 }}>En ligne · répond instantanément</p>
        </div>
        <button onClick={toggle} aria-label="Fermer" style={{
          background: "none", border: "none", color: "#fff",
          cursor: "pointer", padding: 4, opacity: .8,
          display: "flex", alignItems: "center",
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, marginTop: 40 }}>
            <p style={{ margin: "0 0 6px" }}>👋 Bonjour !</p>
            <p style={{ margin: 0 }}>Comment puis-je vous aider ?</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            display: "flex",
            justifyContent: m.role === "user" ? "flex-end" : "flex-start",
          }}>
            <div style={{
              maxWidth: "82%", padding: "9px 13px",
              borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: m.role === "user" ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "#f3f4f6",
              color: m.role === "user" ? "#fff" : "#111",
              fontSize: 13, lineHeight: 1.5,
              wordBreak: "break-word",
            }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 5, alignItems: "center", paddingLeft: 4 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{
                width: 7, height: 7, borderRadius: "50%", background: "#c4b5fd",
                animation: "bounce 1.2s infinite", animationDelay: `${i * .2}s`,
              }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "10px 12px", borderTop: "1px solid #f0f0f0",
        display: "flex", gap: 8, alignItems: "center", flexShrink: 0,
        background: "#fafafa",
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Votre message..."
          disabled={loading}
          style={{
            flex: 1, border: "1px solid #e5e7eb", borderRadius: 24,
            padding: "9px 14px", fontSize: 13, outline: "none",
            background: "#fff",
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            width: 36, height: 36, borderRadius: "50%", border: "none",
            background: input.trim() ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "#e5e7eb",
            color: "#fff", cursor: input.trim() ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "background .2s",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%,80%,100%{transform:translateY(0)}
          40%{transform:translateY(-6px)}
        }
      `}</style>
    </div>
  );
}
