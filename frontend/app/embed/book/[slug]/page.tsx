"use client";
import { useState, useEffect, use } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Step = "calendar" | "slots" | "form" | "done";

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_FR = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function firstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Mon=0
}
function pad2(n: number) { return String(n).padStart(2, "0"); }

export default function BookWidget({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [step, setStep] = useState<Step>("calendar");
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [availDays, setAvailDays] = useState<number[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [loadingDays, setLoadingDays] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoadingDays(true);
    fetch(`${API_URL}/api/v1/booking/${slug}/available-days?year=${year}&month=${month + 1}`)
      .then((r) => r.json())
      .then((d) => setAvailDays(Array.isArray(d) ? d : []))
      .catch(() => setAvailDays([]))
      .finally(() => setLoadingDays(false));
  }, [slug, year, month]);

  const pickDate = (day: number) => {
    const dateStr = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    setSelectedDate(dateStr);
    setLoadingSlots(true);
    fetch(`${API_URL}/api/v1/booking/${slug}/slots?date=${dateStr}`)
      .then((r) => r.json())
      .then((d) => setSlots(Array.isArray(d) ? d : []))
      .catch(() => setSlots([]))
      .finally(() => { setLoadingSlots(false); setStep("slots"); });
  };

  const pickSlot = (slot: any) => { setSelectedSlot(slot); setStep("form"); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.email) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/v1/booking/${slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          scheduled_at: selectedSlot.start,
          slot_duration_min: selectedSlot.duration_min ?? 30,
          request_type: "appointment",
        }),
      });
      if (!res.ok) { const e2 = await res.json().catch(() => ({})); throw new Error(e2.detail ?? "Erreur"); }
      setStep("done");
    } catch (err: any) {
      setError(err.message ?? "Une erreur est survenue.");
    }
    setSubmitting(false);
  };

  const days = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);
  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1;

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const base: React.CSSProperties = { fontFamily: "system-ui,sans-serif", minHeight: "100vh", background: "#fff", padding: 20, boxSizing: "border-box" };
  const btn = (active: boolean): React.CSSProperties => ({
    border: "none", borderRadius: 10, padding: "10px 14px", cursor: "pointer",
    background: active ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "#f3f4f6",
    color: active ? "#fff" : "#374151", fontWeight: 600, fontSize: 13, transition: "all .15s",
  });

  if (step === "done") return (
    <div style={{ ...base, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 12 }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>✓</div>
      <h2 style={{ margin: 0, fontSize: 18, color: "#111" }}>Demande envoyée !</h2>
      <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>Vous recevrez une confirmation par e-mail dès validation.</p>
      <button onClick={() => { setStep("calendar"); setSelectedSlot(null); }} style={{ ...btn(true), marginTop: 8 }}>
        Nouveau rendez-vous
      </button>
    </div>
  );

  return (
    <div style={base}>
      {/* Step indicator */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {(["calendar","slots","form"] as Step[]).map((s, i) => (
          <div key={s} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: ["calendar","slots","form","done"].indexOf(step) >= i ? "#6366f1" : "#e5e7eb",
            transition: "background .3s",
          }} />
        ))}
      </div>

      {/* Calendar */}
      {step === "calendar" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button onClick={prevMonth} style={{ ...btn(false), padding: "6px 10px" }}>‹</button>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{MONTHS_FR[month]} {year}</span>
            <button onClick={nextMonth} style={{ ...btn(false), padding: "6px 10px" }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
            {DAYS_FR.map((d) => <div key={d} style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: days }).map((_, i) => {
              const day = i + 1;
              const isPast = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth()) || (year === today.getFullYear() && month === today.getMonth() && day < today.getDate());
              const avail = availDays.includes(day) && !isPast;
              const isToday = day === todayDay;
              return (
                <button key={day} onClick={() => avail && pickDate(day)} disabled={!avail || loadingDays}
                  style={{
                    border: isToday ? "2px solid #6366f1" : "1px solid transparent",
                    borderRadius: 8, padding: "8px 4px", cursor: avail ? "pointer" : "default",
                    background: avail ? "#ede9fe" : "transparent",
                    color: avail ? "#5b21b6" : "#d1d5db",
                    fontWeight: avail ? 600 : 400, fontSize: 13,
                    transition: "all .15s",
                  }}
                  onMouseEnter={(e) => { if (avail) (e.currentTarget as HTMLButtonElement).style.background = "#c4b5fd"; }}
                  onMouseLeave={(e) => { if (avail) (e.currentTarget as HTMLButtonElement).style.background = "#ede9fe"; }}
                >
                  {day}
                </button>
              );
            })}
          </div>
          {loadingDays && <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, marginTop: 10 }}>Chargement…</p>}
          <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 12 }}>
            Les jours en violet ont des créneaux disponibles
          </p>
        </div>
      )}

      {/* Slots */}
      {step === "slots" && (
        <div>
          <button onClick={() => setStep("calendar")} style={{ ...btn(false), marginBottom: 14, fontSize: 12 }}>← Retour</button>
          <p style={{ margin: "0 0 12px", fontWeight: 600, fontSize: 14 }}>
            Créneaux disponibles — {selectedDate.split("-").reverse().join("/")}
          </p>
          {loadingSlots ? (
            <p style={{ color: "#9ca3af", textAlign: "center" }}>Chargement…</p>
          ) : slots.length === 0 ? (
            <p style={{ color: "#9ca3af", textAlign: "center", fontSize: 13 }}>Aucun créneau disponible ce jour.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
              {slots.map((slot, i) => {
                const time = new Date(slot.start).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
                return (
                  <button key={i} onClick={() => pickSlot(slot)} style={btn(false)}>
                    {time}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Form */}
      {step === "form" && (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button type="button" onClick={() => setStep("slots")} style={{ ...btn(false), fontSize: 12, alignSelf: "flex-start" }}>← Retour</button>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>
            {selectedSlot && new Date(selectedSlot.start).toLocaleString("fr-BE", { dateStyle: "medium", timeStyle: "short" })}
          </p>
          {[
            { key: "first_name", label: "Prénom *", type: "text" },
            { key: "last_name", label: "Nom *", type: "text" },
            { key: "email", label: "Email *", type: "email" },
            { key: "phone", label: "Téléphone", type: "tel" },
            { key: "message", label: "Note (optionnel)", type: "textarea" },
          ].map(({ key, label, type }) => (
            <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              <span style={{ color: "#374151", fontWeight: 500 }}>{label}</span>
              {type === "textarea" ? (
                <textarea rows={3} value={(form as any)[key]} onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 13, resize: "vertical", outline: "none" }} />
              ) : (
                <input type={type} value={(form as any)[key]} onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                  required={["first_name","last_name","email"].includes(key)}
                  style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none" }} />
              )}
            </label>
          ))}
          {error && <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{error}</p>}
          <button type="submit" disabled={submitting} style={{ ...btn(true), padding: "12px", marginTop: 4 }}>
            {submitting ? "Envoi en cours…" : "Confirmer le rendez-vous"}
          </button>
        </form>
      )}
    </div>
  );
}
