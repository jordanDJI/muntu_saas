"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useSectorVocab } from "../../../lib/useSectorVocab";

// ── Types ─────────────────────────────────────────────────────────────────────

type Appointment = {
  id: string;
  status: string;
  scheduled_at: string;
  end_at: string;
  service_offer_id?: string;
  contact_id?: string;
  notes?: string;
  party_size?: number;
  contact?: { first_name: string; last_name: string; email: string; phone?: string };
  service_offer?: { name: string };
};

type AvailSlot = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_min: number;
  is_active: boolean;
  capacity?: number;
  max_party_size?: number;
};

type BlockedPeriod = { id: string; start_at: string; end_at: string; reason?: string; color?: string };
type Contact = { id: string; first_name: string; last_name: string; email: string; phone?: string };
type NewClientData = { first_name: string; last_name: string; email?: string; phone?: string; source?: string };
type View = "week" | "month" | "day";

// ── Constants ─────────────────────────────────────────────────────────────────

const HOUR_START = 7;
const HOUR_END   = 20;
const SLOT_H     = 64;
const STATUS_COLOR: Record<string, string> = {
  confirmed: "bg-primary-600 text-white",
  cancelled: "bg-gray-500 text-white opacity-50",
  pending:   "bg-accent-400 text-white",
};

function getSources(t: any) {
  return [
    t.apt_source_word_of_mouth,
    t.apt_source_google,
    t.apt_source_social,
    t.apt_source_website,
    t.apt_source_referral,
    t.apt_source_flyer,
    t.apt_source_other,
  ];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const startOfWeek = (d: Date) => {
  const r = new Date(d); r.setHours(0,0,0,0);
  const off = r.getDay() === 0 ? -6 : 1 - r.getDay();
  r.setDate(r.getDate() + off); return r;
};
const addDays   = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate()+n); return r; };
const isSameDay = (a: Date, b: Date)   => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
const fmtTime   = (iso: string)        => new Date(iso).toLocaleTimeString("fr-BE",{hour:"2-digit",minute:"2-digit"});
const fmtDate   = (d: Date)            => d.toLocaleDateString("fr-BE",{day:"numeric",month:"short"});
const hhmm      = (h: number, m: number) => `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
const topPx     = (iso: string) => { const d=new Date(iso); return (d.getHours()+d.getMinutes()/60-HOUR_START)*SLOT_H; };
const heightPx  = (s: string, e: string) => Math.max(((new Date(e).getTime()-new Date(s).getTime())/3600000)*SLOT_H, 24);
// Sends local time as naive ISO (no UTC shift) — appointment table uses TIMESTAMP (no tz)
const toLocalISO = (d: Date) => { const p=(n:number)=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`; };

// ── ContactSearch ─────────────────────────────────────────────────────────────

function ContactSearch({ onSelect, onCreateNew }: {
  onSelect: (c: Contact) => void;
  onCreateNew: (name: string) => void;
}) {
  const { t } = useLanguage();
  const [q, setQ]             = useState("");
  const [results, setResults] = useState<Contact[]>([]);
  const [open, setOpen]       = useState(false);
  const timer = useRef<any>(null);

  const search = (val: string) => {
    setQ(val); clearTimeout(timer.current);
    if (val.length < 2) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      const r = await api.searchContacts(val);
      setResults(r); setOpen(true);
    }, 280);
  };

  return (
    <div className="relative">
      <input
        placeholder={t.apt_search_contact}
        value={q}
        onChange={e => search(e.target.value)}
        onFocus={() => q.length >= 2 && setOpen(true)}
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg z-20 max-h-40 overflow-auto">
          {results.map(c => (
            <button key={c.id}
              onClick={() => { setQ(`${c.first_name} ${c.last_name}`); setOpen(false); onSelect(c); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 border-b last:border-0">
              <span className="font-medium">{c.first_name} {c.last_name}</span>
              {c.email && <span className="text-gray-400 ml-2 text-xs">{c.email}</span>}
            </button>
          ))}
        </div>
      )}
      {q.length >= 2 && results.length === 0 && (
        <button
          onClick={() => { setOpen(false); onCreateNew(q); }}
          className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 z-20 text-left">
          {t.apt_new_contact_q} "{q}"
        </button>
      )}
    </div>
  );
}

// ── NewClientModal ────────────────────────────────────────────────────────────

