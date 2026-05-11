import type { Step } from "onborda";

export type TourDef = { tour: string; steps: Step[] };

// ── Tour 1 : Bienvenue (navbar — toujours visible) ────────────────────────────
const welcomeSteps: Step[] = [
  {
    icon: "👋",
    title: "Bienvenue sur Klientys !",
    content:
      "Je vais vous faire visiter votre espace professionnel en moins d'une minute. Ce guide vous montre chaque outil à votre disposition. Vous pourrez le relancer à tout moment.",
    selector: "#onboarding-center",
    side: "bottom",
    pointerPadding: 0,
    pointerRadius: 0,
  },
  {
    icon: "📊",
    title: "Votre tableau de bord",
    content:
      "C'est votre page principale. Chaque jour, vous y trouverez un résumé de votre activité : les nouvelles demandes reçues, vos rendez-vous à venir, et vos chiffres du mois.",
    selector: "#nav-dashboard",
    side: "bottom",
    pointerPadding: 6,
    pointerRadius: 8,
  },
  {
    icon: "📨",
    title: "Vos demandes clients",
    content:
      "Chaque fois qu'un visiteur de votre site vous contacte ou réserve, sa demande apparaît ici. C'est votre liste de personnes à rappeler ou à traiter — comme une boîte mail simplifiée.",
    selector: "#nav-leads",
    side: "bottom",
    pointerPadding: 6,
    pointerRadius: 8,
  },
  {
    icon: "📅",
    title: "Votre agenda",
    content:
      "Gérez vos rendez-vous en ligne, comme un agenda papier. Vos clients peuvent réserver depuis votre site — vous recevez une notification et vous confirmez en un seul clic.",
    selector: "#nav-appointments",
    side: "bottom",
    pointerPadding: 6,
    pointerRadius: 8,
  },
  {
    icon: "🌐",
    title: "Votre site professionnel",
    content:
      "Créez votre page web sans aucune connaissance en informatique. En 9 étapes simples, vous aurez un site que vous pouvez partager à vos clients et sur les réseaux sociaux.",
    selector: "#nav-site-builder",
    side: "bottom",
    pointerPadding: 6,
    pointerRadius: 8,
  },
  {
    icon: "📊",
    title: "Vos statistiques",
    content:
      "Voyez combien de personnes visitent votre site, ce sur quoi elles cliquent, et d'où viennent vos nouveaux clients. Ces informations vous aident à mieux vous faire connaître.",
    selector: "#nav-analytics",
    side: "bottom",
    pointerPadding: 6,
    pointerRadius: 8,
  },
  {
    icon: "🤖",
    title: "Vos assistants virtuels",
    content:
      "Des robots intelligents qui répondent à vos clients 24h/24, même quand vous n'êtes pas disponible. Ils peuvent répondre aux questions fréquentes et prendre des rendez-vous à votre place.",
    selector: "#nav-agents",
    side: "bottom",
    pointerPadding: 6,
    pointerRadius: 8,
  },
  {
    icon: "❓",
    title: "Besoin d'aide ?",
    content:
      "Ce bouton \"?\" est toujours disponible dans la barre en haut. Cliquez dessus à tout moment pour relancer ce guide ou découvrir les guides de chaque fonctionnalité.",
    selector: "#tour-help",
    side: "bottom",
    pointerPadding: 6,
    pointerRadius: 8,
  },
];

// ── Tour 2 : Tableau de bord ──────────────────────────────────────────────────
const dashboardSteps: Step[] = [
  {
    icon: "📈",
    title: "Vos chiffres clés",
    content:
      "Ces cartes vous montrent l'essentiel en un coup d'œil : combien de clients vous ont contacté, combien de rendez-vous sont confirmés ce mois, et plus encore. Cliquez sur une carte pour voir les détails.",
    selector: "#dash-kpis",
    side: "bottom",
    pointerPadding: 8,
    pointerRadius: 12,
  },
  {
    icon: "⏳",
    title: "Rendez-vous à confirmer",
    content:
      "Quand un client réserve depuis votre site, le rendez-vous arrive \"en attente\". Cliquez sur le bouton vert ✓ pour accepter, ou sur ✕ pour refuser. Votre client reçoit automatiquement un email de confirmation ou d'annulation.",
    selector: "#dash-upcoming-appts",
    side: "bottom",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "👤",
    title: "Dernières demandes reçues",
    content:
      "Les toutes dernières personnes qui vous ont contacté apparaissent ici. Cliquez sur \"Voir tout\" pour accéder à la liste complète, ou directement sur une demande pour répondre.",
    selector: "#dash-recent-leads",
    side: "right",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "📅",
    title: "Vos prochains rendez-vous",
    content:
      "Vos rendez-vous confirmés à venir s'affichent ici. C'est pratique pour préparer votre journée ! Cliquez sur \"Voir tout\" pour ouvrir votre agenda complet.",
    selector: "#dash-upcoming-appts",
    side: "left",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "🧭",
    title: "Navigation rapide",
    content:
      "Ces raccourcis vous amènent directement aux différentes sections de Klientys. Un clic suffit pour aller où vous voulez !",
    selector: "#dash-nav",
    side: "top",
    pointerPadding: 8,
    pointerRadius: 10,
  },
];

