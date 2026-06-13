/**
 * Données pré-remplies pour le wizard site-builder selon le secteur.
 * Utilisées à l'onboarding pour guider les utilisateurs non-techniques.
 */
export type SectorTemplate = {
  tagline: string;
  description: string;
  atouts: { icon: string; title: string; description: string }[];
  services: { name: string; description: string; duration_min: number | null; price: number | null }[];
  pages_enabled: string[];
};

const TEMPLATES: Record<string, SectorTemplate> = {
  health: {
    tagline: "Des soins professionnels près de chez vous",
    description:
      "Professionnel(le) de santé disponible pour vos soins à domicile et en cabinet. Prise de rendez-vous en ligne 24h/24.",
    atouts: [
      { icon: "shield", title: "Diplômé(e) d'État", description: "Professionnel agréé et reconnu par les organismes de santé" },
      { icon: "clock",        title: "Disponible rapidement", description: "Plages horaires flexibles adaptées à votre emploi du temps" },
      { icon: "map-pin",      title: "Déplacements à domicile", description: "Je viens chez vous pour plus de confort" },
    ],
    services: [
      { name: "Consultation", description: "Consultation individuelle en cabinet", duration_min: 30, price: null },
      { name: "Visite à domicile", description: "Déplacement à votre domicile", duration_min: 45, price: null },
      { name: "Suivi régulier", description: "Suivi personnalisé sur plusieurs séances", duration_min: 30, price: null },
    ],
    pages_enabled: ["home", "about", "services", "contact"],
  },
  beauty: {
    tagline: "Votre beauté, notre passion",
    description:
      "Salon de beauté et bien-être pour sublimer votre apparence. Soins personnalisés dans un cadre chaleureux.",
    atouts: [
      { icon: "star",  title: "Produits haut de gamme", description: "Nous utilisons les meilleures marques du marché" },
      { icon: "clock",     title: "Horaires flexibles", description: "Ouvert en soirée et le week-end sur rendez-vous" },
      { icon: "star",      title: "Expertise reconnue", description: "Des années d'expérience à votre service" },
    ],
    services: [
      { name: "Coupe et brushing", description: "Coupe personnalisée + mise en forme", duration_min: 60, price: null },
      { name: "Coloration", description: "Coloration complète avec soin", duration_min: 90, price: null },
      { name: "Soin du visage", description: "Soin nettoyant et hydratant", duration_min: 45, price: null },
    ],
    pages_enabled: ["home", "about", "services", "contact"],
  },
  coaching: {
    tagline: "Atteignez votre plein potentiel",
    description:
      "Coach certifié pour vous accompagner dans votre transformation personnelle et professionnelle. Résultats concrets et durables.",
    atouts: [
      { icon: "award",    title: "Objectifs clairs", description: "Nous définissons ensemble des objectifs mesurables et atteignables" },
      { icon: "users",     title: "Suivi personnalisé", description: "Un accompagnement adapté à votre situation unique" },
      { icon: "trending", title: "Résultats prouvés", description: "Des méthodes éprouvées et des clients satisfaits" },
    ],
    services: [
      { name: "Séance découverte", description: "1h pour faire connaissance et définir vos besoins", duration_min: 60, price: null },
      { name: "Coaching individuel", description: "Séance de coaching personnalisé", duration_min: 90, price: null },
      { name: "Programme 3 mois", description: "Accompagnement intensif sur 3 mois", duration_min: null, price: null },
    ],
    pages_enabled: ["home", "about", "services", "contact"],
  },
  finance: {
    tagline: "Votre partenaire financier de confiance",
    description:
      "Expert-comptable et conseiller financier indépendant. Je vous accompagne dans la gestion et l'optimisation de vos finances.",
    atouts: [
      { icon: "shield", title: "Expertise certifiée", description: "Diplômé et membre de l'Ordre des Experts-Comptables" },
      { icon: "lock",         title: "Confidentialité totale", description: "Vos données financières sont traitées avec la plus grande discrétion" },
      { icon: "trending",  title: "Optimisation fiscale", description: "Nous minimisons légalement votre charge fiscale" },
    ],
    services: [
      { name: "Comptabilité mensuelle", description: "Tenue de comptabilité et bilans mensuels", duration_min: null, price: null },
      { name: "Déclaration fiscale", description: "Préparation et dépôt de votre déclaration", duration_min: null, price: null },
      { name: "Conseil financier", description: "Audit et conseil pour optimiser vos finances", duration_min: 60, price: null },
    ],
    pages_enabled: ["home", "about", "services", "contact"],
  },
  trade: {
    tagline: "Artisan de confiance à votre service",
    description:
      "Professionnel du bâtiment qualifié. Devis gratuit, travail soigné et garantie sur toutes mes prestations.",
    atouts: [
      { icon: "briefcase",       title: "Travail garanti", description: "Toutes mes interventions sont garanties pièces et main d'œuvre" },
      { icon: "clock",        title: "Intervention rapide", description: "Disponible pour les urgences 7j/7" },
      { icon: "thumbs-up",         title: "Devis gratuit", description: "Estimation gratuite sans engagement" },
    ],
    services: [
      { name: "Devis gratuit", description: "Étude de votre projet et estimation sans engagement", duration_min: 30, price: 0 },
      { name: "Intervention standard", description: "Travaux de rénovation et réparation", duration_min: null, price: null },
      { name: "Urgence", description: "Intervention d'urgence sous 2h", duration_min: null, price: null },
    ],
    pages_enabled: ["home", "about", "services", "contact"],
  },
  restaurant: {
    tagline: "Une expérience culinaire unique",
    description:
      "Restaurant chaleureux avec une cuisine maison réalisée à partir de produits frais et locaux. Réservation en ligne disponible.",
    atouts: [
      { icon: "leaf",    title: "Produits locaux", description: "Nous travaillons avec des producteurs locaux de saison" },
      { icon: "smile", title: "Cuisine maison", description: "Tous nos plats sont préparés maison avec soin" },
      { icon: "users",   title: "Privatisation possible", description: "Disponible pour vos événements privés et professionnels" },
    ],
    services: [
      { name: "Déjeuner", description: "Formule déjeuner du mardi au vendredi", duration_min: null, price: null },
      { name: "Dîner", description: "À la carte ou menu du soir", duration_min: null, price: null },
      { name: "Événement privé", description: "Privatisation de la salle pour vos événements", duration_min: null, price: null },
    ],
    pages_enabled: ["home", "about", "services", "contact"],
  },
  commerce: {
    tagline: "Votre boutique de référence",
    description:
      "Boutique spécialisée proposant une sélection soigneuse de produits de qualité. Conseil personnalisé et service sur mesure.",
    atouts: [
      { icon: "star",      title: "Sélection qualité", description: "Des produits soigneusement sélectionnés pour vous" },
      { icon: "users",     title: "Conseil expert", description: "Notre équipe vous guide vers les meilleurs choix" },
      { icon: "map-pin",   title: "En boutique & en ligne", description: "Retrouvez-nous en magasin ou commandez en ligne" },
    ],
    services: [
      { name: "Conseil personnalisé", description: "Rendez-vous en boutique pour un conseil sur mesure", duration_min: 30, price: 0 },
      { name: "Commande spéciale", description: "Nous sourçons les produits sur commande", duration_min: null, price: null },
    ],
    pages_enabled: ["home", "about", "services", "contact"],
  },
};

const DEFAULT_TEMPLATE: SectorTemplate = {
  tagline: "Professionnel à votre service",
  description: "Professionnel qualifié proposant des services personnalisés. Prise de rendez-vous en ligne 24h/24.",
  atouts: [
    { icon: "shield", title: "Expérience & expertise", description: "Des années d'expérience à votre service" },
    { icon: "clock",        title: "Disponible rapidement", description: "Réponse rapide à toutes vos demandes" },
    { icon: "star",         title: "Satisfaction garantie", description: "La qualité de service est notre priorité" },
  ],
  services: [
    { name: "Prestation standard", description: "Service personnalisé selon vos besoins", duration_min: 60, price: null },
    { name: "Consultation", description: "Analyse de vos besoins et conseil", duration_min: 30, price: null },
  ],
  pages_enabled: ["home", "about", "services", "contact"],
};

export function getSectorTemplate(sector: string | null | undefined): SectorTemplate {
  return TEMPLATES[sector ?? ""] ?? DEFAULT_TEMPLATE;
}
