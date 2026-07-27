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
    selector: "#dash-pending",
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

// ── Tour 4 : Contacts (CRM) ───────────────────────────────────────────────────
const contactsSteps: Step[] = [
  {
    icon: "👥",
    title: "Votre carnet d'adresses",
    content:
      "Ici se trouve la liste de tous vos clients et prospects. Importez vos contacts existants depuis un fichier Excel/CSV, ou exportez-les à tout moment. Utilisez les tags colorés pour les organiser par catégorie (VIP, prospect, inactif…).",
    selector: "#contacts-header",
    side: "bottom",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "🔍",
    title: "Rechercher et filtrer",
    content:
      "Tapez un nom pour trouver un contact en un instant. Filtrez par tag ou affichez uniquement les clients inactifs (ceux qui n'ont pas eu de contact récent) pour les relancer.",
    selector: "#contacts-search",
    side: "bottom",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "📄",
    title: "La fiche client",
    content:
      "Cliquez sur un contact pour ouvrir sa fiche complète : historique de toutes ses demandes, ses rendez-vous passés et à venir, vos notes privées, et les rappels planifiés. Tout est centralisé en un seul endroit.",
    selector: "#contacts-list",
    side: "top",
    pointerPadding: 8,
    pointerRadius: 10,
  },
];

// ── Tour 5 : Rappels ──────────────────────────────────────────────────────────
const remindersSteps: Step[] = [
  {
    icon: "🔔",
    title: "Vos rappels à traiter",
    content:
      "Les rappels sont des tâches liées à vos clients : relance d'un prospect, suivi après un rendez-vous, paiement en attente... Filtrez par statut pour voir ce qui est urgent, ce qui est fait, ou les paiements à encaisser.",
    selector: "#reminders-filters",
    side: "bottom",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "📨",
    title: "Envoyer et archiver",
    content:
      "Pour chaque rappel, cliquez sur \"Envoyer\" pour contacter directement le client par email ou SMS. Une fois traité, cochez-le pour l'archiver. Les rappels en retard apparaissent en rouge en haut de la liste.",
    selector: "#reminders-list",
    side: "top",
    pointerPadding: 8,
    pointerRadius: 10,
  },
];

// ── Tour 6 : Agenda (Rendez-vous) ─────────────────────────────────────────────
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
  {
    icon: "📋",
    title: "Formulaire de réservation",
    content:
      "Ce bouton vous permet de personnaliser le formulaire que vos clients remplissent quand ils réservent. Ajoutez vos propres questions (motif de la visite, informations médicales…) et configurez éventuellement un acompte PayPal pour sécuriser les créneaux.",
    selector: "#appts-form-btn",
    side: "bottom",
    pointerPadding: 8,
    pointerRadius: 8,
  },
];

// ── Tour 7 : Site-builder ────────────────────────────────────────────────────
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

// ── Tour 8 : Statistiques ─────────────────────────────────────────────────────
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
      "Cette section montre si les habitants de votre région recherchent vos services sur Google. Un score élevé signifie qu'il y a beaucoup de clients potentiels près de chez vous. Cliquez sur ✏️ Affiner pour choisir vous-même les mots-clés envoyés à Google — utile pour coller exactement à votre spécialité.",
    selector: "#analytics-demand",
    side: "top",
    pointerPadding: 8,
    pointerRadius: 10,
  },
];

// ── Tour 9 : Agents IA ────────────────────────────────────────────────────────
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

// ── Tour 10 : Factures ────────────────────────────────────────────────────────
const invoicesSteps: Step[] = [
  {
    icon: "➕",
    title: "Créer une facture",
    content:
      "Cliquez ici pour créer une nouvelle facture. Renseignez le client, ajoutez vos lignes de prestation (description, quantité, prix unitaire, TVA), puis envoyez-la directement par email. Klientys génère automatiquement le PDF et le fichier UBL (format européen).",
    selector: "#invoices-new-btn",
    side: "bottom",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "🗂️",
    title: "Filtrer par statut",
    content:
      "Basculez entre Brouillon, Envoyée, Payée, En retard et Annulée pour retrouver rapidement vos factures. Les factures en retard apparaissent en rouge — pensez à relancer vos clients !",
    selector: "#invoices-tabs",
    side: "bottom",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "📄",
    title: "Gérer vos factures",
    content:
      "Chaque ligne du tableau vous permet de télécharger le PDF, de marquer la facture comme payée, de l'envoyer par email, ou de l'annuler. Cliquez sur le numéro de facture pour l'ouvrir et la modifier.",
    selector: "#invoices-table",
    side: "top",
    pointerPadding: 8,
    pointerRadius: 10,
  },
];

// ── Tour 11 : Campagnes email ─────────────────────────────────────────────────
const campaignsSteps: Step[] = [
  {
    icon: "✉️",
    title: "Envoyer un email groupé",
    content:
      "Composez ici un message à envoyer à un groupe de clients en une seule fois. Choisissez votre segment (tous les clients, les inactifs depuis 3 mois, ou ceux qui ont un tag précis), rédigez votre objet et votre message, puis envoyez.",
    selector: "#campaigns-form",
    side: "bottom",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "📜",
    title: "Historique des campagnes",
    content:
      "Retrouvez ici toutes vos campagnes passées avec la date d'envoi et le nombre de destinataires. Utile pour éviter d'envoyer deux fois le même message au même groupe.",
    selector: "#campaigns-history",
    side: "top",
    pointerPadding: 8,
    pointerRadius: 10,
  },
];

