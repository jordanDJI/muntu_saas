export type LeadTypeOption = { value: string; label: string };

const DEFAULT_TYPES: LeadTypeOption[] = [
  { value: "information", label: "Demande d'information" },
  { value: "quote", label: "Demande de devis" },
  { value: "appointment", label: "Prise de rendez-vous" },
  { value: "other", label: "Autre" },
];

const SECTOR_LEAD_TYPES: Record<string, LeadTypeOption[]> = {
  health: [
    { value: "consultation", label: "Consultation" },
    { value: "home_visit", label: "Visite à domicile" },
    { value: "follow_up", label: "Suivi / Bilan" },
    { value: "information", label: "Renseignement" },
    { value: "urgent", label: "Urgence" },
  ],
  beauty: [
    { value: "appointment", label: "Réservation" },
    { value: "information", label: "Renseignement tarifs" },
    { value: "gift", label: "Bon cadeau" },
    { value: "group", label: "Réservation de groupe" },
  ],
  coaching: [
    { value: "discovery", label: "Séance découverte" },
    { value: "quote", label: "Devis programme" },
    { value: "information", label: "Renseignement" },
    { value: "group", label: "Atelier / Groupe" },
  ],
  finance: [
    { value: "quote", label: "Demande de devis" },
    { value: "consultation", label: "Consultation" },
    { value: "tax", label: "Déclaration fiscale" },
    { value: "accounting", label: "Comptabilité courante" },
    { value: "information", label: "Renseignement" },
  ],
  trade: [
    { value: "quote", label: "Demande de devis" },
    { value: "urgent", label: "Intervention urgente" },
    { value: "expertise", label: "Expertise / Diagnostic" },
    { value: "information", label: "Renseignement" },
    { value: "maintenance", label: "Entretien / Maintenance" },
  ],
  restaurant: [
    { value: "reservation", label: "Réservation de table" },
    { value: "group", label: "Réservation de groupe / Événement" },
    { value: "takeaway", label: "Commande à emporter" },
    { value: "information", label: "Renseignement" },
  ],
  commerce: [
    { value: "product_info", label: "Renseignement produit" },
    { value: "quote", label: "Demande de devis" },
    { value: "appointment", label: "Rendez-vous en magasin" },
    { value: "order", label: "Commande spéciale" },
    { value: "information", label: "Autre renseignement" },
  ],
};

export function getSectorLeadTypes(sector: string | null | undefined): LeadTypeOption[] {
  return SECTOR_LEAD_TYPES[sector ?? ""] ?? DEFAULT_TYPES;
}
