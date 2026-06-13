// Labels métier en français uniquement (vocabulaire spécifique au secteur du tenant, non traduit).
export type SectorVocab = {
  /** Comment on appelle un rendez-vous dans ce secteur */
  appointment: string;
  /** Pluriel */
  appointments: string;
  /** "Prendre un RDV" / "Réserver une table" / "Commander" */
  booking_cta: string;
  /** "Demande" / "Lead" / "Commande" */
  lead: string;
  leads: string;
  /** "Client" / "Patient" / "Convive" */
  contact: string;
  contacts: string;
  /** Label du champ party_size dans le formulaire public */
  party_size_label: string | null;
  /** Hint sous le champ party_size */
  party_size_hint: string | null;
  /** Afficher le champ party_size dans le formulaire de réservation public */
  show_party_size: boolean;
  /** Afficher la section horaires d'ouverture dans le site-builder */
  show_opening_hours: boolean;
  /** Afficher la section menu/carte dans le site-builder (restaurant) */
  show_menu: boolean;
  /** Options de type de prestation disponibles pour ce secteur */
  service_type_options: { value: "service" | "product" | "menu_item"; label: string }[];
};

const DEFAULT: SectorVocab = {
  appointment: "Rendez-vous",
  appointments: "Rendez-vous",
  booking_cta: "Prendre rendez-vous",
  lead: "Demande",
  leads: "Demandes",
  contact: "Client",
  contacts: "Clients",
  party_size_label: null,
  party_size_hint: null,
  show_party_size: false,
  show_opening_hours: false,
  show_menu: false,
  service_type_options: [{ value: "service", label: "Prestation" }],
};

const VOCAB: Record<string, SectorVocab> = {
  health: {
    ...DEFAULT,
    appointment: "Consultation",
    appointments: "Consultations",
    booking_cta: "Prendre rendez-vous",
    lead: "Demande de soin",
    leads: "Demandes de soin",
    contact: "Patient",
    contacts: "Patients",
    show_opening_hours: true,
  },
  beauty: {
    ...DEFAULT,
    appointment: "Réservation",
    appointments: "Réservations",
    booking_cta: "Réserver",
    lead: "Demande",
    leads: "Demandes",
    contact: "Client(e)",
    contacts: "Clients",
    show_opening_hours: true,
  },
  coaching: {
    ...DEFAULT,
    appointment: "Séance",
    appointments: "Séances",
    booking_cta: "Réserver une séance",
    lead: "Demande",
    leads: "Demandes",
    contact: "Coaché(e)",
    contacts: "Coachés",
    show_opening_hours: true,
  },
  finance: {
    ...DEFAULT,
    appointment: "Rendez-vous",
    appointments: "Rendez-vous",
    booking_cta: "Prendre rendez-vous",
    lead: "Demande de conseil",
    leads: "Demandes",
    contact: "Client",
    contacts: "Clients",
    show_opening_hours: true,
  },
  trade: {
    ...DEFAULT,
    appointment: "Intervention",
    appointments: "Interventions",
    booking_cta: "Demander un devis",
    lead: "Devis",
    leads: "Devis",
    contact: "Client",
    contacts: "Clients",
    show_opening_hours: true,
    service_type_options: [
      { value: "service", label: "Prestation" },
      { value: "product", label: "Fourniture / Matériau" },
    ],
  },
  restaurant: {
    ...DEFAULT,
    appointment: "Réservation",
    appointments: "Réservations",
    booking_cta: "Réserver une table",
    lead: "Réservation",
    leads: "Réservations",
    contact: "Convive",
    contacts: "Convives",
    party_size_label: "Nombre de personnes",
    party_size_hint: "Pour combien de couverts ?",
    show_party_size: true,
    show_opening_hours: true,
    show_menu: true,
    service_type_options: [
      { value: "menu_item", label: "Plat / Boisson" },
      { value: "service", label: "Formule / Menu" },
    ],
  },
  commerce: {
    ...DEFAULT,
    appointment: "Rendez-vous",
    appointments: "Rendez-vous",
    booking_cta: "Prendre rendez-vous",
    lead: "Demande",
    leads: "Demandes",
    contact: "Client",
    contacts: "Clients",
    show_opening_hours: true,
    service_type_options: [
      { value: "service", label: "Service" },
      { value: "product", label: "Produit" },
    ],
  },
  other: { ...DEFAULT, show_opening_hours: true },
};

export function getSectorVocab(sector: string | null | undefined): SectorVocab {
  return VOCAB[sector ?? ""] ?? DEFAULT;
}
