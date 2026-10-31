"use client";
import { useEffect, useState } from "react";

// Langue des widgets embarqués. Fixée par `?lang=` (posé par embed.js depuis
// l'attribut `data-saas-lang`), puis mise à jour à chaud par un message
// `saas-set-lang` du site hôte — sans recharger l'iframe, donc sans perdre
// une saisie ou une conversation en cours.

export type EmbedLang = "fr" | "en" | "de" | "nl";

const LANGS: EmbedLang[] = ["fr", "en", "de", "nl"];

export function normalizeEmbedLang(value: unknown): EmbedLang | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toLowerCase().slice(0, 2);
  return (LANGS as string[]).includes(code) ? (code as EmbedLang) : null;
}

export const EMBED_LOCALE: Record<EmbedLang, string> = {
  fr: "fr-BE",
  en: "en-GB",
  de: "de-DE",
  nl: "nl-BE",
};

export function useEmbedLang(): EmbedLang {
  const [lang, setLang] = useState<EmbedLang>("fr");

  useEffect(() => {
    const fromUrl = normalizeEmbedLang(new URLSearchParams(window.location.search).get("lang"));
    if (fromUrl) setLang(fromUrl);

    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.parent) return;
      if (!e.data || e.data.type !== "saas-set-lang") return;
      const next = normalizeEmbedLang(e.data.lang);
      if (next) setLang(next);
    };
    window.addEventListener("message", onMessage);
    // Le site hôte a pu changer de langue avant que l'iframe ne soit prête :
    // on lui demande la valeur courante.
    window.parent.postMessage({ type: "saas-widget-ready" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return lang;
}

export const EMBED_T = {
  fr: {
    unavailable: "Ce service n'est plus disponible ici. Contactez directement le professionnel.",
    book: {
      months: ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
      days: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
      loading: "Chargement…",
      legend: "Les jours en violet ont des créneaux disponibles",
      back: "← Retour",
      slotsFor: "Créneaux disponibles",
      noSlots: "Aucun créneau disponible ce jour.",
      firstName: "Prénom *",
      lastName: "Nom *",
      email: "Email *",
      phone: "Téléphone",
      note: "Note (optionnel)",
      submitting: "Envoi en cours…",
      confirm: "Confirmer le rendez-vous",
      doneTitle: "Demande envoyée !",
      doneText: "Vous recevrez une confirmation par e-mail dès validation.",
      again: "Nouveau rendez-vous",
      error: "Une erreur est survenue.",
    },
    contact: {
      title: "Nous contacter",
      individual: "Particulier",
      company: "Entreprise",
      companyName: "Nom de l'entreprise *",
      firstName: "Prénom *",
      contactPerson: "Contact",
      lastName: "Nom *",
      email: "Email *",
      phone: "Téléphone",
      message: "Message *",
      placeholder: "Comment pouvons-nous vous aider ?",
      submitting: "Envoi en cours…",
      send: "Envoyer le message",
      doneTitle: "Message envoyé !",
      doneText: "Nous vous répondrons dans les plus brefs délais.",
      again: "Nouveau message",
      error: "Une erreur est survenue.",
    },
    chat: {
      open: "Ouvrir le chat",
      close: "Fermer",
      title: "Assistant IA",
      status: "En ligne · répond instantanément",
      hello: "👋 Bonjour !",
      help: "Comment puis-je vous aider ?",
      placeholder: "Votre message...",
      error: "Désolé, une erreur est survenue.",
      unavailable: "Désolé, je suis temporairement indisponible.",
    },
  },
  en: {
    unavailable: "This service is no longer available here. Please contact the professional directly.",
    book: {
      months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      loading: "Loading…",
      legend: "Days in purple have available slots",
      back: "← Back",
      slotsFor: "Available slots",
      noSlots: "No slots available on this day.",
      firstName: "First name *",
      lastName: "Last name *",
      email: "Email *",
      phone: "Phone",
      note: "Note (optional)",
      submitting: "Sending…",
      confirm: "Confirm appointment",
      doneTitle: "Request sent!",
      doneText: "You will receive an email confirmation once it is approved.",
      again: "New appointment",
      error: "Something went wrong.",
    },
    contact: {
      title: "Contact us",
      individual: "Individual",
      company: "Company",
      companyName: "Company name *",
      firstName: "First name *",
      contactPerson: "Contact person",
      lastName: "Last name *",
      email: "Email *",
      phone: "Phone",
      message: "Message *",
      placeholder: "How can we help you?",
      submitting: "Sending…",
      send: "Send message",
      doneTitle: "Message sent!",
      doneText: "We will get back to you as soon as possible.",
      again: "New message",
      error: "Something went wrong.",
    },
    chat: {
      open: "Open chat",
      close: "Close",
      title: "AI assistant",
      status: "Online · replies instantly",
      hello: "👋 Hello!",
      help: "How can I help you?",
      placeholder: "Your message...",
      error: "Sorry, something went wrong.",
      unavailable: "Sorry, I am temporarily unavailable.",
    },
  },
  de: {
    unavailable: "Dieser Dienst ist hier nicht mehr verfügbar. Bitte kontaktieren Sie den Fachmann direkt.",
    book: {
      months: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
      days: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
      loading: "Wird geladen…",
      legend: "Violette Tage haben freie Termine",
      back: "← Zurück",
      slotsFor: "Verfügbare Termine",
      noSlots: "An diesem Tag sind keine Termine verfügbar.",
      firstName: "Vorname *",
      lastName: "Nachname *",
      email: "E-Mail *",
      phone: "Telefon",
      note: "Notiz (optional)",
      submitting: "Wird gesendet…",
      confirm: "Termin bestätigen",
      doneTitle: "Anfrage gesendet!",
      doneText: "Sie erhalten eine Bestätigung per E-Mail, sobald der Termin bestätigt ist.",
      again: "Neuer Termin",
      error: "Ein Fehler ist aufgetreten.",
    },
    contact: {
      title: "Kontakt aufnehmen",
      individual: "Privatperson",
      company: "Unternehmen",
      companyName: "Firmenname *",
      firstName: "Vorname *",
      contactPerson: "Ansprechpartner",
      lastName: "Nachname *",
      email: "E-Mail *",
      phone: "Telefon",
      message: "Nachricht *",
      placeholder: "Wie können wir Ihnen helfen?",
      submitting: "Wird gesendet…",
      send: "Nachricht senden",
      doneTitle: "Nachricht gesendet!",
      doneText: "Wir antworten Ihnen so schnell wie möglich.",
      again: "Neue Nachricht",
      error: "Ein Fehler ist aufgetreten.",
    },
    chat: {
      open: "Chat öffnen",
      close: "Schließen",
      title: "KI-Assistent",
      status: "Online · antwortet sofort",
      hello: "👋 Hallo!",
      help: "Wie kann ich Ihnen helfen?",
      placeholder: "Ihre Nachricht...",
      error: "Entschuldigung, ein Fehler ist aufgetreten.",
      unavailable: "Entschuldigung, ich bin vorübergehend nicht erreichbar.",
    },
  },
  nl: {
    unavailable: "Deze dienst is hier niet meer beschikbaar. Neem rechtstreeks contact op met de professional.",
    book: {
      months: ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"],
      days: ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"],
      loading: "Laden…",
      legend: "De paarse dagen hebben beschikbare tijdslots",
      back: "← Terug",
      slotsFor: "Beschikbare tijdslots",
      noSlots: "Geen tijdslots beschikbaar op deze dag.",
      firstName: "Voornaam *",
      lastName: "Naam *",
      email: "E-mail *",
      phone: "Telefoon",
      note: "Opmerking (optioneel)",
      submitting: "Bezig met verzenden…",
      confirm: "Afspraak bevestigen",
      doneTitle: "Aanvraag verzonden!",
      doneText: "U ontvangt een bevestiging per e-mail zodra de afspraak is goedgekeurd.",
      again: "Nieuwe afspraak",
      error: "Er is een fout opgetreden.",
    },
    contact: {
      title: "Contacteer ons",
      individual: "Particulier",
      company: "Bedrijf",
      companyName: "Bedrijfsnaam *",
      firstName: "Voornaam *",
      contactPerson: "Contactpersoon",
      lastName: "Naam *",
      email: "E-mail *",
      phone: "Telefoon",
      message: "Bericht *",
      placeholder: "Hoe kunnen we u helpen?",
      submitting: "Bezig met verzenden…",
      send: "Bericht versturen",
      doneTitle: "Bericht verzonden!",
      doneText: "We antwoorden u zo snel mogelijk.",
      again: "Nieuw bericht",
      error: "Er is een fout opgetreden.",
    },
    chat: {
      open: "Chat openen",
      close: "Sluiten",
      title: "AI-assistent",
      status: "Online · antwoordt meteen",
      hello: "👋 Hallo!",
      help: "Hoe kan ik u helpen?",
      placeholder: "Uw bericht...",
      error: "Sorry, er is een fout opgetreden.",
      unavailable: "Sorry, ik ben tijdelijk niet beschikbaar.",
    },
  },
} as const;
