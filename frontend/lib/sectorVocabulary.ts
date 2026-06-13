import type { Lang } from "./i18n";

// ── Types publics ──────────────────────────────────────────────────────────────

export type SectorVocab = {
  appointment: string;
  appointments: string;
  booking_cta: string;
  lead: string;
  leads: string;
  contact: string;
  contacts: string;
  party_size_label: string | null;
  party_size_hint: string | null;
  show_party_size: boolean;
  show_opening_hours: boolean;
  show_menu: boolean;
  service_type_options: { value: "service" | "product" | "menu_item"; label: string }[];
};

// ── Types internes multilingues ────────────────────────────────────────────────

type ML  = Record<Lang, string>;
type MLN = Record<Lang, string | null>;

type SectorVocabDef = {
  appointment: ML;
  appointments: ML;
  booking_cta: ML;
  lead: ML;
  leads: ML;
  contact: ML;
  contacts: ML;
  party_size_label: MLN;
  party_size_hint: MLN;
  show_party_size: boolean;
  show_opening_hours: boolean;
  show_menu: boolean;
  service_type_options: { value: "service" | "product" | "menu_item"; label: ML }[];
};

const NULL_ML: MLN = { fr: null, en: null, de: null, nl: null };

// ── Valeurs par défaut ─────────────────────────────────────────────────────────

const DEFAULT: SectorVocabDef = {
  appointment:  { fr: "Rendez-vous",          en: "Appointment",        de: "Termin",          nl: "Afspraak"       },
  appointments: { fr: "Rendez-vous",          en: "Appointments",       de: "Termine",         nl: "Afspraken"      },
  booking_cta:  { fr: "Prendre rendez-vous",  en: "Book an appointment",de: "Termin buchen",   nl: "Afspraak maken" },
  lead:         { fr: "Demande",              en: "Request",            de: "Anfrage",          nl: "Aanvraag"       },
  leads:        { fr: "Demandes",             en: "Requests",           de: "Anfragen",         nl: "Aanvragen"      },
  contact:      { fr: "Client",               en: "Client",             de: "Kunde",            nl: "Klant"          },
  contacts:     { fr: "Clients",              en: "Clients",            de: "Kunden",           nl: "Klanten"        },
  party_size_label: NULL_ML,
  party_size_hint:  NULL_ML,
  show_party_size:    false,
  show_opening_hours: false,
  show_menu:          false,
  service_type_options: [
    { value: "service", label: { fr: "Prestation", en: "Service", de: "Leistung", nl: "Dienst" } },
  ],
};

// ── Vocabulaire par secteur ────────────────────────────────────────────────────

