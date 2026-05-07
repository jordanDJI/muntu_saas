"use client";
import { useState, use } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const EMPTY_FORM = { first_name: "", last_name: "", email: "", phone: "", message: "", contact_type: "individual" };

export default function ContactWidget({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const isCompany = form.contact_type === "company";
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/v1/booking/${slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, request_type: "contact", audience_type: isCompany ? "b2b" : "b2c" }),
      });
      if (!res.ok) { const e2 = await res.json().catch(() => ({})); throw new Error(e2.detail ?? "Erreur"); }
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? "Une erreur est survenue.");
    }
    setSubmitting(false);
  };

  const inputStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb", borderRadius: 8,
    padding: "9px 12px", fontSize: 14, outline: "none",
    width: "100%", boxSizing: "border-box", fontFamily: "inherit",
  };
  const labelStyle: React.CSSProperties = {
    display: "flex", flexDirection: "column", gap: 5, fontSize: 14,
  };

  if (done) return (
    <div style={{
      fontFamily: "system-ui,sans-serif", minHeight: "100vh", background: "#fff",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 24, textAlign: "center", gap: 14, boxSizing: "border-box",
    }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>✓</div>
      <h2 style={{ margin: 0, fontSize: 18, color: "#111" }}>Message envoyé !</h2>
      <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>Nous vous répondrons dans les plus brefs délais.</p>
      <button
        onClick={() => { setDone(false); setForm(EMPTY_FORM); }}
        style={{
          border: "none", borderRadius: 10, padding: "10px 20px", cursor: "pointer",
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff",
          fontWeight: 600, fontSize: 14,
        }}
      >
        Nouveau message
      </button>
    </div>
  );

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "8px", fontSize: 13, fontWeight: 600, border: "none",
    cursor: "pointer", background: active ? "#1f2937" : "#f9fafb",
    color: active ? "#fff" : "#6b7280", transition: "all .15s",
  });

  return (
    <div style={{ fontFamily: "system-ui,sans-serif", minHeight: "100vh", background: "#fff", padding: 20, boxSizing: "border-box" }}>
      <h2 style={{ margin: "0 0 18px", fontSize: 17, color: "#111" }}>Nous contacter</h2>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Type toggle */}
        <div style={{ display: "flex", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          <button type="button" style={toggleStyle(!isCompany)} onClick={() => setForm((f) => ({ ...f, contact_type: "individual" }))}>
            Particulier
          </button>
          <button type="button" style={toggleStyle(isCompany)} onClick={() => setForm((f) => ({ ...f, contact_type: "company" }))}>
            Entreprise
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={labelStyle}>
            <span style={{ color: "#374151", fontWeight: 500 }}>{isCompany ? "Nom de l'entreprise *" : "Prénom *"}</span>
            <input type="text" required value={form.first_name} onChange={set("first_name")} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span style={{ color: "#374151", fontWeight: 500 }}>{isCompany ? "Contact" : "Nom *"}</span>
            <input type="text" required={!isCompany} value={form.last_name} onChange={set("last_name")} style={inputStyle} />
          </label>
        </div>

        <label style={labelStyle}>
          <span style={{ color: "#374151", fontWeight: 500 }}>Email *</span>
          <input type="email" required value={form.email} onChange={set("email")} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          <span style={{ color: "#374151", fontWeight: 500 }}>Téléphone</span>
          <input type="tel" value={form.phone} onChange={set("phone")} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          <span style={{ color: "#374151", fontWeight: 500 }}>Message *</span>
          <textarea
            required rows={4} value={form.message} onChange={set("message")}
            style={{ ...inputStyle, resize: "vertical" }}
            placeholder="Comment pouvons-nous vous aider ?"
          />
        </label>

        {error && <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          style={{
            border: "none", borderRadius: 10, padding: "12px",
            cursor: submitting ? "default" : "pointer",
            background: submitting ? "#e5e7eb" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
            color: submitting ? "#9ca3af" : "#fff",
            fontWeight: 600, fontSize: 14, marginTop: 4,
          }}
        >
          {submitting ? "Envoi en cours…" : "Envoyer le message"}
        </button>
      </form>
    </div>
  );
}