// ── Tour 3 : Demandes clients (Leads) ────────────────────────────────────────
const leadsSteps: Step[] = [
  {
    icon: "🔍",
    title: "Filtrer vos demandes",
    content:
      "Ces boutons vous permettent de trier vos demandes par statut. Cliquez par exemple sur \"Nouveau\" pour voir uniquement les demandes que vous n'avez pas encore traitées. Très utile pour ne rien oublier !",
    selector: "#leads-filters",
    side: "bottom",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "📋",
    title: "Vos fiches clients",
    content:
      "Chaque carte représente une demande d'un client. Cliquez dessus pour voir ses coordonnées, lire sa demande, changer le statut, ajouter des notes, ou planifier un rendez-vous. Toutes les informations sont sauvegardées automatiquement.",
    selector: "#leads-list",
    side: "top",
    pointerPadding: 8,
    pointerRadius: 10,
  },
];

// ── Tour 4 : Agenda (Rendez-vous) ─────────────────────────────────────────────
const appointmentsSteps: Step[] = [
  {
    icon: "📅",
    title: "Choisir votre vue",
    content:
      "Vous pouvez afficher votre agenda par Jour, par Semaine ou par Mois — comme un vrai agenda. Choisissez la vue qui vous convient le mieux selon votre façon de travailler.",
    selector: "#appts-view-toggle",
    side: "bottom",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "⬅️",
    title: "Naviguer dans le temps",
    content:
      "Les flèches ◀ ▶ vous permettent de passer au jour, à la semaine ou au mois suivant (ou précédent). Le bouton \"Auj.\" revient toujours à aujourd'hui.",
    selector: "#appts-nav",
    side: "bottom",
    pointerPadding: 8,
    pointerRadius: 8,
  },
  {
    icon: "⏳",
    title: "Confirmer les rendez-vous",
    content:
      "Les rendez-vous pris depuis votre site apparaissent en bannière amber \"en attente\". Cliquez sur le bouton vert ✓ pour accepter, ou sur ✕ pour refuser. Votre client est automatiquement prévenu par email dans les deux cas.",
    selector: "#appts-calendar",
    side: "top",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "🗓️",
    title: "Votre calendrier",
    content:
      "Cliquez sur un espace vide dans le calendrier pour créer un nouveau rendez-vous manuellement. Cliquez sur un rendez-vous existant pour le modifier ou l'annuler. Les créneaux colorés indiquent vos disponibilités.",
    selector: "#appts-calendar",
    side: "top",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "⚙️",
    title: "Configurer vos horaires",
    content:
      "Ce bouton ouvre le panneau de vos disponibilités. Indiquez vos jours et heures de travail — vos clients ne pourront réserver que sur ces créneaux. Par exemple : lundi au vendredi, 9h–12h et 14h–18h.",
    selector: "#appts-availability-btn",
    side: "bottom",
    pointerPadding: 8,
    pointerRadius: 8,
  },
];

// ── Tour 5 : Site-builder ────────────────────────────────────────────────────
const siteBuilderSteps: Step[] = [
  {
    icon: "🌐",
    title: "Créer votre site en 9 étapes",
    content:
      "Ce guide vous accompagne pas à pas pour créer votre site professionnel. Vous voyez ici où vous en êtes. Complétez chaque étape dans l'ordre — pas de panique, vous pourrez tout modifier plus tard !",
    selector: "#sb-progress",
    side: "bottom",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "✏️",
    title: "Remplissez les informations",
    content:
      "Chaque étape vous demande des informations sur votre activité : votre nom, vos services, vos horaires... Si vous ne savez pas quoi écrire, laissez le champ vide pour l'instant — vous pourrez revenir le compléter plus tard.",
    selector: "#sb-progress",
    side: "bottom",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "➡️",
    title: "Avancer et reculer",
    content:
      "Utilisez ces boutons pour passer à l'étape suivante ou revenir en arrière. Vos informations sont sauvegardées automatiquement à chaque fois. À la dernière étape, vous pourrez publier votre site en un clic !",
    selector: "#sb-nav",
    side: "top",
    pointerPadding: 8,
    pointerRadius: 10,
  },
];

// ── Tour 6 : Statistiques ─────────────────────────────────────────────────────
const analyticsSteps: Step[] = [
  {
    icon: "📊",
    title: "Vos chiffres d'activité",
    content:
      "Ces cartes résument votre activité : combien de clients vous ont contacté, combien de rendez-vous ont été confirmés, quel est votre taux de conversion (le % de visites qui deviennent des clients).",
    selector: "#analytics-kpis",
    side: "bottom",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "📈",
    title: "Ce que font vos visiteurs",
    content:
      "Ici vous voyez comment les gens se comportent sur votre site : combien visitent votre page, combien cliquent sur votre numéro de téléphone, combien remplissent votre formulaire de contact. Ces informations vous aident à comprendre ce qui fonctionne.",
    selector: "#analytics-behavioral",
    side: "bottom",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "🌍",
    title: "Demande locale (Google Trends)",
    content:
      "Cette section vous montre si les habitants de votre région recherchent vos services sur Google. Un score élevé signifie qu'il y a beaucoup de clients potentiels près de chez vous — c'est le bon moment pour vous faire connaître !",
    selector: "#analytics-demand",
    side: "top",
    pointerPadding: 8,
    pointerRadius: 10,
  },
];

