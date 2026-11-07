"use client";
import { useState, useEffect, useRef } from "react";
import { sanitizePhoneInput } from "../../lib/phone";
import { FORM_T, FORM_LOCALE, serverErrorMessage, type FormLang, type FormStrings } from "./contact-form-i18n";

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

type Slot = { start: string; end: string; label: string; spots_left?: number; capacity?: number; max_party_size?: number };
type Mode = "contact" | "appointment";
type BookingQuestion = { id: string; label: string; type: "text" | "textarea" | "select"; options?: string[]; required: boolean };
type DepositCfg = { enabled: boolean; amount: number; currency: string; paypal_client_id: string; sandbox?: boolean };

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
  t,
}: {
  selected: Date | null;
  onSelect: (d: Date) => void;
  accentColor: string;
  tenantSlug: string;
  t: FormStrings;
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
          {t.months[month.getMonth()]} {month.getFullYear()}
        </span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500 text-sm">▶</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {t.days.map((d) => (
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
  t,
}: {
  slots: Slot[];
  selected: Slot | null;
  onSelect: (s: Slot) => void;
  accentColor: string;
  loading: boolean;
  t: FormStrings;
}) {
  if (loading) return <p className="text-sm text-gray-400 text-center py-4">{t.loadingSlots}</p>;
  if (slots.length === 0) return <p className="text-sm text-gray-400 text-center py-4">{t.noSlots}</p>;
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
              <span className="text-xs opacity-70">{s.spots_left} {t.spots}</span>
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
  t,
}: {
  fields: ContactFields;
  onChange: (f: Partial<ContactFields>) => void;
  offers: { id: string; name: string }[];
  mode: Mode;
  t: FormStrings;
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
          {t.individual}
        </button>
        <button type="button"
          onClick={() => onChange({ contact_type: "company" })}
          className={`flex-1 py-2 font-medium transition-colors ${isCompany ? "bg-gray-800 text-white" : "text-gray-600 hover:bg-gray-50"}`}
        >
          {t.company}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder={isCompany ? t.companyName : t.firstName}
          required
          value={fields.first_name}
          onChange={(e) => onChange({ first_name: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm w-full"
        />
        <input
          placeholder={isCompany ? t.contactPerson : t.lastName}
          required={!isCompany}
          value={fields.last_name}
          onChange={(e) => onChange({ last_name: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm w-full"
        />
      </div>
      <input
        type="email"
        placeholder={t.email}
        required
        value={fields.email}
        onChange={(e) => onChange({ email: e.target.value })}
        className="border rounded-lg px-3 py-2 text-sm w-full"
      />
      <input
        type="tel"
        inputMode="tel"
        placeholder={t.phone}
        value={fields.phone}
        onChange={(e) => onChange({ phone: sanitizePhoneInput(e.target.value) })}
        className="border rounded-lg px-3 py-2 text-sm w-full"
      />
      {mode === "appointment" && offers.length > 0 && (
        <select
          value={fields.service_offer_id}
          onChange={(e) => onChange({ service_offer_id: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm w-full text-gray-700"
        >
          <option value="">{t.serviceOptional}</option>
          {offers.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      )}
      <textarea
        placeholder={mode === "appointment" ? t.apptMessage : t.contactMessage}
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
  bookingQuestions = [],
  depositConfig,
  lang = "fr",
  fixedMode,
  integrationKey,
  track: trackEnabled = true,
}: {
  tenantSlug: string;
  accentColor?: string;
  offers?: { id: string; name: string }[];
  vocab?: SectorVocabMini;
  bookingQuestions?: BookingQuestion[];
  depositConfig?: DepositCfg;
  // Options des widgets embarqués (/embed/book, /embed/contact) — le site
  // Klientys n'en passe aucune et garde son comportement.
  lang?: FormLang;
  fixedMode?: Mode;               // un seul mode, sans bascule message / RDV
  integrationKey?: string | null; // support d'origine, joint à chaque envoi
  track?: boolean;                // false : pas d'événement dans les analytics du site Klientys
}) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const t = FORM_T[lang] ?? FORM_T.fr;
  const locale = FORM_LOCALE[lang] ?? FORM_LOCALE.fr;
  const bookingCta = vocab?.booking_cta ?? t.bookingCta;
  const partySizeLabel = vocab?.party_size_label ?? t.partySize;
  const partySizeHint = vocab?.party_size_hint ?? null;
  const track = (type: string, section?: string, data?: object) => { if (trackEnabled) _track(tenantSlug, type, section, data); };
  const integration = integrationKey ? { integration_key: integrationKey } : {};

  const depositEnabled = depositConfig?.enabled && depositConfig.paypal_client_id;
  const hasQuestions   = bookingQuestions.length > 0;

  const [mode, setMode] = useState<Mode>(fixedMode ?? "contact");
  const [step, setStep] = useState<"date" | "slot" | "form" | "payment">("date");
  const [partySize, setPartySize] = useState(1);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalError, setPaypalError] = useState("");
  const paypalRendered = useRef(false);
  const pendingPayload = useRef<any>(null);


  useEffect(() => {
    if (!fixedMode && window.location.hash === "#rdv") {
      setMode("appointment");
    }
  }, []);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Afficher le stepper groupe si le secteur l'active OU si le créneau sélectionné a max_party_size > 1
  const showPartySize = (vocab?.show_party_size ?? false) || (selectedSlot?.max_party_size ?? 1) > 1;
  const maxPartySize = selectedSlot?.max_party_size ?? 50;
  const [fields, setFields] = useState<ContactFields>({
    first_name: "", last_name: "", email: "", phone: "", message: "", service_offer_id: "", contact_type: "individual",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [consentChannels, setConsentChannels] = useState<string[]>([]);
  const toggleConsent = (channel: string) =>
    setConsentChannels(prev => prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]);
  const openFired = useRef(false);

  const trackOpen = () => {
    if (openFired.current) return;
    openFired.current = true;
    track("form_open", "contact");
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

  const _buildApptBody = () => ({
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
    party_size: partySize,
    custom_answers: customAnswers,
    consent_channels: consentChannels,
    lang,
    ...integration,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate required questions
    for (const q of bookingQuestions) {
      if (q.required && !customAnswers[q.id]?.trim()) {
        setError(t.requiredQuestion(q.label));
        return;
      }
    }

    if (mode === "contact") {
      setSubmitting(true);
      try {
        const body = {
          first_name: fields.first_name,
          last_name: fields.last_name,
          email: fields.email,
          phone: fields.phone || undefined,
          message: fields.message,
          source: "website",
          audience_type: fields.contact_type === "company" ? "b2b" : "b2c",
          request_type: "contact",
          contact_type: fields.contact_type,
          consent_channels: consentChannels,
          ...integration,
        };
        const res = await fetch(`${apiUrl}/api/v1/leads/public/${tenantSlug}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(serverErrorMessage(t, err, t.error)); }
        setSubmitted(true);
        track("form_submit", "contact", { mode });
      } catch (err: any) { setError(err.message ?? t.error); }
      finally { setSubmitting(false); }
      return;
    }

    // Appointment + deposit → PayPal step
    if (depositEnabled) {
      pendingPayload.current = _buildApptBody();
      paypalRendered.current = false;
      setPaypalError("");
      setStep("payment");
      return;
    }

    // Appointment without deposit → direct submit
    setSubmitting(true);
    try {
      const body = _buildApptBody();
      const res = await fetch(`${apiUrl}/api/v1/booking/${tenantSlug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(serverErrorMessage(t, err, t.sendError)); }
      setSubmitted(true);
      track("form_submit", "contact", { mode });
    } catch (err: any) { setError(err.message ?? t.error); }
    finally { setSubmitting(false); }
  };

  // Load PayPal SDK + render buttons when entering payment step
  useEffect(() => {
    if (step !== "payment") return;

    const clientId = depositConfig?.paypal_client_id?.trim();
    const currency = depositConfig?.currency || "EUR";

    console.log("[PayPal] step=payment | clientId=", clientId ? clientId.slice(0, 8) + "…" : "VIDE/MANQUANT");

    if (!clientId) {
      setPaypalError(t.paypalNoClientId);
      return;
    }

    const renderButtons = () => {
      if (paypalRendered.current) return;
      paypalRendered.current = true;
      setPaypalReady(true);
      const w = window as any;
      w.paypal.Buttons({
        style: { layout: "vertical", color: "blue", shape: "rect", label: "pay" },
        createOrder: async () => {
          // Aucune donnée monétaire envoyée : le backend lit le montant et la
          // devise dans la config du tenant. Les transmettre depuis le client
          // permettait de régler un acompte de 0,01 €.
          const r = await fetch(`${apiUrl}/api/v1/booking/${tenantSlug}/paypal-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            throw new Error(serverErrorMessage(t, err, t.paypalOrderError));
          }
          return (await r.json()).order_id;
        },
        onApprove: async (data: any) => {
          setSubmitting(true); setPaypalError("");
          try {
            const body = { ...pendingPayload.current, paypal_order_id: data.orderID };
            const r = await fetch(`${apiUrl}/api/v1/booking/${tenantSlug}/paypal-capture`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(serverErrorMessage(t, e, t.paymentError)); }
            setSubmitted(true);
            track("form_submit", "contact", { mode: "appointment", deposit: "paid" });
          } catch (e: any) { setPaypalError(e.message ?? t.paymentIncomplete); }
          finally { setSubmitting(false); }
        },
        onError: (err: any) => { console.error("[PayPal] button error:", err); setPaypalError(t.paypalError); },
        onCancel: () => setPaypalError(t.paymentCancelled),
      }).render("#paypal-buttons");
    };

    // SDK already loaded
    if ((window as any).paypal) {
      console.log("[PayPal] SDK déjà présent, rendu des boutons…");
      renderButtons();
      return;
    }

    // Script already in DOM (e.g. re-render) — wait for it
    const existing = document.querySelector('script[src*="paypal.com/sdk"]') as HTMLScriptElement | null;
    if (existing) {
      console.log("[PayPal] script déjà dans le DOM, attente du load…");
      existing.addEventListener("load", renderButtons);
      existing.addEventListener("error", () => setPaypalError(t.paypalLoadError));
      return;
    }

    // Inject SDK
    console.log("[PayPal] injection du script SDK…");
    const script = document.createElement("script");
    // Le SDK doit viser le même environnement que le backend : avec
    // deposit.sandbox activé, charger le SDK de production affichait des
    // boutons inutilisables (client ID sandbox sur l'endpoint live).
    const sdkHost = depositConfig?.sandbox ? "https://www.sandbox.paypal.com" : "https://www.paypal.com";
    script.src = `${sdkHost}/sdk/js?client-id=${clientId}&currency=${currency}&intent=capture`;
    script.onload = () => { console.log("[PayPal] SDK chargé !"); renderButtons(); };
    script.onerror = () => setPaypalError(t.paypalModuleError);
    document.head.appendChild(script);
  }, [step]);

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-3">✓</div>
        <p className="font-semibold text-lg" style={{ color: accentColor }}>
          {mode === "appointment" ? t.apptDone(bookingCta) : t.msgDone}
        </p>
        <p className="text-gray-500 mt-2 text-sm">
          {mode === "appointment"
            ? showPartySize
              ? t.partyDone(partySize)
              : t.apptDoneText
            : t.msgDoneText}
        </p>
      </div>
    );
  }

  const consentBlock = (
    <div className="space-y-1.5 pt-1">
      <p className="text-xs text-gray-500">{t.consent}</p>
      {[["email", t.consentEmail], ["telephone", t.consentPhone]].map(([key, label]) => (
        <label key={key} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={consentChannels.includes(key)} onChange={() => toggleConsent(key)}
            className="rounded accent-current" style={{ accentColor }} />
          {label}
        </label>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Toggle mode — absent quand le widget impose un mode */}
      {!fixedMode && (
        <div className="flex rounded-xl border overflow-hidden">
          <button
            onClick={() => { setMode("contact"); setStep("date"); trackOpen(); }}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === "contact" ? "text-white" : "text-gray-600 hover:bg-gray-50"}`}
            style={mode === "contact" ? { backgroundColor: accentColor } : {}}
          >
            {t.sendMessage}
          </button>
          <button
            onClick={() => { setMode("appointment"); setStep("date"); trackOpen(); }}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === "appointment" ? "text-white" : "text-gray-600 hover:bg-gray-50"}`}
            style={mode === "appointment" ? { backgroundColor: accentColor } : {}}
          >
            {bookingCta}
          </button>
        </div>
      )}

      {/* Mode contact simple */}
      {mode === "contact" && (
        <form onSubmit={handleSubmit} onFocus={trackOpen} data-track-form="contact" className="space-y-3">
          <ContactFields fields={fields} onChange={(f) => setFields((p) => ({ ...p, ...f }))} offers={[]} mode="contact" t={t} />
          {consentBlock}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full text-white py-3 rounded-lg font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            {submitting ? t.sending : t.sendRequest}
          </button>
        </form>
      )}

      {/* Mode rendez-vous — étapes */}
      {mode === "appointment" && (
        <div className="space-y-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
            <button onClick={() => setStep("date")}
              className={`font-medium ${step === "date" ? "text-gray-900" : "hover:underline"}`}
              style={step === "date" ? { color: accentColor } : {}}>
              {t.stepDate}
            </button>
            <span>›</span>
            <button onClick={() => (step === "form" || step === "payment") ? setStep("slot") : undefined}
              className={`font-medium ${step === "slot" ? "text-gray-900" : (step === "form" || step === "payment") ? "hover:underline" : "cursor-default"}`}
              style={step === "slot" ? { color: accentColor } : {}}>
              {t.stepSlot}
            </button>
            <span>›</span>
            <button onClick={() => step === "payment" ? setStep("form") : undefined}
              className={`font-medium ${step === "form" ? "text-gray-900" : step === "payment" ? "hover:underline" : "cursor-default"}`}
              style={step === "form" ? { color: accentColor } : {}}>
              {t.stepForm}
            </button>
            {depositEnabled && (
              <>
                <span>›</span>
                <span className={`font-medium ${step === "payment" ? "text-gray-900" : "cursor-default"}`}
                  style={step === "payment" ? { color: accentColor } : {}}>
                  {t.stepPay}
                </span>
              </>
            )}
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
                  onClick={() => setPartySize((n) => Math.min(maxPartySize, n + 1))}
                  className="w-7 h-7 rounded-full border flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold"
                >+</button>
              </div>
            </div>
          )}

          {/* Étape 1 — Calendrier */}
          {step === "date" && (
            <div>
              <p className="text-sm text-gray-600 mb-3">{t.chooseDate}</p>
              <MiniCalendar selected={selectedDate} onSelect={handleDateSelect} accentColor={accentColor} tenantSlug={tenantSlug} t={t} />
            </div>
          )}

          {/* Étape 2 — Créneaux */}
          {step === "slot" && selectedDate && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setStep("date")} className="text-xs text-gray-400 hover:text-gray-600">{t.backDate}</button>
                <p className="text-sm font-medium text-gray-700">
                  {selectedDate.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
              <SlotGrid
                slots={slots}
                selected={selectedSlot}
                onSelect={handleSlotSelect}
                accentColor={accentColor}
                loading={slotsLoading}
                t={t}
              />
            </div>
          )}

          {/* Étape 3 — Formulaire + questions personnalisées */}
          {step === "form" && selectedSlot && (
            <form onSubmit={handleSubmit} onFocus={trackOpen} data-track-form="appointment" className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <button type="button" onClick={() => setStep("slot")} className="text-xs text-gray-400 hover:text-gray-600">{t.backSlots}</button>
                <p className="text-sm font-medium text-gray-700">
                  {selectedDate?.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                  {t.at}
                  <span style={{ color: accentColor }}>{selectedSlot.label}</span>
                </p>
              </div>
              <ContactFields
                fields={fields}
                onChange={(f) => setFields((p) => ({ ...p, ...f }))}
                offers={offers}
                mode="appointment"
                t={t}
              />

              {/* Questions personnalisées */}
              {hasQuestions && (
                <div className="space-y-3 pt-2 border-t">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.questions}</p>
                  {bookingQuestions.map(q => (
                    <div key={q.id}>
                      <label className="block text-sm text-gray-700 mb-1">
                        {q.label}{q.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      {q.type === "textarea" ? (
                        <textarea
                          value={customAnswers[q.id] ?? ""}
                          onChange={e => setCustomAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                          rows={3}
                          className="w-full border rounded-lg px-3 py-2 text-sm resize-y"
                          required={q.required}
                        />
                      ) : q.type === "select" ? (
                        <select
                          value={customAnswers[q.id] ?? ""}
                          onChange={e => setCustomAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                          className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                          required={q.required}
                        >
                          <option value="">{t.select}</option>
                          {(q.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={customAnswers[q.id] ?? ""}
                          onChange={e => setCustomAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                          className="w-full border rounded-lg px-3 py-2 text-sm"
                          required={q.required}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {consentBlock}

              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full text-white py-3 rounded-lg font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: accentColor }}
              >
                {submitting
                  ? t.confirming
                  : depositEnabled
                  ? t.toPayment
                  : t.confirm}
              </button>
            </form>
          )}

          {/* Étape 4 — Paiement PayPal */}
          {step === "payment" && depositConfig && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <button type="button" onClick={() => { setStep("form"); paypalRendered.current = false; }}
                  className="text-xs text-gray-400 hover:text-gray-600">{t.backForm}</button>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <p className="text-sm font-semibold text-gray-800">{t.depositRequired}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: accentColor }}>
                  {depositConfig.amount} {depositConfig.currency}
                </p>
                <p className="text-xs text-gray-500 mt-1">{t.depositNote}</p>
              </div>
              {paypalError && <p className="text-red-500 text-sm text-center">{paypalError}</p>}
              {submitting && <p className="text-sm text-gray-500 text-center">{t.validatingPayment}</p>}
              <div id="paypal-buttons" />
              {!paypalReady && !paypalError && (
                <p className="text-xs text-gray-400 text-center animate-pulse">{t.loadingPaypal}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