function NewClientModal({ initialName, onConfirm, onClose }: {
  initialName: string;
  onConfirm: (data: NewClientData) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { vocab } = useSectorVocab();
  const parts = initialName.trim().split(" ");
  const [fn, setFn]         = useState(parts[0] ?? "");
  const [ln, setLn]         = useState(parts.slice(1).join(" "));
  const [em, setEm]         = useState("");
  const [ph, setPh]         = useState("");
  const [source, setSource] = useState("");
  const SOURCES = getSources(t);

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b">
          <h3 className="font-bold text-base">{t.apt_new_contact}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>
        <div className="p-5 space-y-3">
          {/* Explication */}
          <div className="flex gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
            <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p className="text-xs text-blue-700 leading-relaxed">{t.new_client_explain}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-600">{t.apt_first_name}</label>
              <input value={fn} onChange={e => setFn(e.target.value)} placeholder="Marie"
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"/>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">{t.apt_last_name}</label>
              <input value={ln} onChange={e => setLn(e.target.value)} placeholder="Dupont"
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"/>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Email</label>
            <input type="email" value={em} onChange={e => setEm(e.target.value)}
              placeholder="marie@exemple.com"
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"/>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">{t.apt_phone}</label>
            <input type="tel" value={ph} onChange={e => setPh(e.target.value)}
              placeholder="+32 4xx xxx xxx"
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"/>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">{t.apt_channel}</label>
            <select value={source} onChange={e => setSource(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1 text-gray-700 bg-white">
              <option value="">{t.apt_channel_ph}</option>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="px-5 pb-5">
          <button
            onClick={() => fn.trim() && onConfirm({
              first_name: fn.trim(),
              last_name:  ln.trim() || "-",
              email:  em  || undefined,
              phone:  ph  || undefined,
              source: source || undefined,
            })}
            disabled={!fn.trim()}
            className="w-full bg-primary-600 text-white rounded-xl py-2.5 font-semibold hover:bg-primary-700 disabled:opacity-50 text-sm">
            Ajouter ce {vocab.contact.toLowerCase()} à {vocab.appointment.toLowerCase()}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NewApptCard (modal centrée) ───────────────────────────────────────────────

function NewApptCard({ day, startH, startM, durationMin, offers, onSave, onClose }: {
  day: Date; startH: number; startM: number; durationMin: number;
  offers: { id: string; name: string }[];
  onSave: () => void; onClose: () => void;
}) {
  const { t } = useLanguage();
  const { vocab } = useSectorVocab();
  const [dur, setDur]               = useState(durationMin);
  const [serviceId, setService]     = useState("");
  const [contact, setContact]       = useState<Contact | null>(null);
  const [newClient, setNewClient]   = useState<NewClientData | null>(null);
  const [showNewClient, setShowNew] = useState(false);
  const [newClientName, setNewName] = useState("");
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState("");

  const endTime = () => {
    const e = new Date(); e.setHours(startH, startM + dur, 0, 0);
    return hhmm(e.getHours(), e.getMinutes());
  };

  const clientLabel = contact
    ? `${contact.first_name} ${contact.last_name}`
    : newClient ? `${newClient.first_name} ${newClient.last_name} (nouveau)` : null;

  const save = async () => {
    if (!contact && !newClient) { setErr("Sélectionner ou créer un contact"); return; }
    setSaving(true); setErr("");
    try {
      const base = new Date(day); base.setHours(startH, startM, 0, 0);
      const end  = new Date(base.getTime() + dur * 60000);
      const body: any = {
        scheduled_at: toLocalISO(base),
        end_at: toLocalISO(end),
        service_offer_id: serviceId || undefined,
      };
      if (contact) {
        body.contact_id = contact.id;
      } else if (newClient) {
        body.first_name = newClient.first_name;
        body.last_name  = newClient.last_name;
        body.email      = newClient.email;
        body.phone      = newClient.phone;
        body.source     = newClient.source;
      }
      await api.createCalendarAppointment(body);
      onSave();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="bg-primary-600 text-white rounded-t-2xl px-4 py-3 flex justify-between items-start">
            <div>
              <p className="text-xs opacity-75 capitalize">
                {day.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <p className="font-semibold text-lg">{hhmm(startH, startM)} – {endTime()}</p>
            </div>
            <button onClick={onClose} className="hover:opacity-70 text-xl mt-0.5 leading-none">✕</button>
          </div>
          {/* Body */}
          <div className="p-4 space-y-3">
            {/* Explication */}
            <div className="flex gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
              <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p className="text-xs text-blue-700 leading-relaxed">{t.new_appt_explain}</p>
            </div>
            {clientLabel ? (
              <div className="flex items-center justify-between border rounded-lg px-3 py-2.5 bg-primary-50">
                <span className="text-sm font-medium text-primary-800">{clientLabel}</span>
                <button onClick={() => { setContact(null); setNewClient(null); }}
                  className="text-xs text-gray-400 hover:text-red-500 ml-2">✕</button>
              </div>
            ) : (
              <ContactSearch
                onSelect={c => setContact(c)}
                onCreateNew={name => { setNewName(name); setShowNew(true); }}
              />
            )}
            {offers.length > 0 && (
              <select value={serviceId} onChange={e => setService(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700 bg-white">
                <option value="">Prestation (optionnel)</option>
                {offers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            )}
            <select value={dur} onChange={e => setDur(Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
              {[15,30,45,60,90,120].map(d => (
                <option key={d} value={d}>{d < 60 ? `${d} min` : `${d/60}h`}</option>
              ))}
            </select>
            {err && <p className="text-red-500 text-sm">{err}</p>}
            <button onClick={save} disabled={saving || (!contact && !newClient)}
              className="w-full bg-primary-600 text-white rounded-xl py-2.5 font-semibold hover:bg-primary-700 disabled:opacity-50 text-sm">
              {saving ? "Création…" : `Créer ${vocab.appointment.toLowerCase()}`}
            </button>
          </div>
        </div>
      </div>

      {showNewClient && (
        <NewClientModal
          initialName={newClientName}
          onConfirm={data => { setNewClient(data); setShowNew(false); }}
          onClose={() => setShowNew(false)}
        />
      )}
    </>
  );
}

// ── AvailabilityPanel ─────────────────────────────────────────────────────────

type TimeRange = { start_time: string; end_time: string; slot_duration_min: number };
type DaySlots  = { day_of_week: number; is_active: boolean; ranges: TimeRange[]; capacity: number; max_party_size: number };

const DEFAULT_RANGE: TimeRange = { start_time: "09:00", end_time: "18:00", slot_duration_min: 30 };

function AvailabilityPanel({ availability, onSave, onClose }: {
  availability: AvailSlot[]; onSave: () => void; onClose: () => void;
}) {
  const { t } = useLanguage();
  const DAYS_FR   = t.apt_days_short as string[];
  const DAYS_FULL = t.apt_days_full as string[];

  const [days, setDays] = useState<DaySlots[]>(() =>
    DAYS_FR.map((_, i) => {
      const daySlots = availability.filter(s => s.day_of_week === i);
      if (daySlots.length > 0) {
        return {
          day_of_week: i,
          is_active: true,
          capacity: daySlots[0].capacity ?? 1,
          max_party_size: daySlots[0].max_party_size ?? 1,
          ranges: daySlots.map(s => ({ start_time: s.start_time, end_time: s.end_time, slot_duration_min: s.slot_duration_min })),
        };
      }
      return { day_of_week: i, is_active: false, capacity: 1, max_party_size: 1, ranges: [{ ...DEFAULT_RANGE }] };
    })
  );
  const [saving, setSaving] = useState(false);

  const toggleDay = (i: number) =>
    setDays(p => p.map((d, idx) => idx === i ? { ...d, is_active: !d.is_active } : d));

  const updRange = (di: number, ri: number, patch: Partial<TimeRange>) =>
    setDays(p => p.map((d, idx) => idx !== di ? d : {
      ...d,
      ranges: d.ranges.map((r, ridx) => ridx === ri ? { ...r, ...patch } : r),
    }));

  const addRange = (di: number) =>
    setDays(p => p.map((d, idx) => idx !== di ? d : {
      ...d,
      ranges: [...d.ranges, { start_time: "14:00", end_time: "18:00", slot_duration_min: d.ranges[0]?.slot_duration_min ?? 30 }],
    }));

  const removeRange = (di: number, ri: number) =>
    setDays(p => p.map((d, idx) => idx !== di ? d : { ...d, ranges: d.ranges.filter((_, ridx) => ridx !== ri) }));

  const save = async () => {
    setSaving(true);
    try {
      const flat: AvailSlot[] = days
        .filter(d => d.is_active && d.ranges.length > 0)
        .flatMap(d => d.ranges.map(r => ({ day_of_week: d.day_of_week, is_active: true, capacity: d.capacity, max_party_size: d.max_party_size, ...r })));
      await api.replaceAvailability(flat);
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">{t.apt_availability_title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {days.map((d, di) => (
            <div key={di} className={`rounded-lg border p-3 space-y-2 ${d.is_active ? "border-primary-300 bg-primary-50" : "border-gray-200"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{DAYS_FULL[di]}</span>
                <div className="flex items-center gap-3">
                  {d.is_active && (
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-gray-500" title="Nombre de réservations simultanées sur ce créneau">
                        <span className="whitespace-nowrap">{t.apt_slots_simultaneous}</span>
                        <input
                          type="number" min={1} max={500}
                          value={d.capacity}
                          onChange={e => setDays(p => p.map((day, idx) => idx === di ? { ...day, capacity: Math.max(1, Number(e.target.value) || 1) } : day))}
                          className="border rounded px-1.5 py-0.5 text-xs w-12 text-center"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-gray-500" title="Nombre max de personnes par réservation (1 = solo)">
                        <span className="whitespace-nowrap">{t.apt_max_persons}</span>
                        <input
                          type="number" min={1} max={500}
                          value={d.max_party_size}
                          onChange={e => setDays(p => p.map((day, idx) => idx === di ? { ...day, max_party_size: Math.max(1, Number(e.target.value) || 1) } : day))}
                          className="border rounded px-1.5 py-0.5 text-xs w-12 text-center"
                        />
                      </label>
                    </div>
                  )}
                  <button onClick={() => toggleDay(di)}
                    className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${d.is_active ? "bg-primary-600" : "bg-gray-300"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${d.is_active ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>
              </div>

              {d.is_active && d.ranges.map((r, ri) => (
                <div key={ri} className="flex gap-2 items-center flex-wrap bg-white rounded-lg px-2 py-1.5 border border-primary-100">
                  {ri === 0
                    ? <span className="text-xs text-gray-400 w-12 shrink-0">{t.apt_morning}</span>
                    : ri === 1
                    ? <span className="text-xs text-gray-400 w-12 shrink-0">{t.apt_afternoon}</span>
                    : <span className="text-xs text-gray-400 w-12 shrink-0">{t.apt_range.replace("{n}", String(ri + 1))}</span>
                  }
                  <input type="time" value={r.start_time} onChange={e => updRange(di, ri, { start_time: e.target.value })}
                    className="border rounded px-2 py-1 text-sm flex-1 min-w-[80px]" />
                  <span className="text-gray-400 text-xs">→</span>
                  <input type="time" value={r.end_time} onChange={e => updRange(di, ri, { end_time: e.target.value })}
                    className="border rounded px-2 py-1 text-sm flex-1 min-w-[80px]" />
                  <select value={r.slot_duration_min} onChange={e => updRange(di, ri, { slot_duration_min: Number(e.target.value) })}
                    className="border rounded px-2 py-1 text-xs bg-white">
                    {[15,30,45,60,90].map(v => <option key={v} value={v}>{v < 60 ? `${v} min` : `${v/60}h`}</option>)}
                  </select>
                  {d.ranges.length > 1 && (
                    <button onClick={() => removeRange(di, ri)} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
                  )}
                </div>
              ))}

              {d.is_active && d.ranges.length < 3 && (
                <button onClick={() => addRange(di)}
                  className="text-xs text-primary-600 hover:text-primary-800 hover:underline pl-1">
                  {t.apt_add_range}
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="p-4 border-t">
          <button onClick={save} disabled={saving}
            className="w-full bg-primary-600 text-white py-2 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50">
            {saving ? t.apt_saving : t.apt_save}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── BlockPanel ────────────────────────────────────────────────────────────────

const BLOCK_COLORS = [
  { key: "#ef4444", label: "Rouge" },
  { key: "#f97316", label: "Orange" },
  { key: "#eab308", label: "Jaune" },
  { key: "#8b5cf6", label: "Violet" },
  { key: "#06b6d4", label: "Cyan" },
  { key: "#64748b", label: "Gris" },
];

function BlockPanel({ blocked, onSave, onClose }: {
  blocked: BlockedPeriod[]; onSave: () => void; onClose: () => void;
}) {
  const { t } = useLanguage();
  const [editTarget, setEditTarget] = useState<BlockedPeriod | null>(null);
  const [startAt, setStartAt]       = useState("");
  const [endAt, setEndAt]           = useState("");
  const [reason, setReason]         = useState("");
  const [color, setColor]           = useState(BLOCK_COLORS[0].key);
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState("");

  const startEdit = (b: BlockedPeriod) => {
    setEditTarget(b);
    // Format to datetime-local string: "YYYY-MM-DDThh:mm"
    const fmt = (iso: string) => {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2,"0");
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setStartAt(fmt(b.start_at));
    setEndAt(fmt(b.end_at));
    setReason(b.reason ?? "");
    setColor(b.color ?? BLOCK_COLORS[0].key);
    setErr("");
  };

  const resetForm = () => {
    setEditTarget(null); setStartAt(""); setEndAt("");
    setReason(""); setColor(BLOCK_COLORS[0].key); setErr("");
  };

  const save = async () => {
    if (!startAt || !endAt) return;
    if (!editTarget && new Date(startAt) < new Date()) { setErr("La date de début ne peut pas être dans le passé."); return; }
    if (new Date(endAt) <= new Date(startAt)) { setErr("La date de fin doit être après la date de début."); return; }
    setErr(""); setSaving(true);
    try {
      // datetime-local gives local time; TIMESTAMPTZ needs UTC
      const startUTC = new Date(startAt).toISOString();
      const endUTC   = new Date(endAt).toISOString();
      if (editTarget) {
        await api.updateBlocked(editTarget.id, { start_at: startUTC, end_at: endUTC, reason: reason || undefined, color });
      } else {
        await api.createBlocked({ start_at: startUTC, end_at: endUTC, reason: reason || undefined, color });
      }
      onSave(); resetForm();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur lors de l'enregistrement.");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">{t.apt_blocked_title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                {editTarget ? t.apt_blocked_edit : t.apt_blocked_add}
              </p>
              {editTarget && (
                <button onClick={resetForm} className="text-xs text-gray-400 hover:text-gray-600">
                  {t.apt_blocked_cancel_btn}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><label className="text-xs text-gray-500">{t.apt_blocked_start}</label>
                <input type="datetime-local" value={startAt} onChange={e=>{setStartAt(e.target.value);setErr("");}}
                  className="w-full border rounded px-2 py-1 text-sm mt-0.5"/></div>
              <div><label className="text-xs text-gray-500">{t.apt_blocked_end}</label>
                <input type="datetime-local" value={endAt} onChange={e=>{setEndAt(e.target.value);setErr("");}}
                  className="w-full border rounded px-2 py-1 text-sm mt-0.5"/></div>
            </div>
            <input type="text" placeholder={t.apt_blocked_reason} value={reason} onChange={e=>setReason(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"/>
            <div>
              <p className="text-xs text-gray-500 mb-1.5">{t.apt_blocked_color}</p>
              <div className="flex gap-2">
                {BLOCK_COLORS.map(c => (
                  <button key={c.key} type="button" title={c.label} onClick={() => setColor(c.key)}
                    className="w-6 h-6 rounded-full border-2 transition-all"
                    style={{ background: c.key, borderColor: color === c.key ? "#1e293b" : "transparent" }} />
                ))}
              </div>
            </div>
            {err && <p className="text-xs text-red-500">{err}</p>}
            <button onClick={save} disabled={saving||!startAt||!endAt}
              className="w-full text-white py-1.5 rounded font-medium text-sm disabled:opacity-50"
              style={{ background: color }}>
              {saving ? "…" : editTarget ? "Mettre à jour" : "Bloquer cette période"}
            </button>
          </div>
          <div className="space-y-2">
            {blocked.length===0 && <p className="text-sm text-gray-400">Aucune période bloquée.</p>}
            {blocked.map(b=>(
              <div key={b.id}
                className={`border rounded-lg p-3 flex justify-between items-start transition-colors ${editTarget?.id===b.id?"ring-2 ring-primary-400 bg-primary-50":""}`}
                style={{ borderLeftWidth: 4, borderLeftColor: b.color ?? "#ef4444" }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {new Date(b.start_at).toLocaleString("fr-BE",{dateStyle:"medium",timeStyle:"short"})}
                    {" → "}
                    {new Date(b.end_at).toLocaleString("fr-BE",{dateStyle:"medium",timeStyle:"short"})}
                  </p>
                  {b.reason && <p className="text-xs text-gray-400 mt-0.5">{b.reason}</p>}
                </div>
                <div className="flex gap-2 ml-2 shrink-0">
                  <button onClick={() => startEdit(b)}
                    title="Modifier"
                    className="text-primary-400 hover:text-primary-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </button>
                  <button onClick={() => api.deleteBlocked(b.id).then(onSave)}
                    title="Supprimer"
                    className="text-red-400 hover:text-red-600">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── BlockedOverrideModal ──────────────────────────────────────────────────────

function BlockedOverrideModal({ period, onConfirm, onClose }: {
  period: BlockedPeriod;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { vocab } = useSectorVocab();
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-base">{t.apt_blocked_bar}</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {period.reason ? `Motif : "${period.reason}"` : t.apt_blocked_override_title}
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-700">
          {t.apt_blocked_override_desc.replace("un rendez-vous", vocab.appointment.toLowerCase())}
          {" "}Voulez-vous continuer quand même ?
        </p>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50 font-medium">
            {t.lay_cancel}
          </button>
          <button onClick={onConfirm}
            className="flex-1 bg-amber-500 text-white py-2 rounded-xl text-sm font-semibold hover:bg-amber-600">
            {t.apt_blocked_continue}
          </button>
        </div>
      </div>
    </div>
  );
}


// ── ApptModal ─────────────────────────────────────────────────────────────────

function ApptModal({ appt, offers, onConfirm, onCancel, onUpdate, onClose }: {
  appt: Appointment;
  offers: { id: string; name: string }[];
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onUpdate: () => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { vocab } = useSectorVocab();
  const router = useRouter();
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [invoiceErr, setInvoiceErr] = useState("");

  const STATUS_LABELS_APPT: Record<string, string> = {
    pending:   t.apt_status_pending,
    confirmed: t.apt_status_confirmed,
    cancelled: t.apt_status_cancelled,
  };

  async function handleGenerateInvoice() {
    setGeneratingInvoice(true); setInvoiceErr("");
    try {
      await api.invoiceFromAppointment(appt.id);
      onClose();
      router.push("/dashboard/invoices");
    } catch (e: any) {
      setInvoiceErr(e.message);
      setGeneratingInvoice(false);
    }
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const initDt = new Date(appt.scheduled_at);
  const [editing, setEditing]         = useState(false);
  const [editDate, setEditDate]       = useState(`${initDt.getFullYear()}-${pad(initDt.getMonth()+1)}-${pad(initDt.getDate())}`);
  const [editTime, setEditTime]       = useState(`${pad(initDt.getHours())}:${pad(initDt.getMinutes())}`);
  const [editDur, setEditDur]         = useState(() => Math.round((new Date(appt.end_at).getTime()-initDt.getTime())/60000) || 30);
  const [editService, setEditService] = useState(appt.service_offer_id ?? "");
  const [saving, setSaving]           = useState(false);
  const [err, setErr]                 = useState("");

  const saveEdit = async () => {
    if (!editDate || !editTime) return;
    setSaving(true); setErr("");
    try {
      const [y, mo, d] = editDate.split("-").map(Number);
      const [h, m]     = editTime.split(":").map(Number);
      const base = new Date(y, mo - 1, d, h, m, 0, 0);
      const end  = new Date(base.getTime() + editDur * 60000);
      const body: any = { scheduled_at: toLocalISO(base), end_at: toLocalISO(end) };
      if (editService !== (appt.service_offer_id ?? "")) {
        body.service_offer_id = editService || null;
      }
      await api.updateAppointment(appt.id, body);
      onUpdate(); onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="font-bold text-lg">{appt.contact?.first_name} {appt.contact?.last_name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 leading-none">✕</button>
        </div>
        {/* Explication */}
        <div className="flex gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
          <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p className="text-xs text-blue-700 leading-relaxed">{t.appt_modal_explain}</p>
        </div>
        {appt.contact?.email && <p className="text-sm text-gray-500">{appt.contact.email}</p>}

        {!editing ? (
          <>
            {appt.contact?.phone && <p className="text-sm text-gray-400">{appt.contact.phone}</p>}
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <p>{new Date(appt.scheduled_at).toLocaleString("fr-BE",{dateStyle:"full",timeStyle:"short"})}</p>
              <p className="text-gray-400 text-xs">→ {fmtTime(appt.end_at)}</p>
              <p className="text-xs text-gray-500 mt-1">
                👥 {appt.party_size ?? 1} {(appt.party_size ?? 1) > 1 ? t.appt_party_size_n : t.appt_party_size_1}
              </p>
            </div>
            {appt.service_offer?.name && (
              <div className="flex items-center gap-1.5 text-sm text-primary-700 font-medium">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                {appt.service_offer.name}
              </div>
            )}
            {appt.notes && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">{t.appt_client_message}</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{appt.notes}</p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[appt.status]??"bg-gray-100"}`}>
                {STATUS_LABELS_APPT[appt.status] ?? appt.status}
              </span>
              {appt.status !== "cancelled" && (
                <button onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 border border-primary-200 rounded-lg px-2.5 py-1 hover:bg-primary-50">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                  {t.inv_action_edit}
                </button>
              )}
            </div>
            {appt.contact_id && (
              <button
                onClick={() => { onClose(); router.push(`/dashboard/contacts/${appt.contact_id}`); }}
                className="w-full inline-flex items-center justify-center gap-2 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                Voir la fiche {vocab.contact.toLowerCase()}
              </button>
            )}
            {appt.status === "pending" && (
              <div className="flex gap-2">
                <button onClick={() => onConfirm(appt.id)}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                  {t.apt_action_confirm}
                </button>
                <button onClick={() => onCancel(appt.id)}
                  className="flex-1 border border-red-300 text-red-500 py-2 rounded-lg text-sm font-medium hover:bg-red-50">
                  {t.apt_action_refuse}
                </button>
              </div>
            )}
            {appt.status === "confirmed" && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleGenerateInvoice}
                  disabled={generatingInvoice}
                  className="w-full inline-flex items-center justify-center gap-2 bg-teal-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-60"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  {generatingInvoice ? "Génération…" : t.apt_action_invoice}
                </button>
                {invoiceErr && <p className="text-xs text-red-500">{invoiceErr}</p>}
                <button onClick={() => onCancel(appt.id)}
                  className="w-full border border-red-300 text-red-500 py-2 rounded-lg text-sm font-medium hover:bg-red-50">
                  Annuler ce {vocab.appointment.toLowerCase()}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide">{t.apt_edit_title}</p>
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-gray-500">{t.apt_date_lbl}</label>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">{t.apt_time_lbl}</label>
                <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">{t.apt_duration_lbl}</label>
                <select value={editDur} onChange={e => setEditDur(Number(e.target.value))}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5 bg-white">
                  {[15,30,45,60,90,120].map(d => (
                    <option key={d} value={d}>{d < 60 ? `${d} min` : `${d/60}h`}</option>
                  ))}
                </select>
              </div>
              {offers.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500">{t.apt_service_lbl}</label>
                  <select value={editService} onChange={e => setEditService(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5 bg-white text-gray-700">
                    <option value="">{t.apt_no_service}</option>
                    {offers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              )}
              {err && <p className="text-red-500 text-sm">{err}</p>}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setEditing(false); setErr(""); }}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50">
                {t.lay_cancel}
              </button>
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 bg-primary-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
                {saving ? t.apt_saving : t.apt_save}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── FormPanel (questions personnalisées + acompte PayPal) ─────────────────────

type BookingQuestion = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  options?: string[];
  required: boolean;
};

type DepositConfig = {
  enabled: boolean;
  amount: number;
  currency: string;
  paypal_client_id: string;
  sandbox?: boolean;
};

function FormPanel({ siteId, onClose }: { siteId: string; onClose: () => void }) {
  const { t } = useLanguage();
  const [questions, setQuestions] = useState<BookingQuestion[]>([]);
  const [deposit, setDeposit]     = useState<DepositConfig>({ enabled: false, amount: 25, currency: "EUR", paypal_client_id: "", sandbox: false });
  const [paypalSecret, setPaypalSecret] = useState("");
  const [paypalConfigured, setPaypalConfigured] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [tab, setTab]             = useState<"questions" | "deposit">("questions");

  useEffect(() => {
    api.getBookingConfig(siteId).then(cfg => {
      setQuestions(cfg.booking_questions || []);
      if (cfg.deposit && Object.keys(cfg.deposit).length) {
        setDeposit({ enabled: false, amount: 25, currency: "EUR", paypal_client_id: "", ...cfg.deposit });
      }
      setPaypalConfigured(cfg.paypal_configured || false);
    }).catch(console.error).finally(() => setLoading(false));
  }, [siteId]);

  const addQuestion = () =>
    setQuestions(q => [...q, { id: `q_${Date.now()}`, label: "", type: "text", required: false }]);

  const removeQuestion = (id: string) =>
    setQuestions(q => q.filter(x => x.id !== id));

  const updateQuestion = (id: string, patch: Partial<BookingQuestion>) =>
    setQuestions(q => q.map(x => x.id === id ? { ...x, ...patch } : x));

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      const cleanedQuestions = questions.map(q => ({
        ...q,
        options: q.options?.filter(o => o.trim() !== ""),
      }));
      const body: Record<string, any> = { booking_questions: cleanedQuestions, deposit };
      if (paypalSecret.trim()) body.paypal_client_secret = paypalSecret.trim();
      await api.updateBookingConfig(siteId, body);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      if (paypalSecret.trim()) { setPaypalConfigured(true); setPaypalSecret(""); }
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">{t.bq_panel_title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {(["questions", "deposit"] as const).map(tab_ => (
            <button key={tab_} onClick={() => setTab(tab_)}
              className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === tab_ ? "border-primary-600 text-primary-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {tab_ === "questions" ? "📋 " + t.bq_panel_title : "💳 " + t.dep_title}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">{t.apt_loading}</p>
          ) : tab === "questions" ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">{t.bq_panel_subtitle}</p>

              {questions.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">{t.bq_empty}</p>
              )}

              {questions.map((q, i) => (
                <div key={q.id} className="border rounded-xl p-3 space-y-2 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-medium w-5 shrink-0">{i + 1}</span>
                    <input
                      value={q.label}
                      onChange={e => updateQuestion(q.id, { label: e.target.value })}
                      placeholder={t.bq_question_label}
                      className="flex-1 border rounded-lg px-2.5 py-1.5 text-sm"
                    />
                    <button onClick={() => removeQuestion(q.id)} className="text-red-400 hover:text-red-600 text-xs shrink-0">
                      {t.bq_delete}
                    </button>
                  </div>
                  <div className="flex gap-2 items-center pl-7">
                    <select
                      value={q.type}
                      onChange={e => updateQuestion(q.id, { type: e.target.value as any, options: undefined })}
                      className="border rounded-lg px-2 py-1 text-xs bg-white">
                      <option value="text">{t.bq_type_text}</option>
                      <option value="textarea">{t.bq_type_textarea}</option>
                      <option value="select">{t.bq_type_select}</option>
                    </select>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                      <input type="checkbox" checked={q.required}
                        onChange={e => updateQuestion(q.id, { required: e.target.checked })}
                        className="rounded border-gray-300 text-primary-600" />
                      {t.bq_required}
                    </label>
                  </div>
                  {q.type === "select" && (
                    <div className="pl-7">
                      <label className="text-xs text-gray-500 block mb-1">{t.bq_options_label}</label>
                      <textarea
                        value={(q.options || []).join("\n")}
                        onChange={e => updateQuestion(q.id, { options: e.target.value.split("\n") })}
                        rows={3}
                        className="w-full border rounded-lg px-2.5 py-1.5 text-xs resize-none"
                        placeholder="Option A&#10;Option B&#10;Option C"
                      />
                    </div>
                  )}
                </div>
              ))}

              <button onClick={addQuestion}
                className="w-full border-2 border-dashed border-primary-300 text-primary-600 py-2 rounded-xl text-sm hover:bg-primary-50">
                {t.bq_add}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">{t.dep_subtitle}</p>

              <label className="flex items-center gap-3 cursor-pointer">
                <button onClick={() => setDeposit(d => ({ ...d, enabled: !d.enabled }))}
                  className={`w-10 h-5 rounded-full transition-colors relative ${deposit.enabled ? "bg-primary-600" : "bg-gray-300"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${deposit.enabled ? "left-5" : "left-0.5"}`} />
                </button>
                <span className="text-sm font-medium">{t.dep_enable}</span>
              </label>

              {deposit.enabled && (
                <div className="space-y-3 border rounded-xl p-3 bg-gray-50">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-500 block mb-1">{t.dep_amount}</label>
                      <input type="number" min={1} step={0.5}
                        value={deposit.amount}
                        onChange={e => setDeposit(d => ({ ...d, amount: Number(e.target.value) }))}
                        className="w-full border rounded-lg px-2.5 py-1.5 text-sm" />
                    </div>
                    <div className="w-20">
                      <label className="text-xs font-medium text-gray-500 block mb-1">{t.dep_currency}</label>
                      <select value={deposit.currency} onChange={e => setDeposit(d => ({ ...d, currency: e.target.value }))}
                        className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white">
                        <option>EUR</option><option>USD</option><option>GBP</option><option>CHF</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">{t.dep_paypal_id}</label>
                    <input
                      value={deposit.paypal_client_id}
                      onChange={e => setDeposit(d => ({ ...d, paypal_client_id: e.target.value.trim() }))}
                      placeholder="AZxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className={`w-full border rounded-lg px-2.5 py-1.5 text-sm font-mono ${deposit.paypal_client_id.includes("@") ? "border-red-400 bg-red-50" : ""}`}
                    />
                    {deposit.paypal_client_id.includes("@") && (
                      <p className="text-xs text-red-500 mt-0.5">⚠️ Ceci ressemble à une adresse email. Le Client ID PayPal est une longue chaîne alphanumérique (ex : AZxxxxx…), disponible sur developer.paypal.com → My Apps & Credentials.</p>
                    )}
                    {!deposit.paypal_client_id.includes("@") && (
                      <p className="text-xs text-gray-400 mt-0.5">{t.dep_paypal_id_hint}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">{t.dep_paypal_secret}</label>
                    {paypalConfigured && !paypalSecret && (
                      <p className="text-xs text-green-600 mb-1">✓ {t.dep_paypal_configured}</p>
                    )}
                    <input type="password"
                      value={paypalSecret}
                      onChange={e => setPaypalSecret(e.target.value)}
                      placeholder={t.dep_paypal_secret_ph}
                      className="w-full border rounded-lg px-2.5 py-1.5 text-sm font-mono"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!deposit.sandbox}
                      onChange={e => setDeposit(d => ({ ...d, sandbox: e.target.checked }))}
                      className="rounded border-gray-300 text-amber-500" />
                    <span className="text-xs text-amber-700 font-medium">Mode Sandbox (test) — désactiver en production</span>
                  </label>

                  <details className="text-xs text-gray-500">
                    <summary className="cursor-pointer hover:text-gray-700 font-medium">{t.dep_how_title}</summary>
                    <ol className="mt-2 space-y-1 pl-2">
                      <li>{t.dep_how_1}</li>
                      <li>{t.dep_how_2}</li>
                      <li>{t.dep_how_3}</li>
                    </ol>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t">
          <button onClick={save} disabled={saving}
            className="w-full bg-primary-600 text-white py-2 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50">
            {saved ? t.bq_saved : saving ? t.apt_saving : tab === "questions" ? t.bq_save : t.dep_save}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { vocab } = useSectorVocab();
  const DAYS_FR = t.apt_days_short as string[];
  const [view, setView]                 = useState<View>("week");
  const [anchor, setAnchor]             = useState<Date>(() => { const d=new Date(); d.setHours(0,0,0,0); return d; });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availability, setAvailability] = useState<AvailSlot[]>([]);
  const [blocked, setBlocked]           = useState<BlockedPeriod[]>([]);
  const [offers, setOffers]             = useState<{id:string;name:string}[]>([]);
  const [showAvail, setShowAvail]       = useState(false);
  const [showBlock, setShowBlock]       = useState(false);
  const [showForm, setShowForm]         = useState(false);
  const [formSiteId, setFormSiteId]     = useState<string | null>(null);
  const [selectedAppt, setSelectedAppt] = useState<Appointment|null>(null);
  const [creating, setCreating]         = useState<{day:Date;startH:number;startM:number}|null>(null);
  const [allowPast, setAllowPast]       = useState(false);
  const [loading, setLoading]           = useState(true);
  const [blockedOverride, setBlockedOverride] = useState<{day:Date;startH:number;startM:number;period:BlockedPeriod}|null>(null);

  // Static data (availability, blocked periods, offers) — loaded once on mount
  useEffect(() => {
    Promise.all([api.getAvailability(), api.getBlocked(), api.getSites()]).then(async ([avail, blk, sites]) => {
      setAvailability(avail); setBlocked(blk);
      if (sites[0]) {
        setFormSiteId(sites[0].id);
        const off = await api.getSiteOffers(sites[0].id);
        setOffers(off.map((o: any) => ({ id: o.id, name: o.name })));
      }
    }).catch(console.error);
  }, []);

  // Appointments — loaded for the current view's date range + a 60-day future window
  // so that all pending appointments appear in the banner regardless of navigation position
  const load = useCallback(async () => {
    setLoading(true);
    try {
      let viewStart: Date, viewEnd: Date;
      if (view === "day") {
        viewStart = new Date(anchor); viewStart.setHours(0, 0, 0, 0);
        viewEnd   = addDays(viewStart, 1);
      } else if (view === "week") {
        viewStart = startOfWeek(anchor);
        viewEnd   = addDays(viewStart, 7);
      } else {
        viewStart = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
        viewEnd   = addDays(viewStart, 42);
      }
      // Expand range: from 30 days before view start to 60 days after anchor (captures future pending)
      const rangeStart = addDays(viewStart, -30);
      const rangeEnd   = addDays(anchor, 60);
      const appts = await api.getCalendarAppointments({
        start: rangeStart.toISOString(),
        end:   rangeEnd.toISOString(),
      });
      setAppointments(appts);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [view, anchor]);

  useEffect(() => { load(); }, [load]);

  const navigate = (dir: -1|1) => {
    const d = new Date(anchor);
    if (view==="week") d.setDate(d.getDate()+dir*7);
    else if (view==="month") d.setMonth(d.getMonth()+dir);
    else d.setDate(d.getDate()+dir);
    setAnchor(d);
  };

  const headerLabel = () => {
    if (view==="week") { const ws=startOfWeek(anchor),we=addDays(ws,6); return `${fmtDate(ws)} – ${fmtDate(we)} ${ws.getFullYear()}`; }
    if (view==="month") return anchor.toLocaleDateString("fr-BE",{month:"long",year:"numeric"});
    return anchor.toLocaleDateString("fr-BE",{weekday:"long",day:"numeric",month:"long"});
  };

  const confirmAppt = async (id: string) => {
    await api.confirmAppointment(id);
    setSelectedAppt(null); load();
  };

  const cancelAppt = async (id: string) => {
    await api.cancelAppointment(id);
    setSelectedAppt(null); load();
  };

  const weekDays    = Array.from({length:7}, (_,i) => addDays(startOfWeek(anchor), i));
  const hours       = Array.from({length:HOUR_END-HOUR_START}, (_,i) => HOUR_START+i);
  const apptsForDay = (d: Date) => appointments.filter(a => a.status !== "cancelled" && isSameDay(new Date(a.scheduled_at), d));

  const handleGridClick = (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-appt]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relY  = e.clientY - rect.top;
    const snapped = Math.round((relY / SLOT_H) * 2) * 30;
    const startH  = Math.min(Math.floor(HOUR_START + snapped / 60), HOUR_END - 1);
    const startM  = snapped % 60;
    const clickedAt = new Date(day); clickedAt.setHours(startH, startM, 0, 0);
    if (!allowPast && clickedAt < new Date()) return;
    setSelectedAppt(null);
    const overlapping = blocked.find(b => clickedAt >= new Date(b.start_at) && clickedAt < new Date(b.end_at));
    if (overlapping) {
      setBlockedOverride({ day, startH, startM, period: overlapping });
    } else {
      setCreating({ day, startH, startM });
    }
  };

  // ── Vue semaine / jour ──────────────────────────────────────────────────────

  function TimeGrid({ days }: { days: Date[] }) {
    const multi = days.length > 1;
    const minW  = multi ? "min-w-[560px]" : "";
    return (
      <div className="flex-1 overflow-auto">
        {/* En-têtes */}
        <div className={`flex border-b sticky top-0 bg-white z-10 ${minW}`}>
          <div className="w-12 shrink-0"/>
          {days.map((d,i) => (
            <div key={i} className={`flex-1 text-center py-2 border-l text-sm font-medium ${isSameDay(d,new Date())?"text-primary-600":"text-gray-600"}`}>
              <div className="text-xs uppercase">{DAYS_FR[d.getDay()===0?6:d.getDay()-1]}</div>
              <div className={`text-base font-bold mx-auto w-8 h-8 flex items-center justify-center rounded-full ${isSameDay(d,new Date())?"bg-primary-600 text-white":""}`}>
                {d.getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* Grille */}
        <div className={`flex relative ${minW}`} style={{height:(HOUR_END-HOUR_START)*SLOT_H}}>
          {/* Heures */}
          <div className="w-12 shrink-0 relative">
            {hours.map(h => (
              <div key={h} className="absolute w-full text-right pr-1.5 text-xs text-gray-400" style={{top:(h-HOUR_START)*SLOT_H-7}}>{h}h</div>
            ))}
          </div>

          {/* Colonnes */}
          {days.map((d, di) => (
            <div
              key={di}
              className="flex-1 border-l relative cursor-cell select-none"
              onClick={e => handleGridClick(d, e)}
            >
              {hours.map(h => (
                <div key={h} className="absolute w-full border-t border-gray-100" style={{top:(h-HOUR_START)*SLOT_H}}/>
              ))}
              {hours.map(h => (
                <div key={`h${h}`} className="absolute w-full border-t border-gray-50" style={{top:(h-HOUR_START)*SLOT_H+SLOT_H/2}}/>
              ))}

              {blocked.filter(b => {
                const bs = new Date(b.start_at), be = new Date(b.end_at);
                const dayStart = new Date(d); dayStart.setHours(HOUR_START, 0, 0, 0);
                const dayEnd   = new Date(d); dayEnd.setHours(HOUR_END, 0, 0, 0);
                return bs < dayEnd && be > dayStart;
              }).map(b => {
                const bs = new Date(b.start_at), be = new Date(b.end_at);
                const dayStart = new Date(d); dayStart.setHours(HOUR_START, 0, 0, 0);
                const dayEnd   = new Date(d); dayEnd.setHours(HOUR_END, 0, 0, 0);
                const clampS = bs < dayStart ? dayStart : bs;
                const clampE = be > dayEnd   ? dayEnd   : be;
                const top    = (clampS.getHours() + clampS.getMinutes()/60 - HOUR_START) * SLOT_H;
                const height = Math.max(((clampE.getTime()-clampS.getTime())/3600000)*SLOT_H, 8);
                return (
                  <div key={b.id}
                    className="absolute left-0 right-0 opacity-30 pointer-events-none overflow-hidden"
                    style={{ top, height, background: b.color ?? "#ef4444" }}>
                    {b.reason && <span className="text-[10px] text-white font-medium px-1 truncate block leading-tight mt-0.5">{b.reason}</span>}
                  </div>
                );
              })}

              {apptsForDay(d).map(a => (
                <button
                  key={a.id}
                  data-appt="1"
                  onClick={e => { e.stopPropagation(); setCreating(null); setSelectedAppt(a); }}
                  className={`absolute left-0.5 right-0.5 rounded px-1 text-left text-xs overflow-hidden ${STATUS_COLOR[a.status]??"bg-primary-400 text-white"}`}
                  style={{top:topPx(a.scheduled_at), height:heightPx(a.scheduled_at,a.end_at)}}
                >
                  <span className="font-semibold block truncate">{fmtTime(a.scheduled_at)}</span>
                  <span className="block truncate">{a.contact?.first_name} {a.contact?.last_name}</span>
                  {a.service_offer?.name && <span className="block truncate opacity-75">{a.service_offer.name}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Vue mois ────────────────────────────────────────────────────────────────

  function MonthGrid() {
    const year = anchor.getFullYear(), month = anchor.getMonth();
    const cells = Array.from({length:42}, (_,i) => addDays(startOfWeek(new Date(year,month,1)), i));
    return (
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 border-b">
          {DAYS_FR.map(d=><div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7" style={{gridAutoRows:"minmax(64px,1fr)"}}>
          {cells.map((d,i) => {
            const inMonth  = d.getMonth()===month;
            const today    = isSameDay(d,new Date());
            const dayAppts = apptsForDay(d).filter(a=>a.status!=="cancelled");
            return (
              <div key={i}
                className={`border-b border-r p-1 cursor-pointer hover:bg-gray-50 ${!inMonth?"bg-gray-50":""}`}
                onClick={() => { setAnchor(d); setView("day"); }}>
                <div className={`text-xs sm:text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full mb-0.5 ${today?"bg-primary-600 text-white":inMonth?"text-gray-800":"text-gray-300"}`}>
                  {d.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayAppts.slice(0,2).map(a=>(
                    <button key={a.id}
                      onClick={e => { e.stopPropagation(); setSelectedAppt(a); }}
                      className="w-full text-left text-xs px-1 rounded bg-primary-100 text-primary-800 truncate">
                      {fmtTime(a.scheduled_at)} {a.contact?.first_name}
                    </button>
                  ))}
                  {dayAppts.length>2 && <p className="text-xs text-gray-400 pl-1">+{dayAppts.length-2}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Barre top */}
      <div className="bg-white border-b px-3 sm:px-4 py-2 sm:py-3 flex flex-wrap items-center gap-2">
        {/* Ligne 1 : retour + titre + boutons action */}
        <button onClick={()=>router.push("/dashboard")}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          <span className="hidden sm:inline">Retour</span>
        </button>

        <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex-1 min-w-0">{vocab.appointments}</h1>

        <button id="appts-availability-btn" onClick={()=>setShowAvail(true)}
          className="text-xs sm:text-sm px-2.5 py-1.5 border border-primary-300 text-primary-600 rounded-lg hover:bg-primary-50 shrink-0">
          ⚙ <span className="hidden sm:inline">{t.apt_toolbar_avail}</span>
        </button>
        <button onClick={()=>setShowBlock(true)}
          className="text-xs sm:text-sm px-2.5 py-1.5 border border-red-300 text-red-500 rounded-lg hover:bg-red-50 shrink-0">
          🚫 <span className="hidden sm:inline">{t.apt_toolbar_block}</span>
        </button>
        <button onClick={()=>setShowForm(true)} disabled={!formSiteId}
          className="text-xs sm:text-sm px-2.5 py-1.5 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 shrink-0 disabled:opacity-40">
          📋 <span className="hidden sm:inline">{t.apt_toolbar_form}</span>
        </button>

        {/* Ligne 2 : vue + navigation */}
        <div className="w-full flex items-center gap-2 flex-wrap">
          <div id="appts-view-toggle" className="flex bg-gray-100 rounded-lg p-0.5 text-sm">
            {(["day","week","month"] as View[]).map(v=>(
              <button key={v} onClick={()=>{ setView(v); setCreating(null); }}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors text-xs sm:text-sm ${view===v?"bg-white shadow text-primary-600":"text-gray-600 hover:text-gray-800"}`}>
                {v==="day"?t.apt_view_day:v==="week"?t.apt_view_week:t.apt_view_month}
              </button>
            ))}
          </div>

          <div id="appts-nav" className="flex items-center gap-1 text-sm flex-1 justify-center">
            <button onClick={()=>navigate(-1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600">◀</button>
            <span className="font-medium text-center capitalize text-xs sm:text-sm px-1 truncate max-w-[180px] sm:max-w-none">
              {headerLabel()}
            </span>
            <button onClick={()=>navigate(1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600">▶</button>
            <button onClick={()=>{ const d=new Date(); d.setHours(0,0,0,0); setAnchor(d); setCreating(null); }}
              className="px-2 py-1 text-xs border rounded hover:bg-gray-50">
              {t.apt_today}
            </button>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none ml-auto">
            <input type="checkbox" checked={allowPast} onChange={e => setAllowPast(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            {t.apt_past_events}
          </label>
        </div>
      </div>

      {/* Bannière RDVs en attente */}
      {!loading && appointments.filter(a => a.status === "pending").length > 0 && (
        <div id="appts-pending" className="bg-amber-50 border-b border-amber-200 px-4 py-2 space-y-1.5 shrink-0">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
            {appointments.filter(a => a.status === "pending").length}{" "}
            {appointments.filter(a => a.status === "pending").length === 1
              ? t.apt_pending_singular
              : t.apt_pending_plural}
          </p>
          <div className="flex flex-wrap gap-2">
            {appointments.filter(a => a.status === "pending").map(a => (
              <div key={a.id} className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-xs shadow-sm">
                <button onClick={() => setSelectedAppt(a)} className="flex items-center gap-1.5 hover:underline text-left">
                  <span className="font-medium text-gray-800">
                    {a.contact?.first_name} {a.contact?.last_name}
                  </span>
                  {a.notes && (
                    <span className="text-blue-400" title={a.notes}>✉</span>
                  )}
                </button>
                <span className="text-gray-400">
                  {new Date(a.scheduled_at).toLocaleString("fr-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
                <button
                  onClick={() => confirmAppt(a.id)}
                  className="bg-green-600 text-white rounded px-2 py-0.5 hover:bg-green-700 font-medium"
                >
                  ✓
                </button>
                <button
                  onClick={() => cancelAppt(a.id)}
                  className="text-red-400 hover:text-red-600 font-medium"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">{t.apt_loading}</div>
      ) : (
        <div id="appts-calendar" className="flex-1 overflow-hidden flex flex-col">
          {view==="month" && <MonthGrid/>}
          {view==="week"  && <TimeGrid days={weekDays}/>}
          {view==="day"   && <TimeGrid days={[anchor]}/>}
        </div>
      )}

      {showAvail && (
        <AvailabilityPanel
          availability={availability}
          onSave={async () => {
            const avail = await api.getAvailability();
            setAvailability(avail);
            setShowAvail(false);
          }}
          onClose={() => setShowAvail(false)}
        />
      )}
      {showBlock && (
        <BlockPanel
          blocked={blocked}
          onSave={async () => {
            const blk = await api.getBlocked();
            setBlocked(blk);
          }}
          onClose={() => setShowBlock(false)}
        />
      )}
      {showForm && formSiteId && (
        <FormPanel siteId={formSiteId} onClose={() => setShowForm(false)} />
      )}
      {creating && (
        <NewApptCard
          day={creating.day}
          startH={creating.startH}
          startM={creating.startM}
          durationMin={30}
          offers={offers}
          onSave={() => { setCreating(null); load(); }}
          onClose={() => setCreating(null)}
        />
      )}
      {blockedOverride && (
        <BlockedOverrideModal
          period={blockedOverride.period}
          onConfirm={() => {
            const { day, startH, startM } = blockedOverride;
            setBlockedOverride(null);
            setCreating({ day, startH, startM });
          }}
          onClose={() => setBlockedOverride(null)}
        />
      )}
      {selectedAppt && (
        <ApptModal
          appt={selectedAppt}
          offers={offers}
          onConfirm={confirmAppt}
          onCancel={cancelAppt}
          onUpdate={load}
          onClose={() => setSelectedAppt(null)}
        />
      )}
    </div>
  );
}