// ── Tour 7 : Agents IA ────────────────────────────────────────────────────────
const agentsSteps: Step[] = [
  {
    icon: "🤖",
    title: "Vos 3 assistants virtuels",
    content:
      "Vous disposez de 3 types d'assistants intelligents. L'assistant Vitrine répond aux visiteurs de votre site. L'assistant Support répond aux clients par message. L'assistant Personnel vous aide dans votre travail. Cliquez sur l'un d'eux pour le configurer.",
    selector: "#agents-list",
    side: "right",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "⚙️",
    title: "Configurer votre assistant",
    content:
      "Dans ce panneau, vous personnalisez l'assistant sélectionné. Vous pouvez modifier son message d'accueil (ce qu'il dit en premier), connecter WhatsApp ou Telegram, et l'activer ou le désactiver d'un simple clic.",
    selector: "#agent-panel",
    side: "left",
    pointerPadding: 8,
    pointerRadius: 10,
  },
];

// ── Tour 8 : Paramètres ───────────────────────────────────────────────────────
const settingsSteps: Step[] = [
  {
    icon: "⚙️",
    title: "Vos sections de paramètres",
    content:
      "Toutes vos préférences sont organisées ici en sections. Cliquez sur chaque section à gauche pour la configurer. Vous n'êtes pas obligé de tout remplir d'un coup — revenez à votre rythme !",
    selector: "#settings-nav",
    side: "right",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "👤",
    title: "Votre profil",
    content:
      "Cliquez sur \"Profil\" pour mettre à jour votre nom, votre langue d'affichage et votre fuseau horaire. Ces informations apparaissent dans votre espace Klientys.",
    selector: "#settings-profil-btn",
    side: "right",
    pointerPadding: 8,
    pointerRadius: 8,
  },
  {
    icon: "🌐",
    title: "Votre site",
    content:
      "Dans \"Mon site\" vous pouvez activer le mode absence (pour prévenir vos clients que vous n'êtes pas disponible) et publier ou dépublier votre site professionnel.",
    selector: "#settings-site-btn",
    side: "right",
    pointerPadding: 8,
    pointerRadius: 8,
  },
  {
    icon: "🔔",
    title: "Vos notifications",
    content:
      "Dans \"Notifications\", choisissez comment vous souhaitez être prévenu : par email quand un nouveau client vous contacte, quand un rendez-vous est réservé, pour les rappels... Activez ou désactivez chaque alerte selon vos préférences.",
    selector: "#settings-notifications-btn",
    side: "right",
    pointerPadding: 8,
    pointerRadius: 8,
  },
  {
    icon: "👥",
    title: "Votre équipe",
    content:
      "Dans \"Équipe\", vous pouvez inviter des collaborateurs (secrétaire, associé...) à accéder à votre espace Klientys. Chaque membre peut avoir un rôle différent.",
    selector: "#settings-membres-btn",
    side: "right",
    pointerPadding: 8,
    pointerRadius: 8,
  },
];

// ── Export ────────────────────────────────────────────────────────────────────

export const ALL_TOURS: TourDef[] = [
  { tour: "welcome",      steps: welcomeSteps      },
  { tour: "dashboard",   steps: dashboardSteps    },
  { tour: "leads",       steps: leadsSteps        },
  { tour: "appointments",steps: appointmentsSteps  },
  { tour: "site-builder",steps: siteBuilderSteps  },
  { tour: "analytics",   steps: analyticsSteps    },
  { tour: "agents",      steps: agentsSteps       },
  { tour: "settings",    steps: settingsSteps     },
];

export const TOUR_MENU = [
  { tour: "welcome",       label: "🗺️  Visite guidée générale"          },
  { tour: "dashboard",     label: "📊  Tableau de bord"                  },
  { tour: "leads",         label: "📨  Demandes clients"                  },
  { tour: "appointments",  label: "📅  Agenda & rendez-vous"             },
  { tour: "site-builder",  label: "🌐  Créer mon site web"               },
  { tour: "analytics",     label: "📈  Statistiques"                     },
  { tour: "agents",        label: "🤖  Assistants virtuels"              },
  { tour: "settings",      label: "⚙️  Paramètres"                       },
];

export const PAGE_TOUR: Record<string, string> = {
  "/dashboard":                  "dashboard",
  "/dashboard/leads":            "leads",
  "/dashboard/appointments":     "appointments",
  "/dashboard/site-builder":     "site-builder",
  "/dashboard/analytics":        "analytics",
  "/dashboard/agents":           "agents",
  "/dashboard/settings":         "settings",
};