const VOCAB: Record<string, SectorVocabDef> = {

  health: {
    ...DEFAULT,
    appointment:  { fr: "Consultation",      en: "Consultation",       de: "Konsultation",    nl: "Consult"        },
    appointments: { fr: "Consultations",     en: "Consultations",      de: "Konsultationen",  nl: "Consulten"      },
    booking_cta:  { fr: "Prendre rendez-vous", en: "Book an appointment", de: "Termin buchen", nl: "Afspraak maken" },
    lead:         { fr: "Demande de soin",   en: "Care request",       de: "Pflegeanfrage",   nl: "Zorgaanvraag"   },
    leads:        { fr: "Demandes de soin",  en: "Care requests",      de: "Pflegeanfragen",  nl: "Zorgaanvragen"  },
    contact:      { fr: "Patient",           en: "Patient",            de: "Patient",         nl: "Patiënt"        },
    contacts:     { fr: "Patients",          en: "Patients",           de: "Patienten",       nl: "Patiënten"      },
    show_opening_hours: true,
  },

  beauty: {
    ...DEFAULT,
    appointment:  { fr: "Réservation",       en: "Booking",            de: "Buchung",         nl: "Reservering"    },
    appointments: { fr: "Réservations",      en: "Bookings",           de: "Buchungen",       nl: "Reserveringen"  },
    booking_cta:  { fr: "Réserver",          en: "Book",               de: "Buchen",          nl: "Reserveren"     },
    lead:         { fr: "Demande",           en: "Request",            de: "Anfrage",         nl: "Aanvraag"       },
    leads:        { fr: "Demandes",          en: "Requests",           de: "Anfragen",        nl: "Aanvragen"      },
    contact:      { fr: "Client(e)",         en: "Client",             de: "Kunde/Kundin",    nl: "Klant"          },
    contacts:     { fr: "Clients",           en: "Clients",            de: "Kunden",          nl: "Klanten"        },
    show_opening_hours: true,
  },

  coaching: {
    ...DEFAULT,
    appointment:  { fr: "Séance",            en: "Session",            de: "Sitzung",         nl: "Sessie"         },
    appointments: { fr: "Séances",           en: "Sessions",           de: "Sitzungen",       nl: "Sessies"        },
    booking_cta:  { fr: "Réserver une séance", en: "Book a session",   de: "Sitzung buchen",  nl: "Sessie boeken"  },
    lead:         { fr: "Demande",           en: "Request",            de: "Anfrage",         nl: "Aanvraag"       },
    leads:        { fr: "Demandes",          en: "Requests",           de: "Anfragen",        nl: "Aanvragen"      },
    contact:      { fr: "Coaché(e)",         en: "Coachee",            de: "Coachee",         nl: "Coachee"        },
    contacts:     { fr: "Coachés",           en: "Coachees",           de: "Coachees",        nl: "Coachees"       },
    show_opening_hours: true,
  },

  finance: {
    ...DEFAULT,
    appointment:  { fr: "Rendez-vous",       en: "Appointment",        de: "Termin",          nl: "Afspraak"       },
    appointments: { fr: "Rendez-vous",       en: "Appointments",       de: "Termine",         nl: "Afspraken"      },
    booking_cta:  { fr: "Prendre rendez-vous", en: "Book an appointment", de: "Termin buchen", nl: "Afspraak maken" },
    lead:         { fr: "Demande de conseil",en: "Advisory request",   de: "Beratungsanfrage",nl: "Adviesaanvraag" },
    leads:        { fr: "Demandes",          en: "Requests",           de: "Anfragen",        nl: "Aanvragen"      },
    contact:      { fr: "Client",            en: "Client",             de: "Mandant",         nl: "Klant"          },
    contacts:     { fr: "Clients",           en: "Clients",            de: "Mandanten",       nl: "Klanten"        },
    show_opening_hours: true,
  },

  trade: {
    ...DEFAULT,
    appointment:  { fr: "Intervention",      en: "Job",                de: "Einsatz",         nl: "Opdracht"       },
    appointments: { fr: "Interventions",     en: "Jobs",               de: "Einsätze",        nl: "Opdrachten"     },
    booking_cta:  { fr: "Demander un devis", en: "Request a quote",    de: "Angebot anfordern",nl: "Offerte aanvragen" },
    lead:         { fr: "Devis",             en: "Quote",              de: "Angebot",         nl: "Offerte"        },
    leads:        { fr: "Devis",             en: "Quotes",             de: "Angebote",        nl: "Offertes"       },
    contact:      { fr: "Client",            en: "Client",             de: "Kunde",           nl: "Klant"          },
    contacts:     { fr: "Clients",           en: "Clients",            de: "Kunden",          nl: "Klanten"        },
    show_opening_hours: true,
    service_type_options: [
      { value: "service", label: { fr: "Prestation",         en: "Service",    de: "Leistung",  nl: "Dienst"    } },
      { value: "product", label: { fr: "Fourniture / Matériau", en: "Supply / Material", de: "Material", nl: "Materiaal" } },
    ],
  },

  restaurant: {
    ...DEFAULT,
    appointment:  { fr: "Réservation",       en: "Reservation",        de: "Reservierung",    nl: "Reservering"    },
    appointments: { fr: "Réservations",      en: "Reservations",       de: "Reservierungen",  nl: "Reserveringen"  },
    booking_cta:  { fr: "Réserver une table",en: "Book a table",       de: "Tisch reservieren",nl: "Tafel reserveren" },
    lead:         { fr: "Réservation",       en: "Reservation",        de: "Reservierung",    nl: "Reservering"    },
    leads:        { fr: "Réservations",      en: "Reservations",       de: "Reservierungen",  nl: "Reserveringen"  },
    contact:      { fr: "Convive",           en: "Guest",              de: "Gast",            nl: "Gast"           },
    contacts:     { fr: "Convives",          en: "Guests",             de: "Gäste",           nl: "Gasten"         },
    party_size_label: { fr: "Nombre de personnes", en: "Number of guests", de: "Personenanzahl", nl: "Aantal personen" },
    party_size_hint:  { fr: "Pour combien de couverts ?", en: "How many covers?", de: "Für wie viele Gedecke?", nl: "Voor hoeveel couverts?" },
    show_party_size:    true,
    show_opening_hours: true,
    show_menu:          true,
    service_type_options: [
      { value: "menu_item", label: { fr: "Plat / Boisson", en: "Dish / Drink", de: "Gericht / Getränk", nl: "Gerecht / Drank" } },
      { value: "service",   label: { fr: "Formule / Menu", en: "Set menu",     de: "Menü",              nl: "Menu"            } },
    ],
  },

  commerce: {
    ...DEFAULT,
    appointment:  { fr: "Rendez-vous",       en: "Appointment",        de: "Termin",          nl: "Afspraak"       },
    appointments: { fr: "Rendez-vous",       en: "Appointments",       de: "Termine",         nl: "Afspraken"      },
    booking_cta:  { fr: "Prendre rendez-vous", en: "Book an appointment", de: "Termin buchen", nl: "Afspraak maken" },
    lead:         { fr: "Demande",           en: "Request",            de: "Anfrage",         nl: "Aanvraag"       },
    leads:        { fr: "Demandes",          en: "Requests",           de: "Anfragen",        nl: "Aanvragen"      },
    contact:      { fr: "Client",            en: "Client",             de: "Kunde",           nl: "Klant"          },
    contacts:     { fr: "Clients",           en: "Clients",            de: "Kunden",          nl: "Klanten"        },
    show_opening_hours: true,
    service_type_options: [
      { value: "service", label: { fr: "Service",  en: "Service", de: "Dienstleistung", nl: "Dienst"   } },
      { value: "product", label: { fr: "Produit",  en: "Product", de: "Produkt",        nl: "Product"  } },
    ],
  },

  other: {
    ...DEFAULT,
    show_opening_hours: true,
  },
};

// ── Fonction publique ──────────────────────────────────────────────────────────

export function getSectorVocab(sector: string | null | undefined, lang: Lang = "fr"): SectorVocab {
  const def = VOCAB[sector ?? ""] ?? DEFAULT;
  const pick  = (ml: ML):  string        => ml[lang] ?? ml.fr;
  const pickN = (ml: MLN): string | null => ml[lang] !== undefined ? ml[lang] : ml.fr;
  return {
    appointment:        pick(def.appointment),
    appointments:       pick(def.appointments),
    booking_cta:        pick(def.booking_cta),
    lead:               pick(def.lead),
    leads:              pick(def.leads),
    contact:            pick(def.contact),
    contacts:           pick(def.contacts),
    party_size_label:   pickN(def.party_size_label),
    party_size_hint:    pickN(def.party_size_hint),
    show_party_size:    def.show_party_size,
    show_opening_hours: def.show_opening_hours,
    show_menu:          def.show_menu,
    service_type_options: def.service_type_options.map(o => ({ value: o.value, label: pick(o.label) })),
  };
}
