"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type Appointment = {
  id: string;
  status: string;
  scheduled_at: string;
  end_at: string;
  contact?: { first_name: string; last_name: string; email: string };
  service_offer?: { name: string };
};

type AvailSlot = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_min: number;
  is_active: boolean;
};

type BlockedPeriod = { id: string; start_at: string; end_at: string; reason?: string };
type Contact = { id: string; first_name: string; last_name: string; email: string; phone?: string };
type NewClientData = { first_name: string; last_name: string; email?: string; phone?: string; source?: string };
type View = "week" | "month" | "day";

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS_FR   = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAYS_FULL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const HOUR_START = 7;
const HOUR_END   = 20;
const SLOT_H     = 64;
const STATUS_COLOR: Record<string, string> = {
  confirmed: "bg-indigo-500 text-white",
  cancelled: "bg-gray-300 text-gray-500",
  pending:   "bg-yellow-400 text-white",
};
const SOURCES = [
  "Bouche à oreille",
  "Google / Recherche en ligne",
  "Réseaux sociaux",
  "Site internet",
  "Recommandation",
  "Flyer / Affiche",
  "Autre",
];

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

// ── ContactSearch ─────────────────────────────────────────────────────────────

function ContactSearch({ onSelect, onCreateNew }: {
  onSelect: (c: Contact) => void;
  onCreateNew: (name: string) => void;
}) {
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
        placeholder="Rechercher un contact…"
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
              className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 border-b last:border-0">
              <span className="font-medium">{c.first_name} {c.last_name}</span>
              {c.email && <span className="text-gray-400 ml-2 text-xs">{c.email}</span>}
            </button>
          ))}
        </div>
      )}
      {q.length >= 2 && results.length === 0 && (
        <button
          onClick={() => { setOpen(false); onCreateNew(q); }}
          className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 z-20 text-left">
          + Nouveau client "{q}"
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
  const parts = initialName.trim().split(" ");
  const [fn, setFn]         = useState(parts[0] ?? "");
  const [ln, setLn]         = useState(parts.slice(1).join(" "));
  const [em, setEm]         = useState("");
  const [ph, setPh]         = useState("");
  const [source, setSource] = useState("");

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b">
          <h3 className="font-bold text-base">Nouveau client</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-600">Prénom *</label>
              <input value={fn} onChange={e => setFn(e.target.value)} placeholder="Marie"
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"/>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Nom</label>
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
            <label className="text-xs font-medium text-gray-600">Téléphone</label>
            <input type="tel" value={ph} onChange={e => setPh(e.target.value)}
              placeholder="+32 4xx xxx xxx"
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"/>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Canal d'entrée</label>
            <select value={source} onChange={e => setSource(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1 text-gray-700 bg-white">
              <option value="">-- Comment vous a-t-il trouvé ? --</option>
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
            className="w-full bg-indigo-600 text-white rounded-xl py-2.5 font-semibold hover:bg-indigo-700 disabled:opacity-50 text-sm">
            Ajouter ce client au rendez-vous
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
        scheduled_at: base.toISOString(),
        end_at: end.toISOString(),
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
          <div className="bg-indigo-600 text-white rounded-t-2xl px-4 py-3 flex justify-between items-start">
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
            {clientLabel ? (
              <div className="flex items-center justify-between border rounded-lg px-3 py-2.5 bg-indigo-50">
                <span className="text-sm font-medium text-indigo-800">{clientLabel}</span>
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
              className="w-full bg-indigo-600 text-white rounded-xl py-2.5 font-semibold hover:bg-indigo-700 disabled:opacity-50 text-sm">
              {saving ? "Création…" : "Créer le rendez-vous"}
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

function AvailabilityPanel({ availability, onSave, onClose }: {
  availability: AvailSlot[]; onSave: () => void; onClose: () => void;
}) {
  const [slots, setSlots] = useState<AvailSlot[]>(() =>
    DAYS_FR.map((_, i) => {
      const ex = availability.find(s => s.day_of_week === i);
      return ex ?? { day_of_week: i, start_time: "09:00", end_time: "18:00", slot_duration_min: 30, is_active: false };
    })
  );
  const [saving, setSaving] = useState(false);

  const toggle = (i: number) =>
    setSlots(p => p.map((s,idx) => idx===i ? {...s,is_active:!s.is_active} : s));
  const upd = (i: number, f: keyof AvailSlot, v: any) =>
    setSlots(p => p.map((s,idx) => idx===i ? {...s,[f]:v} : s));

  const save = async () => {
    setSaving(true);
    try { await api.replaceAvailability(slots.filter(s => s.is_active)); onSave(); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Horaires de disponibilité</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {slots.map((s, i) => (
            <div key={i} className={`rounded-lg border p-3 ${s.is_active ? "border-indigo-300 bg-indigo-50" : "border-gray-200"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{DAYS_FULL[i]}</span>
                <button onClick={() => toggle(i)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${s.is_active?"bg-indigo-600":"bg-gray-300"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${s.is_active?"left-5":"left-0.5"}`}/>
                </button>
              </div>
              {s.is_active && (
                <div className="flex gap-2 items-center flex-wrap">
                  <input type="time" value={s.start_time} onChange={e=>upd(i,"start_time",e.target.value)}
                    className="border rounded px-2 py-1 text-sm flex-1 min-w-0"/>
                  <span className="text-gray-400 text-sm">→</span>
                  <input type="time" value={s.end_time} onChange={e=>upd(i,"end_time",e.target.value)}
                    className="border rounded px-2 py-1 text-sm flex-1 min-w-0"/>
                  <select value={s.slot_duration_min} onChange={e=>upd(i,"slot_duration_min",Number(e.target.value))}
                    className="border rounded px-2 py-1 text-sm">
                    {[15,30,45,60,90].map(d=><option key={d} value={d}>{d<60?`${d} min`:`${d/60}h`}</option>)}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="p-4 border-t">
          <button onClick={save} disabled={saving}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {saving?"Enregistrement…":"Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── BlockPanel ────────────────────────────────────────────────────────────────

function BlockPanel({ blocked, onSave, onClose }: {
  blocked: BlockedPeriod[]; onSave: () => void; onClose: () => void;
}) {
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt]     = useState("");
  const [reason, setReason]   = useState("");
  const [saving, setSaving]   = useState(false);

  const add = async () => {
    if (!startAt || !endAt) return;
    setSaving(true);
    try {
      await api.createBlocked({start_at:startAt,end_at:endAt,reason:reason||undefined});
      onSave(); setStartAt(""); setEndAt(""); setReason("");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Périodes bloquées</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
            <p className="text-sm font-medium text-gray-700">Ajouter un blocage</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><label className="text-xs text-gray-500">Début</label>
                <input type="datetime-local" value={startAt} onChange={e=>setStartAt(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm mt-0.5"/></div>
              <div><label className="text-xs text-gray-500">Fin</label>
                <input type="datetime-local" value={endAt} onChange={e=>setEndAt(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm mt-0.5"/></div>
            </div>
            <input type="text" placeholder="Motif (optionnel)" value={reason} onChange={e=>setReason(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"/>
            <button onClick={add} disabled={saving||!startAt||!endAt}
              className="w-full bg-red-500 text-white py-1.5 rounded font-medium text-sm hover:bg-red-600 disabled:opacity-50">
              {saving?"…":"Bloquer cette période"}
            </button>
          </div>
          <div className="space-y-2">
            {blocked.length===0 && <p className="text-sm text-gray-400">Aucune période bloquée.</p>}
            {blocked.map(b=>(
              <div key={b.id} className="border rounded-lg p-3 flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium">
                    {new Date(b.start_at).toLocaleString("fr-BE",{dateStyle:"medium",timeStyle:"short"})}
                    {" → "}
                    {new Date(b.end_at).toLocaleString("fr-BE",{dateStyle:"medium",timeStyle:"short"})}
                  </p>
                  {b.reason && <p className="text-xs text-gray-400 mt-0.5">{b.reason}</p>}
                </div>
                <button onClick={()=>api.deleteBlocked(b.id).then(onSave)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ApptModal ─────────────────────────────────────────────────────────────────

function ApptModal({ appt, onCancel, onClose }: {
  appt: Appointment; onCancel: (id: string) => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="font-bold text-lg">{appt.contact?.first_name} {appt.contact?.last_name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 leading-none">✕</button>
        </div>
        {appt.contact?.email && <p className="text-sm text-gray-500">{appt.contact.email}</p>}
        {appt.service_offer?.name && <p className="text-sm font-medium text-indigo-600">{appt.service_offer.name}</p>}
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <p>{new Date(appt.scheduled_at).toLocaleString("fr-BE",{dateStyle:"full",timeStyle:"short"})}</p>
          <p className="text-gray-400 text-xs mt-1">→ {fmtTime(appt.end_at)}</p>
        </div>
        <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[appt.status]??"bg-gray-100"}`}>{appt.status}</span>
        {appt.status==="confirmed" && (
          <button onClick={()=>onCancel(appt.id)}
            className="w-full border border-red-300 text-red-500 py-2 rounded-lg text-sm font-medium hover:bg-red-50">
            Annuler ce rendez-vous
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const router = useRouter();
  const [view, setView]                 = useState<View>("week");
  const [anchor, setAnchor]             = useState<Date>(() => { const d=new Date(); d.setHours(0,0,0,0); return d; });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availability, setAvailability] = useState<AvailSlot[]>([]);
  const [blocked, setBlocked]           = useState<BlockedPeriod[]>([]);
  const [offers, setOffers]             = useState<{id:string;name:string}[]>([]);
  const [showAvail, setShowAvail]       = useState(false);
  const [showBlock, setShowBlock]       = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<Appointment|null>(null);
  const [creating, setCreating]         = useState<{day:Date;startH:number;startM:number}|null>(null);
  const [loading, setLoading]           = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [appts, avail, blk] = await Promise.all([
        api.getCalendarAppointments(),
        api.getAvailability(),
        api.getBlocked(),
      ]);
      setAppointments(appts); setAvailability(avail); setBlocked(blk);
      const sites = await api.getSites();
      if (sites[0]) {
        const off = await api.getSiteOffers(sites[0].id);
        setOffers(off.map((o:any) => ({id:o.id,name:o.name})));
      }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

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

  const cancelAppt = async (id: string) => {
    await api.updateAppointment(id, {status:"cancelled"});
    setSelectedAppt(null); load();
  };

  const weekDays    = Array.from({length:7}, (_,i) => addDays(startOfWeek(anchor), i));
  const hours       = Array.from({length:HOUR_END-HOUR_START}, (_,i) => HOUR_START+i);
  const apptsForDay = (d: Date) => appointments.filter(a => isSameDay(new Date(a.scheduled_at), d));

  const handleGridClick = (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-appt]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relY  = e.clientY - rect.top;
    const snapped = Math.round((relY / SLOT_H) * 2) * 30;
    const startH  = Math.min(Math.floor(HOUR_START + snapped / 60), HOUR_END - 1);
    const startM  = snapped % 60;
    setCreating({ day, startH, startM });
    setSelectedAppt(null);
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
            <div key={i} className={`flex-1 text-center py-2 border-l text-sm font-medium ${isSameDay(d,new Date())?"text-indigo-600":"text-gray-600"}`}>
              <div className="text-xs uppercase">{DAYS_FR[d.getDay()===0?6:d.getDay()-1]}</div>
              <div className={`text-base font-bold mx-auto w-8 h-8 flex items-center justify-center rounded-full ${isSameDay(d,new Date())?"bg-indigo-600 text-white":""}`}>
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

              {apptsForDay(d).map(a => (
                <button
                  key={a.id}
                  data-appt="1"
                  onClick={e => { e.stopPropagation(); setCreating(null); setSelectedAppt(a); }}
                  className={`absolute left-0.5 right-0.5 rounded px-1 text-left text-xs overflow-hidden ${STATUS_COLOR[a.status]??"bg-indigo-400 text-white"}`}
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
                <div className={`text-xs sm:text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full mb-0.5 ${today?"bg-indigo-600 text-white":inMonth?"text-gray-800":"text-gray-300"}`}>
                  {d.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayAppts.slice(0,2).map(a=>(
                    <button key={a.id}
                      onClick={e => { e.stopPropagation(); setSelectedAppt(a); }}
                      className="w-full text-left text-xs px-1 rounded bg-indigo-100 text-indigo-800 truncate">
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

        <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex-1 min-w-0">Rendez-vous</h1>

        <button onClick={()=>setShowAvail(true)}
          className="text-xs sm:text-sm px-2.5 py-1.5 border border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-50 shrink-0">
          ⚙ <span className="hidden sm:inline">Disponibilités</span>
        </button>
        <button onClick={()=>setShowBlock(true)}
          className="text-xs sm:text-sm px-2.5 py-1.5 border border-red-300 text-red-500 rounded-lg hover:bg-red-50 shrink-0">
          🚫 <span className="hidden sm:inline">Bloquer</span>
        </button>

        {/* Ligne 2 : vue + navigation */}
        <div className="w-full flex items-center gap-2 flex-wrap">
          <div className="flex bg-gray-100 rounded-lg p-0.5 text-sm">
            {(["day","week","month"] as View[]).map(v=>(
              <button key={v} onClick={()=>{ setView(v); setCreating(null); }}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors text-xs sm:text-sm ${view===v?"bg-white shadow text-indigo-600":"text-gray-600 hover:text-gray-800"}`}>
                {v==="day"?"Jour":v==="week"?"Semaine":"Mois"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 text-sm flex-1 justify-center">
            <button onClick={()=>navigate(-1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600">◀</button>
            <span className="font-medium text-center capitalize text-xs sm:text-sm px-1 truncate max-w-[180px] sm:max-w-none">
              {headerLabel()}
            </span>
            <button onClick={()=>navigate(1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600">▶</button>
            <button onClick={()=>{ const d=new Date(); d.setHours(0,0,0,0); setAnchor(d); setCreating(null); }}
              className="px-2 py-1 text-xs border rounded hover:bg-gray-50">
              Auj.
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Chargement…</div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col">
          {view==="month" && <MonthGrid/>}
          {view==="week"  && <TimeGrid days={weekDays}/>}
          {view==="day"   && <TimeGrid days={[anchor]}/>}
        </div>
      )}

      {showAvail && (
        <AvailabilityPanel
          availability={availability}
          onSave={async () => { await load(); setShowAvail(false); }}
          onClose={() => setShowAvail(false)}
        />
      )}
      {showBlock && (
        <BlockPanel
          blocked={blocked}
          onSave={async () => { await load(); }}
          onClose={() => setShowBlock(false)}
        />
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
      {selectedAppt && (
        <ApptModal appt={selectedAppt} onCancel={cancelAppt} onClose={()=>setSelectedAppt(null)}/>
      )}
    </div>
  );
}
