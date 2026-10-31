"use client";
import { useEffect, useState } from "react";

// Langue des widgets embarqués. Fixée par `?lang=` (posé par embed.js depuis
// l'attribut `data-saas-lang`), puis mise à jour à chaud par un message
// `saas-set-lang` du site hôte — sans recharger l'iframe, donc sans perdre
// une saisie ou une conversation en cours.
//
// Les textes des widgets book / contact sont ceux du formulaire du site
// (app/[tenant]/contact-form-i18n.ts) : ce fichier ne porte que le chatbot
// et le message d'intégration désactivée.

export type EmbedLang = "fr" | "en" | "de" | "nl";

const LANGS: EmbedLang[] = ["fr", "en", "de", "nl"];

export function normalizeEmbedLang(value: unknown): EmbedLang | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toLowerCase().slice(0, 2);
  return (LANGS as string[]).includes(code) ? (code as EmbedLang) : null;
}

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
