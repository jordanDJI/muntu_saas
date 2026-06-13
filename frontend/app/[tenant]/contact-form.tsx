"use client";
import { useState, useEffect, useRef } from "react";

const _API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function _track(slug: string, type: string, section?: string, data?: object) {
  try {
    const sid = sessionStorage.getItem("_pp_sid") ?? "unknown";
    fetch(`${_API}/api/v1/analytics/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_slug: slug, session_id: sid, event_type: type, section: section ?? null, data: data ?? null }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

type Slot = { start: string; end: string; label: string; spots_left?: number; capacity?: number };
type Mode = "contact" | "appointment";

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_FR = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ── Mini calendrier ───────────────────────────────────────────────────────────

function MiniCalendar({
  selected,
  onSelect,
  accentColor,
  tenantSlug,
}: {
  selected: Date | null;
  onSelect: (d: Date) => void;
  accentColor: string;
  tenantSlug: string;
}) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [month, setMonth] = useState<Date>(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [availDays, setAvailDays] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch(`${apiUrl}/api/v1/booking/${tenantSlug}/available-days?year=${month.getFullYear()}&month=${month.getMonth() + 1}`)
      .then(r => r.json())
      .then((days: number[]) => setAvailDays(new Set(days)))
      .catch(() => setAvailDays(new Set()));
  }, [month]);

  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const startSun = new Date(firstDay);
  startSun.setDate(firstDay.getDate() - firstDay.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(startSun, i));

  const prevMonth = () => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  return (
    <div className="bg-white rounded-xl border p-3 select-none">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500 text-sm">◀</button>
        <span className="text-sm font-semibold text-gray-700">
          {MONTHS_FR[month.getMonth()]} {month.getFullYear()}
        </span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500 text-sm">▶</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_FR.map((d) => (
          <div key={d} className="text-center text-xs text-gray-400 font-medium py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d, i) => {
          const inMonth   = d.getMonth() === month.getMonth();
          const isPast    = d < today;
          const hasSlots  = inMonth && availDays.has(d.getDate());
          const isDisabled = !inMonth || isPast || !hasSlots;
          const isSel     = selected && isSameDay(d, selected);
          const isToday   = isSameDay(d, today);
          return (
            <button
              key={i}
              disabled={isDisabled}
              onClick={() => onSelect(d)}
              className={`text-xs rounded-full w-7 h-7 mx-auto flex items-center justify-center transition-colors
                ${isDisabled ? "text-gray-300 cursor-default" : "hover:bg-gray-100 cursor-pointer"}
                ${isSel ? "text-white font-bold" : isToday && inMonth ? "font-bold" : ""}
              `}
              style={isSel ? { backgroundColor: accentColor } : isToday && inMonth && !isSel ? { color: accentColor } : {}}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Grille de créneaux ────────────────────────────────────────────────────────

function SlotGrid({
  slots,
  selected,
  onSelect,
  accentColor,
  loading,
}: {
  slots: Slot[];
  selected: Slot | null;
  onSelect: (s: Slot) => void;
  accentColor: string;
  loading: boolean;
}) {
  if (loading) return <p className="text-sm text-gray-400 text-center py-4">Chargement des créneaux…</p>;
  if (slots.length === 0) return <p className="text-sm text-gray-400 text-center py-4">Aucun créneau disponible ce jour.</p>;
  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map((s) => {
        const isSel = selected?.start === s.start;
        return (
          <button
            key={s.start}
            onClick={() => onSelect(s)}
            className="py-2 rounded-lg text-sm font-medium border transition-colors flex flex-col items-center"
            style={
              isSel
                ? { backgroundColor: accentColor, color: "#fff", borderColor: accentColor }
                : { backgroundColor: "#f9fafb", color: "#374151", borderColor: "#e5e7eb" }
            }
          >
            <span>{s.label}</span>
            {s.spots_left !== undefined && s.capacity && s.capacity > 1 && (
              <span className="text-xs opacity-70">{s.spots_left} pl.</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Formulaire contact ────────────────────────────────────────────────────────

type ContactType = "individual" | "company";

type ContactFields = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  message: string;
  service_offer_id: string;
  contact_type: ContactType;
};

function ContactFields({
  fields,
  onChange,
  offers,
  mode,
}: {
  fields: ContactFields;
  onChange: (f: Partial<ContactFields>) => void;
  offers: { id: string; name: string }[];
  mode: Mode;
}) {
  const isCompany = fields.contact_type === "company";
  return (
    <div className="space-y-3">
      {/* Type toggle */}
      <div className="flex rounded-lg border overflow-hidden text-sm">
        <button type="button"
          onClick={() => onChange({ contact_type: "individual" })}
          className={`flex-1 py-2 font-medium transition-colors ${!isCompany ? "bg-gray-800 text-white" : "text-gray-600 hover:bg-gray-50"}`}
        >
          Particulier
        </button>
        <button type="button"
          onClick={() => onChange({ contact_type: "company" })}
          className={`flex-1 py-2 font-medium transition-colors ${isCompany ? "bg-gray-800 text-white" : "text-gray-600 hover:bg-gray-50"}`}
        >
          Entreprise
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder={isCompany ? "Nom de l'entreprise *" : "Prénom *"}
          required
          value={fields.first_name}
          onChange={(e) => onChange({ first_name: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm w-full"
        />
        <input
          placeholder={isCompany ? "Contact (prénom nom)" : "Nom *"}
          required={!isCompany}
          value={fields.last_name}
          onChange={(e) => onChange({ last_name: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm w-full"
        />
      </div>
      <input
        type="email"
        placeholder="Email *"
        required
        value={fields.email}
        onChange={(e) => onChange({ email: e.target.value })}
        className="border rounded-lg px-3 py-2 text-sm w-full"
      />
      <input
        type="tel"
        placeholder="Téléphone"
        value={fields.phone}
        onChange={(e) => onChange({ phone: e.target.value })}
        className="border rounded-lg px-3 py-2 text-sm w-full"
      />
      {mode === "appointment" && offers.length > 0 && (
        <select
          value={fields.service_offer_id}
          onChange={(e) => onChange({ service_offer_id: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm w-full text-gray-700"
        >
          <option value="">Prestation (optionnel)</option>
          {offers.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      )}
      <textarea
        placeholder={mode === "appointment" ? "Message / motif du rendez-vous (optionnel)" : "Objet de votre demande *"}
        required={mode === "contact"}
        rows={3}
        value={fields.message}
        onChange={(e) => onChange({ message: e.target.value })}
        className="border rounded-lg px-3 py-2 text-sm w-full resize-y min-h-[80px]"
      />
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

type SectorVocabMini = {
  booking_cta?: string;
  show_party_size?: boolean;
  party_size_label?: string | null;
  party_size_hint?: string | null;
};

export default function ContactForm({
  tenantSlug,
  accentColor = "#4f46e5",
  offers = [],
  vocab,
}: {
  tenantSlug: string;
  accentColor?: string;
  offers?: { id: string; name: string }[];
  vocab?: SectorVocabMini;
}) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const bookingCta = vocab?.booking_cta ?? "Prendre rendez-vous";
  const showPartySize = vocab?.show_party_size ?? false;
  const partySizeLabel = vocab?.party_size_label ?? "Nombre de personnes";
  const partySizeHint = vocab?.party_size_hint ?? null;

  const [mode, setMode] = useState<Mode>("contact");
  const [step, setStep] = useState<"date" | "slot" | "form">("date");
  const [partySize, setPartySize] = useState(1);

  useEffect(() => {
    if (window.location.hash === "#rdv") {
      setMode("appointment");
    }
  }, []);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [fields, setFields] = useState<ContactFields>({
    first_name: "", last_name: "", email: "", phone: "", message: "", service_offer_id: "", contact_type: "individual",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const openFired = useRef(false);

  const trackOpen = () => {
    if (openFired.current) return;
    openFired.current = true;
    _track(tenantSlug, "form_open", "contact");
  };

  const handleDateSelect = async (d: Date) => {
    setSelectedDate(d);
    setSelectedSlot(null);
    setSlots([]);
    setSlotsLoading(true);
    setStep("slot");
    try {
      const res = await fetch(`${apiUrl}/api/v1/booking/${tenantSlug}/slots?date=${toDateStr(d)}`);
      const data = await res.json();
      setSlots(Array.isArray(data) ? data : []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleSlotSelect = (s: Slot) => {
    setSelectedSlot(s);
    setStep("form");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      let url: string;
      let body: any;

      if (mode === "contact") {
        url = `${apiUrl}/api/v1/leads/public/${tenantSlug}`;
        body = {
          first_name: fields.first_name,
          last_name: fields.last_name,
          email: fields.email,
          phone: fields.phone || undefined,
          message: fields.message,
          source: "website",
          audience_type: fields.contact_type === "company" ? "b2b" : "b2c",
          request_type: "contact",
          contact_type: fields.contact_type,
        };
      } else {
        url = `${apiUrl}/api/v1/booking/${tenantSlug}/book`;
        body = {
          first_name: fields.first_name,
          last_name: fields.last_name,
          email: fields.email,
          phone: fields.phone || undefined,
          message: fields.message,
          service_offer_id: fields.service_offer_id || undefined,
          request_type: "appointment",
          scheduled_at: selectedSlot!.start,
          slot_duration_min: Math.round(
            (new Date(selectedSlot!.end).getTime() - new Date(selectedSlot!.start).getTime()) / 60000
          ),
          contact_type: fields.contact_type,
          party_size: showPartySize ? partySize : 1,
        };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Erreur lors de l'envoi");
      }
      setSubmitted(true);
      _track(tenantSlug, "form_submit", "contact", { mode });
    } catch (err: any) {
      setError(err.message ?? "Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-3">✓</div>
        <p className="font-semibold text-lg" style={{ color: accentColor }}>
          {mode === "appointment" ? `${bookingCta} — Demande reçue !` : "Message envoyé !"}
        </p>
        <p className="text-gray-500 mt-2 text-sm">
          {mode === "appointment"
            ? showPartySize
              ? `Votre réservation pour ${partySize} personne(s) a bien été transmise. Vous recevrez une confirmation par email.`
              : "Vous recevrez une confirmation par email avec les détails."
            : "Nous vous recontacterons très prochainement."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toggle mode */}
      <div className="flex rounded-xl border overflow-hidden">
        <button
          onClick={() => { setMode("contact"); setStep("date"); trackOpen(); }}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === "contact" ? "text-white" : "text-gray-600 hover:bg-gray-50"}`}
          style={mode === "contact" ? { backgroundColor: accentColor } : {}}
        >
          Envoyer un message
        </button>
        <button
          onClick={() => { setMode("appointment"); setStep("date"); trackOpen(); }}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === "appointment" ? "text-white" : "text-gray-600 hover:bg-gray-50"}`}
          style={mode === "appointment" ? { backgroundColor: accentColor } : {}}
        >
          {bookingCta}
        </button>
      </div>

      {/* Mode contact simple */}
      {mode === "contact" && (
        <form onSubmit={handleSubmit} onFocus={trackOpen} data-track-form="contact" className="space-y-3">
          <ContactFields fields={fields} onChange={(f) => setFields((p) => ({ ...p, ...f }))} offers={[]} mode="contact" />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full text-white py-3 rounded-lg font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            {submitting ? "Envoi…" : "Envoyer ma demande"}
          </button>
        </form>
      )}

      {/* Mode rendez-vous — étapes */}
      {mode === "appointment" && (
        <div className="space-y-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <button
              onClick={() => setStep("date")}
              className={`font-medium ${step === "date" ? "text-gray-900" : "hover:underline"}`}
              style={step === "date" ? { color: accentColor } : {}}
            >
              1. Date
            </button>
            <span>›</span>
            <button
              onClick={() => step === "form" ? setStep("slot") : undefined}
              className={`font-medium ${step === "slot" ? "text-gray-900" : step === "form" ? "hover:underline" : "cursor-default"}`}
              style={step === "slot" ? { color: accentColor } : {}}
            >
              2. Créneau
            </button>
            <span>›</span>
            <span className={`font-medium ${step === "form" ? "text-gray-900" : "cursor-default"}`} style={step === "form" ? { color: accentColor } : {}}>
              3. Coordonnées
            </span>
          </div>

          {/* Party size — affiché si secteur 1:N (restaurant…) */}
          {showPartySize && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border">
              <label className="text-sm text-gray-600 flex-1">
                {partySizeLabel}
                {partySizeHint && <span className="block text-xs text-gray-400">{partySizeHint}</span>}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                  className="w-7 h-7 rounded-full border flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold"
                >−</button>
                <span className="w-6 text-center font-semibold text-gray-800">{partySize}</span>
                <button
                  type="button"
                  onClick={() => setPartySize((n) => Math.min(50, n + 1))}
                  className="w-7 h-7 rounded-full border flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold"
                >+</button>
              </div>
            </div>
          )}

          {/* Étape 1 — Calendrier */}
          {step === "date" && (
            <div>
              <p className="text-sm text-gray-600 mb-3">Choisissez une date :</p>
              <MiniCalendar selected={selectedDate} onSelect={handleDateSelect} accentColor={accentColor} tenantSlug={tenantSlug} />
            </div>
          )}

          {/* Étape 2 — Créneaux */}
          {step === "slot" && selectedDate && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setStep("date")} className="text-xs text-gray-400 hover:text-gray-600">← Date</button>
                <p className="text-sm font-medium text-gray-700">
                  {selectedDate.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
              <SlotGrid
                slots={slots}
                selected={selectedSlot}
                onSelect={handleSlotSelect}
                accentColor={accentColor}
                loading={slotsLoading}
              />
            </div>
          )}

          {/* Étape 3 — Formulaire */}
          {step === "form" && selectedSlot && (
            <form onSubmit={handleSubmit} onFocus={trackOpen} data-track-form="appointment" className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <button onClick={() => setStep("slot")} className="text-xs text-gray-400 hover:text-gray-600">← Créneaux</button>
                <p className="text-sm font-medium text-gray-700">
                  {selectedDate?.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
                  {" à "}
                  <span style={{ color: accentColor }}>{selectedSlot.label}</span>
                </p>
              </div>
              <ContactFields
                fields={fields}
                onChange={(f) => setFields((p) => ({ ...p, ...f }))}
                offers={offers}
                mode="appointment"
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full text-white py-3 rounded-lg font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: accentColor }}
              >
                {submitting ? "Confirmation…" : "Confirmer le rendez-vous"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