// ── Tour 12 : Widgets embed ───────────────────────────────────────────────────
const embedSteps: Step[] = [
  {
    icon: "💬",
    title: "Chatbot sur votre site actuel",
    content:
      "Si vous avez déjà un site web (WordPress, Wix, Squarespace…), vous pouvez y ajouter votre chatbot Klientys. Copiez ce code et collez-le dans le HTML de votre site — votre chatbot apparaîtra automatiquement sur toutes vos pages.",
    selector: "#embed-chatbot",
    side: "bottom",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "📅",
    title: "Widget de réservation intégrable",
    content:
      "De la même façon, intégrez votre calendrier de réservation directement dans votre site existant. Vos clients peuvent prendre rendez-vous sans quitter votre site, et les RDV arrivent directement dans votre agenda Klientys.",
    selector: "#embed-booking",
    side: "top",
    pointerPadding: 8,
    pointerRadius: 10,
  },
];

// ── Tour 13 : Espace secrétaire ───────────────────────────────────────────────
const secretarySteps: Step[] = [
  {
    icon: "🗓️",
    title: "Agenda multi-espaces",
    content:
      "L'espace secrétaire affiche les rendez-vous de tous les espaces professionnels auxquels vous êtes rattaché en une seule vue consolidée. Chaque espace a sa propre couleur. Basculez entre Jour, Semaine et Mois selon vos besoins.",
    selector: "#secretary-view-toggle",
    side: "bottom",
    pointerPadding: 8,
    pointerRadius: 10,
  },
  {
    icon: "✅",
    title: "Gérer les rendez-vous",
    content:
      "Cliquez sur un rendez-vous pour ouvrir sa fiche : vous pouvez ajouter une note, confirmer ou annuler le RDV directement depuis cet écran, sans avoir à basculer d'un espace à l'autre.",
    selector: "#secretary-list",
    side: "top",
    pointerPadding: 8,
    pointerRadius: 10,
  },
];

// ── Tour 14 : Paramètres ──────────────────────────────────────────────────────
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
    icon: "📋",
    title: "L'annuaire Klientys",
    content:
      "Dans \"Annuaire\", inscrivez-vous gratuitement dans le répertoire public Klientys. Renseignez votre métier, votre zone d'intervention et vos coordonnées — les clients de votre région pourront vous trouver sans même passer par votre site.",
    selector: "#settings-annuaire-btn",
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
      "Dans \"Équipe\", vous pouvez inviter des collaborateurs (secrétaire, associé...) à accéder à votre espace Klientys. Chaque membre peut avoir un rôle différent et des accès limités aux sections qui le concernent.",
    selector: "#settings-membres-btn",
    side: "right",
    pointerPadding: 8,
    pointerRadius: 8,
  },
];

// ── Export ────────────────────────────────────────────────────────────────────

export const ALL_TOURS: TourDef[] = [
  { tour: "welcome",      steps: welcomeSteps      },
  { tour: "dashboard",    steps: dashboardSteps    },
  { tour: "leads",        steps: leadsSteps        },
  { tour: "contacts",     steps: contactsSteps     },
  { tour: "reminders",    steps: remindersSteps    },
  { tour: "appointments", steps: appointmentsSteps },
  { tour: "site-builder", steps: siteBuilderSteps  },
  { tour: "analytics",    steps: analyticsSteps    },
  { tour: "agents",       steps: agentsSteps       },
  { tour: "invoices",     steps: invoicesSteps     },
  { tour: "campaigns",    steps: campaignsSteps    },
  { tour: "embed",        steps: embedSteps        },
  { tour: "secretary",    steps: secretarySteps    },
  { tour: "settings",     steps: settingsSteps     },
];

export const TOUR_MENU = [
  { tour: "welcome",      label: "🗺️  Visite guidée générale"   },
  { tour: "dashboard",    label: "📊  Tableau de bord"          },
  { tour: "leads",        label: "📨  Demandes clients"         },
  { tour: "contacts",     label: "👥  Contacts & CRM"           },
  { tour: "reminders",    label: "🔔  Rappels"                  },
  { tour: "appointments", label: "📅  Agenda & rendez-vous"     },
  { tour: "site-builder", label: "🌐  Créer mon site web"       },
  { tour: "analytics",    label: "📈  Statistiques"             },
  { tour: "agents",       label: "🤖  Assistants virtuels"      },
  { tour: "invoices",     label: "📄  Factures"                 },
  { tour: "campaigns",    label: "✉️  Campagnes email"          },
  { tour: "embed",        label: "🔗  Widgets intégrables"      },
  { tour: "secretary",    label: "🗓️  Espace secrétaire"        },
  { tour: "settings",     label: "⚙️  Paramètres"              },
];

export const PAGE_TOUR: Record<string, string> = {
  "/dashboard":                   "dashboard",
  "/dashboard/leads":             "leads",
  "/dashboard/contacts":          "contacts",
  "/dashboard/reminders":         "reminders",
  "/dashboard/appointments":      "appointments",
  "/dashboard/site-builder":      "site-builder",
  "/dashboard/analytics":         "analytics",
  "/dashboard/agents":            "agents",
  "/dashboard/invoices":          "invoices",
  "/dashboard/campaigns":         "campaigns",
  "/dashboard/embed":             "embed",
  "/dashboard/secretary":         "secretary",
  "/dashboard/settings":          "settings",
};
